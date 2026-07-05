import * as request from 'supertest';
import { auth, createTestApp, seedRoster, TestAppContext, TestRoster } from './utils/test-app';

describe('admin action audit trail', () => {
  let ctx: TestAppContext;
  let roster: TestRoster;

  beforeAll(async () => {
    ctx = await createTestApp();
    roster = await seedRoster(ctx);
  });

  afterAll(async () => {
    await ctx.close();
  });

  it('is visible to the same audience as the case audit log (Lead/CISO/Auditor/Admin), not just Admin', async () => {
    const allowed = [roster.lead, roster.ciso, roster.auditor, roster.admin];
    const blocked = [roster.analyst1, roster.analyst2];

    for (const actor of allowed) {
      const res = await request(ctx.httpServer as never).get('/api/admin-audit').set(auth(actor.token));
      expect(res.status).not.toBe(403);
    }
    for (const actor of blocked) {
      const res = await request(ctx.httpServer as never).get('/api/admin-audit').set(auth(actor.token));
      expect(res.status).toBe(403);
    }
  });

  it('records every admin action with the right actor, target, and action label', async () => {
    const team = await request(ctx.httpServer as never)
      .post('/api/teams')
      .set(auth(roster.admin.token))
      .send({ name: 'Audit Test Team' });
    expect(team.status).toBe(201);

    const created = await request(ctx.httpServer as never)
      .post('/api/users')
      .set(auth(roster.admin.token))
      .send({ name: 'Audited User', email: 'audited@test.local', role: 'analyst_l1', teamId: team.body.id });
    const targetId = created.body.user.id;

    await request(ctx.httpServer as never)
      .patch(`/api/users/${targetId}`)
      .set(auth(roster.admin.token))
      .send({ role: 'analyst_l2' })
      .expect(200);

    await request(ctx.httpServer as never)
      .patch(`/api/users/${targetId}`)
      .set(auth(roster.admin.token))
      .send({ teamId: null })
      .expect(200);

    await request(ctx.httpServer as never)
      .patch(`/api/users/${targetId}`)
      .set(auth(roster.admin.token))
      .send({ isActive: false })
      .expect(200);

    await request(ctx.httpServer as never)
      .patch(`/api/users/${targetId}`)
      .set(auth(roster.admin.token))
      .send({ isActive: true })
      .expect(200);

    await request(ctx.httpServer as never)
      .post(`/api/users/${targetId}/reset-password`)
      .set(auth(roster.admin.token))
      .expect(201);

    const auditRes = await request(ctx.httpServer as never).get('/api/admin-audit').set(auth(roster.admin.token));
    const entries = auditRes.body as Array<{ action: string; actor: { id: number }; targetUser: { id: number } | null; details: string | null }>;

    const forTarget = entries.filter((e) => e.targetUser?.id === targetId);
    const actions = forTarget.map((e) => e.action);
    expect(actions).toEqual(['user_created', 'role_changed', 'team_changed', 'user_deactivated', 'user_reactivated', 'password_reset']);
    expect(forTarget.every((e) => e.actor.id === roster.admin.userId)).toBe(true);
    expect(forTarget.find((e) => e.action === 'role_changed')?.details).toBe('analyst_l1 -> analyst_l2');
    expect(forTarget.find((e) => e.action === 'team_changed')?.details).toBe('Audit Test Team -> Unassigned');

    const teamCreation = entries.find((e) => e.action === 'team_created' && e.details === 'name=Audit Test Team');
    expect(teamCreation).toBeTruthy();
    expect(teamCreation?.targetUser).toBeNull();
  });

  it('does not record an entry for a no-op update (same team re-sent)', async () => {
    const before = await request(ctx.httpServer as never).get('/api/admin-audit').set(auth(roster.admin.token));
    const countBefore = before.body.length;

    await request(ctx.httpServer as never)
      .patch(`/api/users/${roster.analyst1.userId}`)
      .set(auth(roster.admin.token))
      .send({ teamId: roster.analyst1.teamId })
      .expect(200);

    const after = await request(ctx.httpServer as never).get('/api/admin-audit').set(auth(roster.admin.token));
    expect(after.body.length).toBe(countBefore);
  });

  it('is a real, verifiable hash chain', async () => {
    const res = await request(ctx.httpServer as never).get('/api/admin-audit/verify').set(auth(roster.admin.token));
    expect(res.body).toEqual({ valid: true });
  });

  it('never leaks passwordHash or MFA-secret internals via nested actor/targetUser', async () => {
    const res = await request(ctx.httpServer as never).get('/api/admin-audit').set(auth(roster.admin.token));
    const serialized = JSON.stringify(res.body);
    for (const field of ['passwordHash', 'mfaSecretCiphertext', 'mfaSecretIv', 'mfaSecretAuthTag', 'sessionVersion']) {
      expect(serialized).not.toContain(field);
    }
  });
});
