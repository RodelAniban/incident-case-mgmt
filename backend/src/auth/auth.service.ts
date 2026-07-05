import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { randomBytes, randomUUID } from 'crypto';
import { OAuth2Client } from 'google-auth-library';
import { authenticator } from 'otplib';
import * as QRCode from 'qrcode';
import { LessThan, Repository } from 'typeorm';
import { Role } from '../common/roles.enum';
import { decryptBuffer, encryptBuffer } from '../common/encryption.util';
import { RevokedToken, User } from '../entities';
import { UsersService } from '../users/users.service';

export interface JwtPayload {
  sub: number;
  email: string;
  role: string;
  teamId: number | null;
  jti: string;
  sv: number;
}

interface MfaPendingPayload {
  sub: number;
  mfaPending: true;
}

const MFA_ISSUER = 'Incident Case Management';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    @InjectRepository(RevokedToken) private readonly revokedTokens: Repository<RevokedToken>,
  ) {}

  async validateUser(email: string, password: string): Promise<User> {
    const user = await this.usersService.findByEmail(email);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const matches = await bcrypt.compare(password, user.passwordHash);
    if (!matches) {
      throw new UnauthorizedException('Invalid credentials');
    }
    this.assertActive(user);
    return user;
  }

  /**
   * Deactivation (UsersService.updateUser) is meant to take effect
   * immediately — checked here at login and again in JwtStrategy on every
   * request, so a disabled account can't keep using a token it already
   * holds. Only reached after a credential has already been proven valid
   * (password match or Google's own verification), so naming the real
   * reason doesn't leak anything an attacker without that credential could use.
   */
  private assertActive(user: User): void {
    if (!user.isActive) {
      throw new UnauthorizedException('This account has been disabled — contact an admin');
    }
  }

  /**
   * Password check passed. If MFA is enabled, this is only step one — hand
   * back a short-lived pending token instead of a real session, so the
   * caller must still prove possession of the authenticator before getting
   * an accessToken.
   */
  async login(user: User) {
    if (user.mfaEnabled) {
      const mfaToken = this.jwtService.sign({ sub: user.id, mfaPending: true } satisfies MfaPendingPayload, {
        expiresIn: '5m',
      });
      return { mfaRequired: true as const, mfaToken };
    }
    return this.issueSession(user);
  }

  async verifyMfaLogin(mfaToken: string, code: string) {
    let payload: MfaPendingPayload;
    try {
      payload = this.jwtService.verify<MfaPendingPayload>(mfaToken);
    } catch {
      throw new UnauthorizedException('MFA challenge expired — please log in again');
    }
    if (!payload.mfaPending) {
      throw new UnauthorizedException('Invalid MFA challenge');
    }
    const user = await this.usersService.findById(payload.sub);
    if (!user || !user.mfaEnabled) {
      throw new UnauthorizedException('MFA is not enabled for this account');
    }
    if (!this.verifyTotp(user, code)) {
      throw new UnauthorizedException('Invalid authentication code');
    }
    this.assertActive(user);
    return this.issueSession(user);
  }

  /**
   * Verifies a Google ID token server-side (never trusts a client-asserted
   * email) and reuses the same login() as password auth — so an account
   * with mfaEnabled still gets an MFA challenge after Google verifies it,
   * regardless of which credential got them this far.
   *
   * Existing accounts (matched by verified email) can always sign in this
   * way. A brand-new email only gets auto-provisioned if its domain is on
   * GOOGLE_SSO_ALLOWED_DOMAIN — checked against the email's own domain
   * suffix rather than Google's "hd" claim, since personal Gmail accounts
   * never carry an "hd" claim at all (only Workspace-managed ones do).
   */
  async loginWithGoogle(idToken: string) {
    const clientId = this.config.get<string>('GOOGLE_CLIENT_ID');
    if (!clientId) {
      throw new ServiceUnavailableException('Google sign-in is not configured on this server');
    }

    let email: string;
    let name: string | undefined;
    try {
      const ticket = await new OAuth2Client(clientId).verifyIdToken({ idToken, audience: clientId });
      const payload = ticket.getPayload();
      if (!payload?.email || !payload.email_verified) {
        throw new UnauthorizedException('Google account email is not verified');
      }
      email = payload.email;
      name = payload.name;
    } catch (err) {
      if (err instanceof UnauthorizedException) throw err;
      throw new UnauthorizedException('Invalid Google credential');
    }

    const existing = await this.usersService.findByEmail(email);
    if (existing) {
      this.assertActive(existing);
      return this.login(existing);
    }

    const allowedDomains = (this.config.get<string>('GOOGLE_SSO_ALLOWED_DOMAIN') ?? '')
      .split(',')
      .map((domain) => domain.trim().toLowerCase())
      .filter(Boolean);
    const emailDomain = email.split('@')[1]?.toLowerCase();
    if (!emailDomain || !allowedDomains.includes(emailDomain)) {
      throw new ForbiddenException(
        'No account exists for this Google email, and its domain is not authorized for self-service sign-up — ask an admin to create an account first',
      );
    }

    const provisioned = await this.usersService.createUser({
      email,
      name: name ?? email,
      role: Role.ANALYST_L1,
      // SSO-only account — nobody ever needs to know this password, it just
      // satisfies the NOT NULL passwordHash column so password login has
      // something (unguessable) to compare against if it's ever attempted.
      password: randomBytes(32).toString('hex'),
    });
    this.logger.log(`Auto-provisioned ${provisioned.email} via Google SSO (domain: ${emailDomain}), role=${Role.ANALYST_L1}`);
    return this.login(provisioned);
  }

  private issueSession(user: User) {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      teamId: user.team?.id ?? null,
      jti: randomUUID(),
      sv: user.sessionVersion,
    };
    return {
      mfaRequired: false as const,
      accessToken: this.jwtService.sign(payload),
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        team: user.team ? { id: user.team.id, name: user.team.name } : null,
        mfaEnabled: user.mfaEnabled,
      },
    };
  }

  /** Starts (or restarts) enrollment — generates a fresh secret, not yet trusted for login until /mfa/verify confirms it. */
  async setupMfa(userId: number) {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new UnauthorizedException();
    }
    const secret = authenticator.generateSecret();
    const { ciphertext, iv, authTag } = encryptBuffer(Buffer.from(secret, 'utf8'));
    await this.usersService.setPendingMfaSecret(userId, ciphertext.toString('base64'), iv, authTag);

    const otpauthUrl = authenticator.keyuri(user.email, MFA_ISSUER, secret);
    const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl);
    return { secret, otpauthUrl, qrCodeDataUrl };
  }

  async confirmMfa(userId: number, code: string) {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new UnauthorizedException();
    }
    if (!this.verifyTotp(user, code)) {
      throw new BadRequestException('Invalid authentication code');
    }
    await this.usersService.setMfaEnabled(userId, true);
    return { mfaEnabled: true };
  }

  async disableMfa(userId: number, code: string) {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new UnauthorizedException();
    }
    if (!user.mfaEnabled) {
      throw new BadRequestException('MFA is not enabled on this account');
    }
    // Requiring a valid code to disable (not just a valid session) means a
    // stolen-but-unlocked session can't be used to turn MFA off — the
    // attacker still needs the authenticator, which is the entire point.
    if (!this.verifyTotp(user, code)) {
      throw new BadRequestException('Invalid authentication code');
    }
    await this.usersService.clearMfa(userId);
    return { mfaEnabled: false };
  }

  async mfaStatus(userId: number) {
    const user = await this.usersService.findById(userId);
    return { mfaEnabled: user?.mfaEnabled ?? false };
  }

  private verifyTotp(user: User, code: string): boolean {
    if (!user.mfaSecretCiphertext || !user.mfaSecretIv || !user.mfaSecretAuthTag) {
      return false;
    }
    const secret = decryptBuffer(
      Buffer.from(user.mfaSecretCiphertext, 'base64'),
      user.mfaSecretIv,
      user.mfaSecretAuthTag,
    ).toString('utf8');
    return authenticator.verify({ token: code, secret });
  }

  async logout(jti: string, exp: number): Promise<void> {
    await this.revokedTokens.save({ jti, expiresAt: new Date(exp * 1000) });
    // Lazy cleanup on the same write path — nothing here needs a cron job,
    // since a revocation row is useless the moment its own token would have
    // expired anyway.
    await this.revokedTokens.delete({ expiresAt: LessThan(new Date()) });
  }
}
