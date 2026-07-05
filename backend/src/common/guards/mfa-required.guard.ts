import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { UsersService } from '../../users/users.service';

/**
 * Gates the two operations that actually touch evidence content (upload,
 * download) behind MFA — the plan requires MFA for evidence access
 * specifically, not for every authenticated action. Checked against the
 * current DB row rather than a JWT claim, since mfaEnabled can change
 * mid-session (enrolling or disabling MFA shouldn't require a fresh login
 * to take effect).
 */
@Injectable()
export class MfaRequiredGuard implements CanActivate {
  constructor(private readonly usersService: UsersService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const { user } = context.switchToHttp().getRequest();
    const record = await this.usersService.findById(user.userId);
    if (!record?.mfaEnabled) {
      throw new ForbiddenException('Multi-factor authentication must be enabled to access evidence — set it up under Account Security');
    }
    return true;
  }
}
