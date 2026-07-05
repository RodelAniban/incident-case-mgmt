import * as request from 'supertest';
import { NarrativeImageGcService } from '../src/case-images/narrative-image-gc.service';
import { auth, createCase, createTestApp, seedRoster, TestAppContext, TestRoster } from './utils/test-app';

const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
);

describe('narrative image garbage collection', () => {
  let ctx: TestAppContext;
  let roster: TestRoster;

  beforeAll(async () => {
    ctx = await createTestApp();
    roster = await seedRoster(ctx);
  });

  afterAll(async () => {
    await ctx.close();
  });

  async function uploadImage(caseId: number, token: string): Promise<string> {
    const res = await request(ctx.httpServer as never)
      .post(`/api/cases/${caseId}/images`)
      .set(auth(token))
      .attach('file', TINY_PNG, { filename: 'screenshot.png', contentType: 'image/png' });
    expect(res.status).toBe(201);
    return res.body.publicId;
  }

  async function imageExists(publicId: string): Promise<boolean> {
    const res = await request(ctx.httpServer as never).get(`/api/case-images/${publicId}/raw`);
    return res.status === 200;
  }

  it('does not delete an image while it is still referenced by the narrative', async () => {
    const kase = await createCase(ctx, roster.analyst1.token, roster.analyst1.teamId!);
    const publicId = await uploadImage(kase.id, roster.analyst1.token);

    await request(ctx.httpServer as never)
      .patch(`/api/cases/${kase.id}`)
      .set(auth(roster.analyst1.token))
      .send({ description: `<p>See attached</p><img src="/api/case-images/${publicId}/raw">` })
      .expect(200);

    // The save above already ran an automatic sweep — a referenced image must survive it.
    expect(await imageExists(publicId)).toBe(true);
  });

  it("does not delete a newly-orphaned image while it's still inside its grace period", async () => {
    const kase = await createCase(ctx, roster.analyst1.token, roster.analyst1.teamId!);
    const publicId = await uploadImage(kase.id, roster.analyst1.token);

    await request(ctx.httpServer as never)
      .patch(`/api/cases/${kase.id}`)
      .set(auth(roster.analyst1.token))
      .send({ description: `<img src="/api/case-images/${publicId}/raw">` })
      .expect(200);

    // Remove the only reference — this save's automatic sweep (real, default
    // grace period) must NOT delete it, since it was only just uploaded.
    await request(ctx.httpServer as never)
      .patch(`/api/cases/${kase.id}`)
      .set(auth(roster.analyst1.token))
      .send({ description: '<p>Removed the screenshot</p>' })
      .expect(200);

    expect(await imageExists(publicId)).toBe(true);
  });

  it('deletes an orphaned image once its grace period has passed', async () => {
    const kase = await createCase(ctx, roster.analyst1.token, roster.analyst1.teamId!);
    const publicId = await uploadImage(kase.id, roster.analyst1.token);

    await request(ctx.httpServer as never)
      .patch(`/api/cases/${kase.id}`)
      .set(auth(roster.analyst1.token))
      .send({ description: `<img src="/api/case-images/${publicId}/raw">` })
      .expect(200);
    await request(ctx.httpServer as never)
      .patch(`/api/cases/${kase.id}`)
      .set(auth(roster.analyst1.token))
      .send({ description: '<p>No image anymore</p>' })
      .expect(200);
    expect(await imageExists(publicId)).toBe(true); // still inside the real grace period

    // Simulate "the grace period has now elapsed" by sweeping with graceMs: 0
    // directly through the service — the only way to test this without
    // literally waiting out the real 24h default.
    const gc = ctx.app.get(NarrativeImageGcService);
    const { deleted } = await gc.sweepCase(kase.id, 0);
    expect(deleted).toBe(1);
    expect(await imageExists(publicId)).toBe(false);
  });

  it('never deletes an image still referenced by a finalized PIR version, even once it drops out of the live narrative', async () => {
    const kase = await createCase(ctx, roster.analyst1.token, roster.analyst1.teamId!);
    const publicId = await uploadImage(kase.id, roster.analyst1.token);

    const created = await request(ctx.httpServer as never)
      .post(`/api/pir/cases/${kase.id}`)
      .set(auth(roster.analyst1.token))
      .send({ templateId: 'generic' });
    const reportId = created.body.id;

    await request(ctx.httpServer as never)
      .patch(`/api/pir/reports/${reportId}`)
      .set(auth(roster.analyst1.token))
      .send({ rootCause: `<p>Root cause diagram:</p><img src="/api/case-images/${publicId}/raw">` })
      .expect(200);

    await request(ctx.httpServer as never)
      .post(`/api/pir/reports/${reportId}/finalize`)
      .set(auth(roster.lead.token))
      .expect(201);

    // The image was never in the narrative at all — force a sweep with no
    // grace period and confirm it survives purely because a finalized,
    // immutable PIR version still embeds it.
    const gc = ctx.app.get(NarrativeImageGcService);
    const { deleted } = await gc.sweepCase(kase.id, 0);
    expect(deleted).toBe(0);
    expect(await imageExists(publicId)).toBe(true);
  });

  it("does not touch a different case's images when sweeping", async () => {
    const caseA = await createCase(ctx, roster.analyst1.token, roster.analyst1.teamId!);
    const caseB = await createCase(ctx, roster.analyst1.token, roster.analyst1.teamId!);
    const publicIdA = await uploadImage(caseA.id, roster.analyst1.token);
    // Never referenced anywhere, in either case.

    const gc = ctx.app.get(NarrativeImageGcService);
    await gc.sweepCase(caseB.id, 0);
    expect(await imageExists(publicIdA)).toBe(true); // untouched — a sweep of B must never reach A's images
  });

  it('the manual admin trigger is gated to Admin (MANAGE_USERS) and returns a deleted count', async () => {
    const blocked = await request(ctx.httpServer as never).post('/api/case-images/gc').set(auth(roster.lead.token));
    expect(blocked.status).toBe(403);

    const allowed = await request(ctx.httpServer as never).post('/api/case-images/gc').set(auth(roster.admin.token));
    expect(allowed.status).toBe(201);
    expect(typeof allowed.body.deleted).toBe('number');
  });
});
