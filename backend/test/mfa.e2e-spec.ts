import { authenticator } from 'otplib';
import * as request from 'supertest';
import { auth, createTestApp, seedRoster, TestAppContext, TestRoster } from './utils/test-app';

describe('multi-factor authentication', () => {
  let ctx: TestAppContext;
  let roster: TestRoster;

  beforeAll(async () => {
    ctx = await createTestApp();
    roster = await seedRoster(ctx);
  });

  afterAll(async () => {
    await ctx.close();
  });

  it('reports mfaEnabled: false before enrollment', async () => {
    const res = await request(ctx.httpServer as never).get('/api/auth/mfa/status').set(auth(roster.analyst1.token));
    expect(res.body).toEqual({ mfaEnabled: false });
  });

  it('rejects confirming enrollment with a wrong code, and login stays single-step until confirmed', async () => {
    const setupRes = await request(ctx.httpServer as never)
      .post('/api/auth/mfa/setup')
      .set(auth(roster.analyst1.token));
    expect(setupRes.status).toBe(201);
    expect(setupRes.body.secret).toEqual(expect.any(String));
    expect(setupRes.body.qrCodeDataUrl).toMatch(/^data:image\/png;base64,/);

    const wrongCode = await request(ctx.httpServer as never)
      .post('/api/auth/mfa/verify')
      .set(auth(roster.analyst1.token))
      .send({ code: '000000' });
    expect(wrongCode.status).toBe(400);

    // Setup alone (without a confirmed /verify) must not flip mfaEnabled —
    // an abandoned enrollment shouldn't lock the account into two-step login.
    const loginRes = await request(ctx.httpServer as never)
      .post('/api/auth/login')
      .send({ email: 'analyst1@test.local', password: 'TestPassword123!' });
    expect(loginRes.body.mfaRequired).toBeFalsy();
    expect(loginRes.body.accessToken).toEqual(expect.any(String));
  });

  it('full lifecycle: enroll, two-step login, wrong-code rejection, disable', async () => {
    const setupRes = await request(ctx.httpServer as never)
      .post('/api/auth/mfa/setup')
      .set(auth(roster.analyst2.token));
    const { secret } = setupRes.body;

    const confirmRes = await request(ctx.httpServer as never)
      .post('/api/auth/mfa/verify')
      .set(auth(roster.analyst2.token))
      .send({ code: authenticator.generate(secret) });
    expect(confirmRes.status).toBe(201);
    expect(confirmRes.body).toEqual({ mfaEnabled: true });

    const statusRes = await request(ctx.httpServer as never)
      .get('/api/auth/mfa/status')
      .set(auth(roster.analyst2.token));
    expect(statusRes.body).toEqual({ mfaEnabled: true });

    // Plain login now stops short of issuing a real session.
    const loginRes = await request(ctx.httpServer as never)
      .post('/api/auth/login')
      .send({ email: 'analyst2@test.local', password: 'TestPassword123!' });
    expect(loginRes.status).toBe(201);
    expect(loginRes.body.mfaRequired).toBe(true);
    expect(loginRes.body.accessToken).toBeUndefined();
    const { mfaToken } = loginRes.body;

    const wrongVerify = await request(ctx.httpServer as never)
      .post('/api/auth/mfa/login-verify')
      .send({ mfaToken, code: '000000' });
    expect(wrongVerify.status).toBe(401);

    const rightVerify = await request(ctx.httpServer as never)
      .post('/api/auth/mfa/login-verify')
      .send({ mfaToken, code: authenticator.generate(secret) });
    expect(rightVerify.status).toBe(201);
    expect(rightVerify.body.accessToken).toEqual(expect.any(String));
    expect(rightVerify.body.user.mfaEnabled).toBe(true);
    const sessionToken = rightVerify.body.accessToken;

    // Disabling requires a valid code too — not just an authenticated session.
    const disableWrongCode = await request(ctx.httpServer as never)
      .post('/api/auth/mfa/disable')
      .set(auth(sessionToken))
      .send({ code: '000000' });
    expect(disableWrongCode.status).toBe(400);

    const disableRes = await request(ctx.httpServer as never)
      .post('/api/auth/mfa/disable')
      .set(auth(sessionToken))
      .send({ code: authenticator.generate(secret) });
    expect(disableRes.status).toBe(201);
    expect(disableRes.body).toEqual({ mfaEnabled: false });

    const loginAfterDisable = await request(ctx.httpServer as never)
      .post('/api/auth/login')
      .send({ email: 'analyst2@test.local', password: 'TestPassword123!' });
    expect(loginAfterDisable.body.mfaRequired).toBeFalsy();
    expect(loginAfterDisable.body.accessToken).toEqual(expect.any(String));
  });

  it('gates evidence upload behind MFA with an actionable message, then allows it once enrolled', async () => {
    const kase = await request(ctx.httpServer as never)
      .post('/api/cases')
      .set(auth(roster.lead.token))
      .send({ title: 'MFA-gated evidence case', severity: 'low', category: 'other', teamId: roster.lead.teamId });

    const blockedUpload = await request(ctx.httpServer as never)
      .post('/api/evidence')
      .set(auth(roster.lead.token))
      .field('caseId', String(kase.body.id))
      .field('type', 'log_export')
      .attach('file', Buffer.from('content'), 'f.txt');
    expect(blockedUpload.status).toBe(403);
    expect(blockedUpload.body.message).toMatch(/multi-factor authentication/i);

    const setupRes = await request(ctx.httpServer as never).post('/api/auth/mfa/setup').set(auth(roster.lead.token));
    await request(ctx.httpServer as never)
      .post('/api/auth/mfa/verify')
      .set(auth(roster.lead.token))
      .send({ code: authenticator.generate(setupRes.body.secret) })
      .expect(201);

    const allowedUpload = await request(ctx.httpServer as never)
      .post('/api/evidence')
      .set(auth(roster.lead.token))
      .field('caseId', String(kase.body.id))
      .field('type', 'log_export')
      .attach('file', Buffer.from('content'), 'f.txt');
    expect(allowedUpload.status).toBe(201);
  });
});
