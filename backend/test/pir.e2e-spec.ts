import * as request from 'supertest';
import { auth, createCase, createTestApp, seedRoster, TestAppContext, TestRoster } from './utils/test-app';

describe('PIR reports', () => {
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

  it('auto-seeds the timeline section from real case history on creation', async () => {
    const res = await request(ctx.httpServer as never)
      .post(`/api/pir/cases/${caseId}`)
      .set(auth(roster.analyst1.token))
      .send({ templateId: 'phishing' });
    expect(res.status).toBe(201);
    expect(res.body.version).toBe(1);
    expect(res.body.finalizedAt).toBeNull();
    expect(res.body.sections.timelineNotes).toContain('<li>');
  });

  it('blocks CISO from drafting (no CREATE_EDIT_CASE), even though CISO can finalize', async () => {
    const kase = await createCase(ctx, roster.analyst1.token, roster.analyst1.teamId!);
    const createRes = await request(ctx.httpServer as never)
      .post(`/api/pir/cases/${kase.id}`)
      .set(auth(roster.ciso.token))
      .send({ templateId: 'generic' });
    expect(createRes.status).toBe(403);
  });

  it('is immutable once finalized: further PATCH attempts fail even for the report\'s own author', async () => {
    const kase = await createCase(ctx, roster.analyst1.token, roster.analyst1.teamId!);
    const created = await request(ctx.httpServer as never)
      .post(`/api/pir/cases/${kase.id}`)
      .set(auth(roster.analyst1.token))
      .send({ templateId: 'generic' });
    const reportId = created.body.id;

    await request(ctx.httpServer as never)
      .patch(`/api/pir/reports/${reportId}`)
      .set(auth(roster.analyst1.token))
      .send({ rootCause: '<p>initial root cause</p>' })
      .expect(200);

    await request(ctx.httpServer as never)
      .post(`/api/pir/reports/${reportId}/finalize`)
      .set(auth(roster.lead.token))
      .expect(201);

    const editAfterFinalize = await request(ctx.httpServer as never)
      .patch(`/api/pir/reports/${reportId}`)
      .set(auth(roster.analyst1.token))
      .send({ rootCause: '<p>trying to sneak in an edit</p>' });
    expect(editAfterFinalize.status).toBe(403);

    const auditRes = await request(ctx.httpServer as never)
      .get(`/api/audit/cases/${kase.id}`)
      .set(auth(roster.lead.token));
    expect(auditRes.body.some((e: { field: string }) => e.field === 'pir_finalized')).toBe(true);
  });

  it('new-version copies the finalized content forward and requires FINALIZE_PIR to start', async () => {
    const kase = await createCase(ctx, roster.analyst1.token, roster.analyst1.teamId!);
    const created = await request(ctx.httpServer as never)
      .post(`/api/pir/cases/${kase.id}`)
      .set(auth(roster.analyst1.token))
      .send({ templateId: 'generic' });
    const reportId = created.body.id;

    await request(ctx.httpServer as never)
      .patch(`/api/pir/reports/${reportId}`)
      .set(auth(roster.analyst1.token))
      .send({ lessonsLearned: '<p>keep patching VPN appliances</p>' })
      .expect(200);

    await request(ctx.httpServer as never)
      .post(`/api/pir/reports/${reportId}/finalize`)
      .set(auth(roster.lead.token))
      .expect(201);

    const l1Attempt = await request(ctx.httpServer as never)
      .post(`/api/pir/cases/${kase.id}/versions`)
      .set(auth(roster.analyst1.token));
    expect(l1Attempt.status).toBe(403);

    const newVersion = await request(ctx.httpServer as never)
      .post(`/api/pir/cases/${kase.id}/versions`)
      .set(auth(roster.lead.token));
    expect(newVersion.status).toBe(201);
    expect(newVersion.body.version).toBe(2);
    expect(newVersion.body.finalizedAt).toBeNull();
    expect(newVersion.body.sections.lessonsLearned).toContain('keep patching VPN appliances');
  });

  it('keeps action items editable after finalization, unlike the report sections', async () => {
    const kase = await createCase(ctx, roster.analyst1.token, roster.analyst1.teamId!);
    const created = await request(ctx.httpServer as never)
      .post(`/api/pir/cases/${kase.id}`)
      .set(auth(roster.analyst1.token))
      .send({ templateId: 'generic' });
    const reportId = created.body.id;

    await request(ctx.httpServer as never)
      .post(`/api/pir/reports/${reportId}/finalize`)
      .set(auth(roster.lead.token))
      .expect(201);

    const action = await request(ctx.httpServer as never)
      .post(`/api/pir/reports/${reportId}/actions`)
      .set(auth(roster.analyst1.token))
      .send({ description: 'Rotate credentials', owner: 'IT Security' });
    expect(action.status).toBe(201);

    const toggled = await request(ctx.httpServer as never)
      .patch(`/api/pir/actions/${action.body.id}`)
      .set(auth(roster.analyst1.token))
      .send({ done: true });
    expect(toggled.status).toBe(200);
    expect(toggled.body.done).toBe(true);
  });
});
