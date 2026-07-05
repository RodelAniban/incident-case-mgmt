import * as request from 'supertest';
import { auth, createCase, createTestApp, seedRoster, TestAppContext, TestRoster } from './utils/test-app';

describe('case narrative sanitization', () => {
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

  async function setDescription(description: string): Promise<string> {
    const res = await request(ctx.httpServer as never)
      .patch(`/api/cases/${caseId}`)
      .set(auth(roster.analyst1.token))
      .send({ description });
    expect(res.status).toBe(200);
    return res.body.description;
  }

  it('preserves safe formatting (bold, lists, headings)', async () => {
    const stored = await setDescription('<h2>Summary</h2><p><strong>Bold</strong> text</p><ul><li>item</li></ul>');
    expect(stored).toContain('<h2>Summary</h2>');
    expect(stored).toContain('<strong>Bold</strong>');
    expect(stored).toContain('<ul><li>item</li></ul>');
  });

  it('strips <script> tags entirely', async () => {
    const stored = await setDescription('<p>safe</p><script>alert(1)</script>');
    expect(stored).not.toContain('<script');
    expect(stored).not.toContain('alert(1)');
    expect(stored).toContain('safe');
  });

  it('strips event-handler attributes like onclick/onerror', async () => {
    const stored = await setDescription('<p onclick="alert(1)">click me</p><img src=x onerror="alert(2)">');
    expect(stored).not.toContain('onclick');
    expect(stored).not.toContain('onerror');
  });

  it('strips an external image hotlink', async () => {
    const stored = await setDescription('<img src="https://evil.example.com/tracker.png">text');
    expect(stored).not.toContain('evil.example.com');
    expect(stored).not.toContain('<img');
  });

  it('strips a data: URI image', async () => {
    const stored = await setDescription('<img src="data:image/png;base64,aGVsbG8=">text');
    expect(stored).not.toContain('data:image');
    expect(stored).not.toContain('<img');
  });

  it('strips a javascript: URI image src', async () => {
    const stored = await setDescription('<img src="javascript:alert(1)">text');
    expect(stored).not.toContain('javascript:');
    expect(stored).not.toContain('<img');
  });

  it('rejects a case-images-shaped path with an invalid (non-UUID) id', async () => {
    const stored = await setDescription('<img src="/api/case-images/not-a-real-uuid/raw">text');
    expect(stored).not.toContain('<img');
  });

  it('allows a correctly-shaped case-images path through (existence is not the sanitizer\'s job)', async () => {
    const fakeUuid = '12345678-1234-1234-1234-123456789012';
    const stored = await setDescription(`<img src="/api/case-images/${fakeUuid}/raw" alt="Screenshot">text`);
    expect(stored).toContain(`/api/case-images/${fakeUuid}/raw`);
  });

  it('logs a short plain-text excerpt in the audit trail, not the full HTML', async () => {
    const longHtml = `<p>${'A very long narrative paragraph. '.repeat(20)}</p>`;
    await setDescription(longHtml);

    const auditRes = await request(ctx.httpServer as never)
      .get(`/api/audit/cases/${caseId}`)
      .set(auth(roster.lead.token));
    const descChange = auditRes.body.filter((e: { field: string }) => e.field === 'description').slice(-1)[0];

    expect(descChange.newValue.length).toBeLessThan(longHtml.length);
    expect(descChange.newValue).not.toContain('<p>');
  });
});
