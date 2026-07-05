import { OAuth2Client } from 'google-auth-library';
import * as request from 'supertest';
import { auth, createTestApp, enableMfaForActor, seedRoster, TestAppContext, TestRoster } from './utils/test-app';

// Google's own token-signature verification is the one boundary this suite
// doesn't exercise for real — that's a network call to Google's public key
// endpoint, and would make these tests depend on live internet access and a
// real signed credential. Everything downstream of "here's a verified
// payload" (existing-user lookup, domain-gated auto-provisioning, the
// email_verified check, reusing the MFA-aware login() flow) is real.
function mockGoogleTicket(payload: Partial<{ email: string; email_verified: boolean; name: string }>) {
  return jest.spyOn(OAuth2Client.prototype, 'verifyIdToken').mockResolvedValue({
    getPayload: () => payload,
  } as never);
}

describe('Google SSO', () => {
  let ctx: TestAppContext;
  let roster: TestRoster;

  beforeEach(() => {
    process.env.GOOGLE_CLIENT_ID = 'test-google-client-id';
    process.env.GOOGLE_SSO_ALLOWED_DOMAIN = 'allowed.example';
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  beforeAll(async () => {
    ctx = await createTestApp();
    roster = await seedRoster(ctx);
  });

  afterAll(async () => {
    await ctx.close();
  });

  it('rejects everything with 503 when GOOGLE_CLIENT_ID is not configured', async () => {
    delete process.env.GOOGLE_CLIENT_ID;
    mockGoogleTicket({ email: 'lead@test.local', email_verified: true });
    const res = await request(ctx.httpServer as never).post('/api/auth/google').send({ idToken: 'whatever' });
    expect(res.status).toBe(503);
  });

  it('rejects a token whose email Google has not verified', async () => {
    mockGoogleTicket({ email: 'lead@test.local', email_verified: false });
    const res = await request(ctx.httpServer as never).post('/api/auth/google').send({ idToken: 'whatever' });
    expect(res.status).toBe(401);
  });

  it('logs an existing user in by verified email, issuing a real session', async () => {
    mockGoogleTicket({ email: 'lead@test.local', email_verified: true, name: 'Priya Test' });
    const res = await request(ctx.httpServer as never).post('/api/auth/google').send({ idToken: 'whatever' });
    expect(res.status).toBe(201);
    expect(res.body.mfaRequired).toBeFalsy();
    expect(res.body.accessToken).toEqual(expect.any(String));
    expect(res.body.user.email).toBe('lead@test.local');

    // The token this endpoint issues is a normal session token, usable everywhere else.
    const casesRes = await request(ctx.httpServer as never).get('/api/cases').set(auth(res.body.accessToken));
    expect(casesRes.status).toBe(200);
  });

  it('routes an existing user with MFA enabled through the same MFA challenge as password login', async () => {
    await enableMfaForActor(ctx, roster.analyst1);
    mockGoogleTicket({ email: 'analyst1@test.local', email_verified: true });
    const res = await request(ctx.httpServer as never).post('/api/auth/google').send({ idToken: 'whatever' });
    expect(res.status).toBe(201);
    expect(res.body.mfaRequired).toBe(true);
    expect(res.body.accessToken).toBeUndefined();
    expect(res.body.mfaToken).toEqual(expect.any(String));
  });

  it('refuses to auto-provision an unknown email on a domain that is not allow-listed', async () => {
    mockGoogleTicket({ email: 'newperson@not-allowed.example', email_verified: true, name: 'New Person' });
    const res = await request(ctx.httpServer as never).post('/api/auth/google').send({ idToken: 'whatever' });
    expect(res.status).toBe(403);

    const stillMissing = await request(ctx.httpServer as never)
      .get('/api/users')
      .set(auth(roster.admin.token));
    expect(stillMissing.body.some((u: { email: string }) => u.email === 'newperson@not-allowed.example')).toBe(false);
  });

  it('auto-provisions a new Analyst L1 account for an unknown email on an allow-listed domain', async () => {
    mockGoogleTicket({ email: 'newperson@allowed.example', email_verified: true, name: 'New Person' });
    const res = await request(ctx.httpServer as never).post('/api/auth/google').send({ idToken: 'whatever' });
    expect(res.status).toBe(201);
    expect(res.body.accessToken).toEqual(expect.any(String));
    expect(res.body.user.email).toBe('newperson@allowed.example');
    expect(res.body.user.role).toBe('analyst_l1');
    expect(res.body.user.team).toBeNull();

    const usersRes = await request(ctx.httpServer as never).get('/api/users').set(auth(roster.admin.token));
    const created = usersRes.body.find((u: { email: string }) => u.email === 'newperson@allowed.example');
    expect(created).toBeTruthy();
    expect(created.passwordHash).toBeUndefined();

    // Re-authenticating with the same Google identity logs into the SAME
    // account rather than provisioning a second one.
    mockGoogleTicket({ email: 'newperson@allowed.example', email_verified: true, name: 'New Person' });
    const secondLogin = await request(ctx.httpServer as never).post('/api/auth/google').send({ idToken: 'whatever-2' });
    expect(secondLogin.body.user.id).toBe(res.body.user.id);
  });
});
