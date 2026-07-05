import { CanActivate, Injectable } from '@nestjs/common';

/**
 * Stands in for ThrottlerGuard during the automated test suite. Overriding a
 * globally-registered (APP_GUARD) guard via @nestjs/testing's overrideGuard/
 * overrideProvider doesn't reliably intercept it, and the e2e suite logs in
 * many fixture users per run — without this, it trips the same 5/min login
 * throttle real traffic would. The throttle config itself is still covered,
 * just via a metadata check rather than a real timing-based e2e test — see
 * test/auth.e2e-spec.ts.
 */
@Injectable()
export class AllowAllGuard implements CanActivate {
  canActivate(): boolean {
    return true;
  }
}
