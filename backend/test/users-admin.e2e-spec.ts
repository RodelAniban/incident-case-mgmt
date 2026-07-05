import * as request from 'supertest';
import { auth, createTestApp, seedRoster, TestAppContext, TestRoster } from './utils/test-app';

describe('user & role administration', () => {
  let ctx: TestAppContext;
  let roster: TestRoster;

  beforeAll(async () => {
    ctx = await createTestApp();
    roster = await seedRoster(ctx);
  });

  afterAll(async () => {
    await ctx.close();
  });

  it('is Admin-only — every endpoint 403s for a non-admin', async () => {
    const calls: Array<() => Promise<request.Response>> = [
      () => request(ctx.httpServer as never).get('/api/users').set(auth(roster.lead.token)),
      () => request(ctx.httpServer as never).post('/api/users').set(auth(roster.lead.token)).send({}),
      () => request(ctx.httpServer as never).patch(`/api/users/${roster.analyst1.userId}`).set(auth(roster.lead.token)).send({}),
      () => request(ctx.httpServer as never).post(`/api/users/${roster.analyst1.userId}/reset-password`).set(auth(roster.lead.token)),
      () => request(ctx.httpServer as never).get('/api/teams').set(auth(roster.lead.token)),
      () => request(ctx.httpServer as never).post('/api/teams').set(auth(roster.lead.token)).send({ name: 'x' }),
    ];
    for (const call of calls) {
      expect((await call()).status).toBe(403);
    }
  });

  it('creates a user with a generated password that actually logs in, and rejects a duplicate email', async () => {
    const res = await request(ctx.httpServer as never)
      .post('/api/users')
      .set(auth(roster.admin.token))
      .send({ name: 'Newbie Analyst', email: 'newbie@test.local', role: 'analyst_l1' });
    expect(res.status).toBe(201);
    expect(res.body.temporaryPassword).toEqual(expect.any(String));
    expect(res.body.user.email).toBe('newbie@test.local');
    expect(JSON.stringify(res.body)).not.toContain('passwordHash');

    const loginRes = await request(ctx.httpServer as never)
      .post('/api/auth/login')
      .send({ email: 'newbie@test.local', password: res.body.temporaryPassword });
    expect(loginRes.status).toBe(201);
    expect(loginRes.body.accessToken).toEqual(expect.any(String));

    const dupeRes = await request(ctx.httpServer as never)
      .post('/api/users')
      .set(auth(roster.admin.token))
      .send({ name: 'Someone Else', email: 'newbie@test.local', role: 'analyst_l1' });
    expect(dupeRes.status).toBe(409);
  });

  it('changes a role and team, and it applies to that user\'s very next request without re-login', async () => {
    const team = await request(ctx.httpServer as never).post('/api/teams').set(auth(roster.admin.token)).send({ name: 'Retitled Team' });
    expect(team.status).toBe(201);

    // analyst1 is L1 and lacks VIEW_AUDIT_LOG — confirmed 403 on their current, still-valid token.
    const before = await request(ctx.httpServer as never).get('/api/audit/cases/1').set(auth(roster.analyst1.token));
    expect(before.status).toBe(403);

    const patchRes = await request(ctx.httpServer as never)
      .patch(`/api/users/${roster.analyst1.userId}`)
      .set(auth(roster.admin.token))
      .send({ role: 'ir_lead', teamId: team.body.id });
    expect(patchRes.status).toBe(200);
    expect(patchRes.body.role).toBe('ir_lead');
    expect(patchRes.body.team.id).toBe(team.body.id);

    // Same never-reissued token — VIEW_AUDIT_LOG (Lead-and-up) now resolves,
    // proving PermissionsGuard is reading the live DB role, not the stale JWT claim.
    const auditRes = await request(ctx.httpServer as never)
      .get(`/api/audit/cases/1`)
      .set(auth(roster.analyst1.token));
    expect(auditRes.status).not.toBe(403);
  });

  it('blocks an admin from changing their own role or active status', async () => {
    const selfRole = await request(ctx.httpServer as never)
      .patch(`/api/users/${roster.admin.userId}`)
      .set(auth(roster.admin.token))
      .send({ role: 'analyst_l1' });
    expect(selfRole.status).toBe(403);

    const selfDisable = await request(ctx.httpServer as never)
      .patch(`/api/users/${roster.admin.userId}`)
      .set(auth(roster.admin.token))
      .send({ isActive: false });
    expect(selfDisable.status).toBe(403);
  });

  it('deactivating a user blocks future logins AND kills a session they already hold', async () => {
    const created = await request(ctx.httpServer as never)
      .post('/api/users')
      .set(auth(roster.admin.token))
      .send({ name: 'Soon Disabled', email: 'soon-disabled@test.local', role: 'analyst_l1' });
    const loginRes = await request(ctx.httpServer as never)
      .post('/api/auth/login')
      .send({ email: 'soon-disabled@test.local', password: created.body.temporaryPassword });
    const liveToken = loginRes.body.accessToken;

    await request(ctx.httpServer as never).get('/api/cases').set(auth(liveToken)).expect(200);

    const disableRes = await request(ctx.httpServer as never)
      .patch(`/api/users/${created.body.user.id}`)
      .set(auth(roster.admin.token))
      .send({ isActive: false });
    expect(disableRes.status).toBe(200);
    expect(disableRes.body.isActive).toBe(false);

    const afterDisable = await request(ctx.httpServer as never).get('/api/cases').set(auth(liveToken));
    expect(afterDisable.status).toBe(401);

    const loginAttempt = await request(ctx.httpServer as never)
      .post('/api/auth/login')
      .send({ email: 'soon-disabled@test.local', password: created.body.temporaryPassword });
    expect(loginAttempt.status).toBe(401);
  });

  it('resetting a password invalidates the old session and the new password actually works', async () => {
    const created = await request(ctx.httpServer as never)
      .post('/api/users')
      .set(auth(roster.admin.token))
      .send({ name: 'Reset Me', email: 'reset-me@test.local', role: 'analyst_l1' });
    const firstLogin = await request(ctx.httpServer as never)
      .post('/api/auth/login')
      .send({ email: 'reset-me@test.local', password: created.body.temporaryPassword });
    const oldToken = firstLogin.body.accessToken;

    const resetRes = await request(ctx.httpServer as never)
      .post(`/api/users/${created.body.user.id}/reset-password`)
      .set(auth(roster.admin.token));
    expect(resetRes.status).toBe(201);
    const newPassword = resetRes.body.temporaryPassword;
    expect(newPassword).not.toBe(created.body.temporaryPassword);

    const oldTokenAfterReset = await request(ctx.httpServer as never).get('/api/cases').set(auth(oldToken));
    expect(oldTokenAfterReset.status).toBe(401);

    const oldPasswordNowRejected = await request(ctx.httpServer as never)
      .post('/api/auth/login')
      .send({ email: 'reset-me@test.local', password: created.body.temporaryPassword });
    expect(oldPasswordNowRejected.status).toBe(401);

    const newLogin = await request(ctx.httpServer as never)
      .post('/api/auth/login')
      .send({ email: 'reset-me@test.local', password: newPassword });
    expect(newLogin.status).toBe(201);
    expect(newLogin.body.accessToken).toEqual(expect.any(String));
  });

  it('rejects a duplicate team name', async () => {
    await request(ctx.httpServer as never).post('/api/teams').set(auth(roster.admin.token)).send({ name: 'Unique Squad' }).expect(201);
    const dupe = await request(ctx.httpServer as never).post('/api/teams').set(auth(roster.admin.token)).send({ name: 'Unique Squad' });
    expect(dupe.status).toBe(409);
  });
});
