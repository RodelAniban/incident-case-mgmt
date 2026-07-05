import * as request from 'supertest';
import { auth, createCase, createTestApp, seedRoster, TestAppContext, TestRoster } from './utils/test-app';

describe('cross-cutting security properties', () => {
  let ctx: TestAppContext;
  let roster: TestRoster;
  let caseId: number;

  beforeAll(async () => {
    ctx = await createTestApp();
    roster = await seedRoster(ctx);
    caseId = (await createCase(ctx, roster.analyst1.token, roster.analyst1.teamId!)).id;
  });

  afterAll(async () => {
    await ctx.close();
  });

  it('rejects a request body carrying a field no DTO declares (forbidNonWhitelisted)', async () => {
    const res = await request(ctx.httpServer as never)
      .post('/api/cases')
      .set(auth(roster.analyst1.token))
      .send({
        title: 'Mass assignment probe',
        severity: 'low',
        category: 'other',
        teamId: roster.analyst1.teamId,
        isAdmin: true,
      });
    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body)).toMatch(/isAdmin/);
  });

  it('never returns passwordHash from any endpoint that touches a user record', async () => {
    const endpoints: Array<() => Promise<request.Response>> = [
      () => request(ctx.httpServer as never).get('/api/cases').set(auth(roster.lead.token)),
      () => request(ctx.httpServer as never).get(`/api/cases/${caseId}`).set(auth(roster.lead.token)),
      () => request(ctx.httpServer as never).get('/api/users').set(auth(roster.admin.token)),
      () => request(ctx.httpServer as never).get(`/api/audit/cases/${caseId}`).set(auth(roster.lead.token)),
    ];

    for (const call of endpoints) {
      const res = await call();
      expect(JSON.stringify(res.body)).not.toContain('passwordHash');
    }
  });

  it('never returns evidence internals (storageRef, encryption IV/tag) from the list endpoint either', async () => {
    await request(ctx.httpServer as never)
      .post('/api/evidence')
      .set(auth(roster.analyst1.token))
      .field('caseId', String(caseId))
      .field('type', 'log_export')
      .attach('file', Buffer.from('content'), 'f.txt');

    const listRes = await request(ctx.httpServer as never)
      .get(`/api/evidence/case/${caseId}`)
      .set(auth(roster.analyst1.token));
    const serialized = JSON.stringify(listRes.body);
    expect(serialized).not.toContain('storageRef');
    expect(serialized).not.toContain('encryptionIv');
    expect(serialized).not.toContain('encryptionAuthTag');
  });

  it('applies security headers (helmet) to API responses', async () => {
    const res = await request(ctx.httpServer as never).get('/api/threat-intel/indicators').set(auth(roster.lead.token));
    expect(res.headers['x-powered-by']).toBeUndefined();
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });
});
