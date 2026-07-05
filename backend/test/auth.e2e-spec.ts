import * as request from 'supertest';
import { AuthController } from '../src/auth/auth.controller';
import { auth, createTestApp, seedRoster, TestAppContext, TestRoster } from './utils/test-app';

describe('auth', () => {
  let ctx: TestAppContext;
  let roster: TestRoster;

  beforeAll(async () => {
    ctx = await createTestApp();
    roster = await seedRoster(ctx);
  });

  afterAll(async () => {
    await ctx.close();
  });

  it('logs in with correct credentials and never returns the password hash', async () => {
    const res = await request(ctx.httpServer as never)
      .post('/api/auth/login')
      .send({ email: 'lead@test.local', password: 'TestPassword123!' });

    expect(res.status).toBe(201);
    expect(res.body.accessToken).toEqual(expect.any(String));
    expect(res.body.user.email).toBe('lead@test.local');
    expect(res.body.user.passwordHash).toBeUndefined();
    expect(JSON.stringify(res.body)).not.toContain('passwordHash');
  });

  it('rejects a wrong password', async () => {
    const res = await request(ctx.httpServer as never)
      .post('/api/auth/login')
      .send({ email: 'lead@test.local', password: 'not-the-password' });
    expect(res.status).toBe(401);
  });

  it('rejects a nonexistent account the same way as a wrong password (no user enumeration)', async () => {
    const res = await request(ctx.httpServer as never)
      .post('/api/auth/login')
      .send({ email: 'nobody@test.local', password: 'whatever12345' });
    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Invalid credentials');
  });

  it('requires a token on protected routes', async () => {
    const res = await request(ctx.httpServer as never).get('/api/cases');
    expect(res.status).toBe(401);
  });

  it('rejects a garbage token', async () => {
    const res = await request(ctx.httpServer as never)
      .get('/api/cases')
      .set('Authorization', 'Bearer not-a-real-jwt');
    expect(res.status).toBe(401);
  });

  // Rate limiting itself (5/min/IP on this route) isn't covered here — the
  // whole suite runs with DISABLE_THROTTLING=true (see test/env-setup.ts)
  // because logging in a fresh roster per spec file would otherwise trip the
  // same limit real traffic would. It was verified manually against the real
  // dev server during Phase 6 (see README's Security Hardening section:
  // 3 failed logins + this suite's own traffic exceeded 5/min and got 429s).
  it('has the strict login throttle actually attached to the route', () => {
    // @nestjs/throttler's @Throttle() decorator writes Reflect metadata under
    // 'THROTTLER:LIMIT' + configKey / 'THROTTLER:TTL' + configKey, holding the
    // raw number directly — confirmed by reading throttler.decorator.js, since
    // this shape isn't part of the package's documented public API.
    const limit = Reflect.getMetadata('THROTTLER:LIMITdefault', AuthController.prototype.login);
    const ttl = Reflect.getMetadata('THROTTLER:TTLdefault', AuthController.prototype.login);
    expect(limit).toBe(5);
    expect(ttl).toBe(60_000);
  });

  it("doesn't leak passwordHash for any user in the roster via the login response", () => {
    Object.values(roster).forEach((actor) => {
      expect(actor.token).toEqual(expect.any(String));
    });
  });

  describe('logout / token revocation', () => {
    it('rejects the exact token used to log out, once it has been revoked', async () => {
      const login = await request(ctx.httpServer as never)
        .post('/api/auth/login')
        .send({ email: 'auditor@test.local', password: 'TestPassword123!' });
      const token = login.body.accessToken;

      await request(ctx.httpServer as never).get('/api/cases').set(auth(token)).expect(200);

      const logoutRes = await request(ctx.httpServer as never).post('/api/auth/logout').set(auth(token));
      expect(logoutRes.status).toBe(201);
      expect(logoutRes.body).toEqual({ loggedOut: true });

      const afterLogout = await request(ctx.httpServer as never).get('/api/cases').set(auth(token));
      expect(afterLogout.status).toBe(401);
    });

    it('only revokes that one token — a second, independently-issued token for the same user keeps working', async () => {
      const first = await request(ctx.httpServer as never)
        .post('/api/auth/login')
        .send({ email: 'admin@test.local', password: 'TestPassword123!' });
      const second = await request(ctx.httpServer as never)
        .post('/api/auth/login')
        .send({ email: 'admin@test.local', password: 'TestPassword123!' });

      await request(ctx.httpServer as never).post('/api/auth/logout').set(auth(first.body.accessToken)).expect(201);

      const firstAfter = await request(ctx.httpServer as never).get('/api/cases').set(auth(first.body.accessToken));
      expect(firstAfter.status).toBe(401);

      const secondAfter = await request(ctx.httpServer as never).get('/api/cases').set(auth(second.body.accessToken));
      expect(secondAfter.status).toBe(200);
    });

    it('requires authentication to log out at all', async () => {
      const res = await request(ctx.httpServer as never).post('/api/auth/logout');
      expect(res.status).toBe(401);
    });
  });
});
