import * as request from 'supertest';
import { auth, createCase, createTestApp, seedRoster, TestAppContext, TestRoster } from './utils/test-app';

// Smallest possible valid PNG (1x1 transparent pixel).
const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
);

describe('case images', () => {
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

  it('uploads an image and serves it back byte-for-byte with no auth header at all', async () => {
    const uploadRes = await request(ctx.httpServer as never)
      .post(`/api/cases/${caseId}/images`)
      .set(auth(roster.analyst1.token))
      .attach('file', TINY_PNG, { filename: 'screenshot.png', contentType: 'image/png' });

    expect(uploadRes.status).toBe(201);
    expect(uploadRes.body.publicId).toMatch(/^[0-9a-f-]{36}$/);

    // Deliberately no .set(auth(...)) here — a plain <img src> can't send one.
    const rawRes = await request(ctx.httpServer as never).get(`/api/case-images/${uploadRes.body.publicId}/raw`);
    expect(rawRes.status).toBe(200);
    expect(rawRes.headers['content-type']).toBe('image/png');
    expect(Buffer.compare(rawRes.body, TINY_PNG)).toBe(0);
  });

  it('rejects an unsupported mimetype', async () => {
    const res = await request(ctx.httpServer as never)
      .post(`/api/cases/${caseId}/images`)
      .set(auth(roster.analyst1.token))
      .attach('file', Buffer.from('not an image'), { filename: 'notes.txt', contentType: 'text/plain' });
    expect(res.status).toBe(400);
  });

  it('404s for a well-formed but nonexistent publicId', async () => {
    const res = await request(ctx.httpServer as never).get(
      '/api/case-images/00000000-0000-0000-0000-000000000000/raw',
    );
    expect(res.status).toBe(404);
  });

  it('requires CREATE_EDIT_CASE to upload — Auditor cannot attach images', async () => {
    const res = await request(ctx.httpServer as never)
      .post(`/api/cases/${caseId}/images`)
      .set(auth(roster.auditor.token))
      .attach('file', TINY_PNG, { filename: 'screenshot.png', contentType: 'image/png' });
    expect(res.status).toBe(403);
  });
});
