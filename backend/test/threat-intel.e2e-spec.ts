import * as request from 'supertest';
import { auth, createCase, createTestApp, seedRoster, TestAppContext, TestRoster } from './utils/test-app';

describe('threat intelligence', () => {
  let ctx: TestAppContext;
  let roster: TestRoster;

  beforeAll(async () => {
    ctx = await createTestApp();
    roster = await seedRoster(ctx);
  });

  afterAll(async () => {
    await ctx.close();
  });

  it('restricts feed import to Admin', async () => {
    const res = await request(ctx.httpServer as never)
      .post('/api/threat-intel/import')
      .set(auth(roster.analyst2.token))
      .send({ indicators: [{ type: 'ip', value: '198.51.100.1', source: 'test' }] });
    expect(res.status).toBe(403);
  });

  it('upserts by (type, value) instead of duplicating on re-import', async () => {
    await request(ctx.httpServer as never)
      .post('/api/threat-intel/import')
      .set(auth(roster.admin.token))
      .send({ indicators: [{ type: 'domain', value: 'upsert-test.example', confidence: 40, source: 'feed A' }] })
      .expect(201);
    await request(ctx.httpServer as never)
      .post('/api/threat-intel/import')
      .set(auth(roster.admin.token))
      .send({ indicators: [{ type: 'domain', value: 'upsert-test.example', confidence: 90, source: 'feed B' }] })
      .expect(201);

    const listRes = await request(ctx.httpServer as never)
      .get('/api/threat-intel/indicators')
      .query({ search: 'upsert-test.example' })
      .set(auth(roster.analyst1.token));
    expect(listRes.body).toHaveLength(1);
    expect(listRes.body[0].confidence).toBe(90);
    expect(listRes.body[0].source).toBe('feed B');
  });

  it('creates a watchlist match when a re-import touches an indicator already linked to a case', async () => {
    const kase = await createCase(ctx, roster.analyst1.token, roster.analyst1.teamId!);

    await request(ctx.httpServer as never)
      .post('/api/threat-intel/import')
      .set(auth(roster.admin.token))
      .send({ indicators: [{ type: 'domain', value: 'watchlist-test.example', source: 'feed' }] })
      .expect(201);
    const indicator = (
      await request(ctx.httpServer as never)
        .get('/api/threat-intel/indicators')
        .query({ search: 'watchlist-test.example' })
        .set(auth(roster.analyst1.token))
    ).body[0];

    await request(ctx.httpServer as never)
      .post(`/api/threat-intel/cases/${kase.id}/indicators`)
      .set(auth(roster.analyst1.token))
      .send({ indicatorId: indicator.id })
      .expect(201);

    const importRes = await request(ctx.httpServer as never)
      .post('/api/threat-intel/import')
      .set(auth(roster.admin.token))
      .send({ indicators: [{ type: 'domain', value: 'watchlist-test.example', confidence: 95, source: 'updated feed' }] });
    expect(importRes.body.matched).toBe(1);

    const matches = await request(ctx.httpServer as never)
      .get(`/api/threat-intel/cases/${kase.id}/matches`)
      .set(auth(roster.analyst1.token));
    expect(matches.body).toHaveLength(1);
    expect(matches.body[0].acknowledged).toBe(false);
  });

  it('only allows outbound sharing for TLP:GREEN/CLEAR indicators on closed cases', async () => {
    const kase = await createCase(ctx, roster.analyst1.token, roster.analyst1.teamId!);

    await request(ctx.httpServer as never)
      .post('/api/threat-intel/import')
      .set(auth(roster.admin.token))
      .send({
        indicators: [
          { type: 'domain', value: 'green.example', tlp: 'TLP:GREEN', source: 'feed' },
          { type: 'domain', value: 'amber.example', tlp: 'TLP:AMBER', source: 'feed' },
        ],
      })
      .expect(201);
    const green = (
      await request(ctx.httpServer as never)
        .get('/api/threat-intel/indicators')
        .query({ search: 'green.example' })
        .set(auth(roster.analyst1.token))
    ).body[0];
    const amber = (
      await request(ctx.httpServer as never)
        .get('/api/threat-intel/indicators')
        .query({ search: 'amber.example' })
        .set(auth(roster.analyst1.token))
    ).body[0];

    await request(ctx.httpServer as never)
      .post(`/api/threat-intel/cases/${kase.id}/indicators`)
      .set(auth(roster.analyst1.token))
      .send({ indicatorId: green.id })
      .expect(201);
    await request(ctx.httpServer as never)
      .post(`/api/threat-intel/cases/${kase.id}/indicators`)
      .set(auth(roster.analyst1.token))
      .send({ indicatorId: amber.id })
      .expect(201);

    const whileOpen = await request(ctx.httpServer as never)
      .post(`/api/threat-intel/cases/${kase.id}/share-requests`)
      .set(auth(roster.analyst1.token))
      .send({ indicatorId: green.id });
    expect(whileOpen.status).toBe(400);

    await request(ctx.httpServer as never)
      .patch(`/api/cases/${kase.id}`)
      .set(auth(roster.lead.token))
      .send({ status: 'closed' })
      .expect(200);

    const amberAttempt = await request(ctx.httpServer as never)
      .post(`/api/threat-intel/cases/${kase.id}/share-requests`)
      .set(auth(roster.analyst1.token))
      .send({ indicatorId: amber.id });
    expect(amberAttempt.status).toBe(403);

    const greenAttempt = await request(ctx.httpServer as never)
      .post(`/api/threat-intel/cases/${kase.id}/share-requests`)
      .set(auth(roster.analyst1.token))
      .send({ indicatorId: green.id });
    expect(greenAttempt.status).toBe(201);
    const requestId = greenAttempt.body.id;

    const leadApprove = await request(ctx.httpServer as never)
      .post(`/api/threat-intel/share-requests/${requestId}/approve`)
      .set(auth(roster.lead.token))
      .send({});
    expect(leadApprove.status).toBe(403);

    const cisoApprove = await request(ctx.httpServer as never)
      .post(`/api/threat-intel/share-requests/${requestId}/approve`)
      .set(auth(roster.ciso.token))
      .send({});
    expect(cisoApprove.status).toBe(201);
    expect(cisoApprove.body.status).toBe('approved');

    const auditRes = await request(ctx.httpServer as never)
      .get(`/api/audit/cases/${kase.id}`)
      .set(auth(roster.lead.token));
    expect(auditRes.body.some((e: { field: string }) => e.field === 'ti_share_approved')).toBe(true);
  });
});
