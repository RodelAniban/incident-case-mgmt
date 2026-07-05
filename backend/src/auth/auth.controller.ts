import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { RequestUser } from '../cases/cases.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AuthService } from './auth.service';
import { GoogleLoginDto } from './dto/google-login.dto';
import { LoginDto } from './dto/login.dto';
import { MfaCodeDto } from './dto/mfa-code.dto';
import { MfaLoginVerifyDto } from './dto/mfa-login-verify.dto';

type AuthenticatedRequest = { user: RequestUser & { jti: string; exp: number } };

// Both login steps share this limit — a brute-forceable second factor would
// defeat the point of having one. Per-IP, same reasoning as plain login: it
// doesn't leak account existence and can't be routed around by cycling emails.
const LOGIN_THROTTLE = { default: { ttl: 60_000, limit: 5 } };

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @Throttle(LOGIN_THROTTLE)
  async login(@Body() dto: LoginDto) {
    const user = await this.authService.validateUser(dto.email, dto.password);
    return this.authService.login(user);
  }

  @Post('mfa/login-verify')
  @Throttle(LOGIN_THROTTLE)
  async mfaLoginVerify(@Body() dto: MfaLoginVerifyDto) {
    return this.authService.verifyMfaLogin(dto.mfaToken, dto.code);
  }

  @Post('google')
  @Throttle(LOGIN_THROTTLE)
  async googleLogin(@Body() dto: GoogleLoginDto) {
    return this.authService.loginWithGoogle(dto.idToken);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  async logout(@Req() req: AuthenticatedRequest) {
    await this.authService.logout(req.user.jti, req.user.exp);
    return { loggedOut: true };
  }

  @Get('mfa/status')
  @UseGuards(JwtAuthGuard)
  mfaStatus(@Req() req: AuthenticatedRequest) {
    return this.authService.mfaStatus(req.user.userId);
  }

  @Post('mfa/setup')
  @UseGuards(JwtAuthGuard)
  setupMfa(@Req() req: AuthenticatedRequest) {
    return this.authService.setupMfa(req.user.userId);
  }

  @Post('mfa/verify')
  @UseGuards(JwtAuthGuard)
  confirmMfa(@Req() req: AuthenticatedRequest, @Body() dto: MfaCodeDto) {
    return this.authService.confirmMfa(req.user.userId, dto.code);
  }

  @Post('mfa/disable')
  @UseGuards(JwtAuthGuard)
  disableMfa(@Req() req: AuthenticatedRequest, @Body() dto: MfaCodeDto) {
    return this.authService.disableMfa(req.user.userId, dto.code);
  }
}
