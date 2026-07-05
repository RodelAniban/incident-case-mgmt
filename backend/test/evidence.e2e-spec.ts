import * as fs from 'fs';
import * as path from 'path';
import * as request from 'supertest';
import { auth, createCase, createTestApp, enableMfaForActor, seedRoster, TestAppContext, TestRoster } from './utils/test-app';

describe('evidence', () => {
  let ctx: TestAppContext;
  let roster: TestRoster;
  let caseId: number;

  beforeAll(async () => {
    ctx = await createTestApp();
    roster = await seedRoster(ctx);
    // Upload/download are MFA-gated (MfaRequiredGuard) — enroll everyone this
    // spec exercises those endpoints as, so failures below are about the
    // property under test, not an incidental 403 from missing MFA.
    await Promise.all(
      [roster.analyst1, roster.analyst2, roster.lead, roster.ciso].map((actor) => enableMfaForActor(ctx, actor)),
    );
    caseId = (await createCase(ctx, roster.analyst1.token, roster.analyst1.teamId!)).id;
  });

  afterAll(async () => {
    await ctx.close();
  });

  it('never leaks internal fields (storageRef, encryption IV/tag) in the response', async () => {
    const res = await request(ctx.httpServer as never)
      .post('/api/evidence')
      .set(auth(roster.analyst1.token))
      .field('caseId', String(caseId))
      .field('type', 'log_export')
      .attach('file', Buffer.from('evidence content'), 'log.txt');

    expect(res.status).toBe(201);
    expect(res.body.storageRef).toBeUndefined();
    expect(res.body.encryptionIv).toBeUndefined();
    expect(res.body.encryptionAuthTag).toBeUndefined();
  });

  it('encrypts the stored blob — the plaintext never appears on disk', async () => {
    const marker = 'unmistakable-plaintext-marker-xyz';
    const res = await request(ctx.httpServer as never)
      .post('/api/evidence')
      .set(auth(roster.analyst1.token))
      .field('caseId', String(caseId))
      .field('type', 'log_export')
      .attach('file', Buffer.from(marker), 'log2.txt');

    const evidenceDir = path.join(process.env.EVIDENCE_STORAGE_DIR!, String(caseId));
    const files = fs.readdirSync(evidenceDir);
    const contents = files.map((f) => fs.readFileSync(path.join(evidenceDir, f)));
    expect(contents.some((c) => c.includes(marker))).toBe(false);
    expect(res.body.sha256).toHaveLength(64);
  });

  it('round-trips correctly on download and requires a reason', async () => {
    const content = 'round-trip content';
    const uploadRes = await request(ctx.httpServer as never)
      .post('/api/evidence')
      .set(auth(roster.lead.token))
      .field('caseId', String(caseId))
      .field('type', 'log_export')
      .attach('file', Buffer.from(content), 'roundtrip.txt');
    const evidenceId = uploadRes.body.id;

    const noReason = await request(ctx.httpServer as never)
      .get(`/api/evidence/${evidenceId}/download`)
      .set(auth(roster.lead.token));
    expect(noReason.status).toBe(400);

    const withReason = await request(ctx.httpServer as never)
      .get(`/api/evidence/${evidenceId}/download`)
      .query({ reason: 'verifying round trip' })
      .set(auth(roster.lead.token));
    expect(withReason.status).toBe(200);
    expect(withReason.text).toBe(content);
  });

  it('fails closed (500), not open, when the stored blob has been tampered with', async () => {
    const uploadRes = await request(ctx.httpServer as never)
      .post('/api/evidence')
      .set(auth(roster.lead.token))
      .field('caseId', String(caseId))
      .field('type', 'log_export')
      .attach('file', Buffer.from('tamper me'), 'tamper.txt');
    const evidenceId = uploadRes.body.id;

    // Reach past the API entirely and flip a byte directly in the WORM store,
    // simulating disk-level tampering or bit rot.
    const evidenceDir = path.join(process.env.EVIDENCE_STORAGE_DIR!, String(caseId));
    // storageRef is deliberately excluded from the API response (see the first
    // test above), so the newest file by mtime is the most reliable way to find
    // the blob this specific upload just created — readdirSync's order isn't
    // guaranteed to be creation order.
    const blobPath = fs
      .readdirSync(evidenceDir)
      .map((f) => path.join(evidenceDir, f))
      .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)[0];
    fs.chmodSync(blobPath, 0o644);
    const buf = fs.readFileSync(blobPath);
    buf[0] ^= 0xff;
    fs.writeFileSync(blobPath, buf);
    fs.chmodSync(blobPath, 0o444);

    const res = await request(ctx.httpServer as never)
      .get(`/api/evidence/${evidenceId}/download`)
      .query({ reason: 'integrity check' })
      .set(auth(roster.lead.token));
    expect(res.status).toBe(500);
  });

  it('locks the original file read-only on disk (real OS-level WORM, not just app logic)', async () => {
    const uploadRes = await request(ctx.httpServer as never)
      .post('/api/evidence')
      .set(auth(roster.lead.token))
      .field('caseId', String(caseId))
      .field('type', 'log_export')
      .attach('file', Buffer.from('immutable'), 'worm.txt');
    const evidenceDir = path.join(process.env.EVIDENCE_STORAGE_DIR!, String(caseId));
    const files = fs.readdirSync(evidenceDir).map((f) => path.join(evidenceDir, f));
    const newest = files.sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)[0];
    const mode = fs.statSync(newest).mode & 0o777;
    expect(mode).toBe(0o444);
    void uploadRes;
  });

  describe('per-item access grants', () => {
    let evidenceId: number;

    beforeAll(async () => {
      // Uploaded by lead — analyst2 (L2) is neither the collector nor leadership,
      // so should need an explicit grant despite holding DOWNLOAD_EVIDENCE generally.
      const res = await request(ctx.httpServer as never)
        .post('/api/evidence')
        .set(auth(roster.lead.token))
        .field('caseId', String(caseId))
        .field('type', 'log_export')
        .attach('file', Buffer.from('grant test'), 'grant.txt');
      evidenceId = res.body.id;
    });

    it('blocks Analyst L1 at the guard level — L1 has no DOWNLOAD_EVIDENCE at all', async () => {
      const res = await request(ctx.httpServer as never)
        .get(`/api/evidence/${evidenceId}/download`)
        .query({ reason: 'trying anyway' })
        .set(auth(roster.analyst1.token));
      expect(res.status).toBe(403);
    });

    it('blocks Analyst L2 without a grant, even though L2 holds DOWNLOAD_EVIDENCE generally', async () => {
      const res = await request(ctx.httpServer as never)
        .get(`/api/evidence/${evidenceId}/download`)
        .query({ reason: 'trying without a grant' })
        .set(auth(roster.analyst2.token));
      expect(res.status).toBe(403);
    });

    it('allows Analyst L2 after an explicit grant, and revokes it again cleanly', async () => {
      await request(ctx.httpServer as never)
        .post(`/api/evidence/${evidenceId}/access`)
        .set(auth(roster.lead.token))
        .send({ email: 'analyst2@test.local' })
        .expect(201);

      const granted = await request(ctx.httpServer as never)
        .get(`/api/evidence/${evidenceId}/download`)
        .query({ reason: 'now authorized' })
        .set(auth(roster.analyst2.token));
      expect(granted.status).toBe(200);

      await request(ctx.httpServer as never)
        .delete(`/api/evidence/${evidenceId}/access/${roster.analyst2.userId}`)
        .set(auth(roster.lead.token))
        .expect(200);

      const revoked = await request(ctx.httpServer as never)
        .get(`/api/evidence/${evidenceId}/download`)
        .query({ reason: 'trying again after revoke' })
        .set(auth(roster.analyst2.token));
      expect(revoked.status).toBe(403);
    });

    it('lets CISO download without any grant at all (leadership bypass)', async () => {
      const res = await request(ctx.httpServer as never)
        .get(`/api/evidence/${evidenceId}/download`)
        .query({ reason: 'leadership oversight' })
        .set(auth(roster.ciso.token));
      expect(res.status).toBe(200);
    });
  });
});
