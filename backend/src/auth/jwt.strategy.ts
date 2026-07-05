import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { InjectRepository } from '@nestjs/typeorm';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Repository } from 'typeorm';
import { RevokedToken } from '../entities';
import { UsersService } from '../users/users.service';
import { JwtPayload } from './auth.service';

// jsonwebtoken merges standard claims (iat, exp) into the payload object
// passport-jwt hands to validate() — they're real, just not declared on our
// own JwtPayload shape, which only lists the claims we set ourselves.
type DecodedJwtPayload = JwtPayload & { exp: number };

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly usersService: UsersService,
    @InjectRepository(RevokedToken) private readonly revokedTokens: Repository<RevokedToken>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_SECRET', 'change-me-in-production'),
    });
  }

  async validate(payload: DecodedJwtPayload) {
    if (payload.jti) {
      const revoked = await this.revokedTokens.findOne({ where: { jti: payload.jti } });
      if (revoked) {
        throw new UnauthorizedException('Token has been revoked');
      }
    }

    // Checked against the live row, not a JWT claim, so deactivating a user
    // or resetting their password cuts off a token they're mid-request with
    // right now — not just the next login attempt.
    const user = await this.usersService.findById(payload.sub);
    if (!user || !user.isActive) {
      throw new UnauthorizedException('This account has been disabled');
    }
    // Exact match, not a timestamp comparison — a reset/deactivation and a
    // fresh login can land in the same wall-clock second, and JWT `iat` only
    // has 1-second resolution, so comparing instants would be racy. This
    // also incidentally rejects the short-lived mfaPending token if it's
    // ever replayed as a bearer token elsewhere: that payload has no `sv`
    // claim at all, so it can never equal a real sessionVersion.
    if (payload.sv !== user.sessionVersion) {
      throw new UnauthorizedException('Session has been invalidated — please log in again');
    }

    // Attached to req.user; kept intentionally small since guards only need role/team scoping.
    // jti/exp ride along too, so POST /auth/logout can revoke exactly this token.
    //
    // role/teamId come from the row just fetched, not the JWT claim — an
    // admin changing someone's role or team takes effect on their very next
    // request, rather than waiting for the token to expire and get reissued.
    return {
      userId: payload.sub,
      email: payload.email,
      role: user.role,
      teamId: user.team?.id ?? null,
      jti: payload.jti,
      exp: payload.exp,
    };
  }
}
