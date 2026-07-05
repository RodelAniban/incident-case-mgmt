import * as request from 'supertest';
import { Role } from '../src/common/roles.enum';
import { auth, createCase, createTestApp, createUserAndLogin, seedRoster, TestAppContext, TestRoster } from './utils/test-app';

describe('cases', () => {
  let ctx: TestAppContext;
  let roster: TestRoster;

  beforeAll(async () => {
    ctx = await createTestApp();
    roster = await seedRoster(ctx);
  });

  afterAll(async () => {
    await ctx.close();
  });

  it('generates a case number in the INC-YYYY-NNNN shape', async () => {
    const kase = await createCase(ctx, roster.analyst1.token, roster.analyst1.teamId!);
    expect(kase.caseNumber).toMatch(/^INC-\d{4}-\d{4}$/);
  });

  it('records a field-level audit trail entry on update', async () => {
    const kase = await createCase(ctx, roster.analyst1.token, roster.analyst1.teamId!, { title: 'Original title' });

    await request(ctx.httpServer as never)
      .patch(`/api/cases/${kase.id}`)
      .set(auth(roster.analyst1.token))
      .send({ title: 'Updated title' })
      .expect(200);

    const auditRes = await request(ctx.httpServer as never)
      .get(`/api/audit/cases/${kase.id}`)
      .set(auth(roster.lead.token));

    const titleChange = auditRes.body.find((e: { field: string }) => e.field === 'title');
    expect(titleChange.oldValue).toBe('Original title');
    expect(titleChange.newValue).toBe('Updated title');
  });

  it('lets an Analyst L1 close a low-severity case (CREATE_EDIT_CASE is enough)', async () => {
    const kase = await createCase(ctx, roster.analyst1.token, roster.analyst1.teamId!, { severity: 'low' });
    const res = await request(ctx.httpServer as never)
      .patch(`/api/cases/${kase.id}`)
      .set(auth(roster.analyst1.token))
      .send({ status: 'closed' });
    expect(res.status).toBe(200);
  });

  it('blocks an Analyst L1 from closing a high-severity case (needs CLOSE_HIGH_CRITICAL_CASE)', async () => {
    const kase = await createCase(ctx, roster.analyst1.token, roster.analyst1.teamId!, { severity: 'high' });
    const res = await request(ctx.httpServer as never)
      .patch(`/api/cases/${kase.id}`)
      .set(auth(roster.analyst1.token))
      .send({ status: 'closed' });
    expect(res.status).toBe(403);
  });

  it('scopes an Analyst to their own team — a different team\'s case is invisible, not just unlisted', async () => {
    const outsider = await createUserAndLogin(ctx, {
      email: 'outsider@test.local',
      name: 'Outsider',
      role: Role.ANALYST_L1,
      teamName: 'Red Team',
    });
    const kase = await createCase(ctx, roster.analyst1.token, roster.analyst1.teamId!);

    const res = await request(ctx.httpServer as never)
      .get(`/api/cases/${kase.id}`)
      .set(auth(outsider.token));
    expect(res.status).toBe(403);
  });

  it('lets a Lead (VIEW_ALL_CASES) see a case from a different team', async () => {
    const outsider = await createUserAndLogin(ctx, {
      email: 'outsider2@test.local',
      name: 'Outsider Two',
      role: Role.ANALYST_L1,
      teamName: 'Green Team',
    });
    const kase = await createCase(ctx, outsider.token, outsider.teamId!);

    // Sanity check this actually crosses a team boundary, not a same-team fluke.
    expect(outsider.teamId).not.toBe(roster.lead.teamId);

    const res = await request(ctx.httpServer as never)
      .get(`/api/cases/${kase.id}`)
      .set(auth(roster.lead.token));
    expect(res.status).toBe(200);
  });
});
