import * as request from 'supertest';
import { auth, createCase, createTestApp, seedRoster, TestAppContext, TestRoster } from './utils/test-app';

/**
 * Encodes the access control matrix from docs/PLAN.md as executable
 * assertions. Deliberately loose on the "allowed" side: it only asserts the
 * response is NOT 403, not that it's 2xx — a 404/409 from business logic
 * further down the stack still proves the permission gate let the request
 * through, without needing full fixture setup for every single row. Rows
 * with additional business rules layered on top of the base permission
 * (e.g. evidence's per-item access grants) are covered in their own spec
 * files instead, to avoid conflating two different reasons for a 403 here.
 */
describe('RBAC matrix', () => {
  let ctx: TestAppContext;
  let roster: TestRoster;
  let caseId: number;
  let highSeverityCaseId: number;
  let pirReportId: number;

  const ALL_ROLES: Array<keyof TestRoster> = ['analyst1', 'analyst2', 'lead', 'ciso', 'auditor', 'admin'];

  beforeAll(async () => {
    ctx = await createTestApp();
    roster = await seedRoster(ctx);
    const teamId = roster.lead.teamId!;

    caseId = (await createCase(ctx, roster.lead.token, teamId)).id;
    highSeverityCaseId = (await createCase(ctx, roster.lead.token, teamId, { severity: 'critical' })).id;

    const pirRes = await request(ctx.httpServer as never)
      .post(`/api/pir/cases/${caseId}`)
      .set(auth(roster.lead.token))
      .send({ templateId: 'generic' });
    pirReportId = pirRes.body.id;
  });

  afterAll(async () => {
    await ctx.close();
  });

  interface MatrixRow {
    action: string;
    allowedRoles: Array<keyof TestRoster>;
    request: (role: keyof TestRoster) => request.Test;
  }

  const rows: MatrixRow[] = [
    {
      action: 'create case (CREATE_EDIT_CASE)',
      allowedRoles: ['analyst1', 'analyst2', 'lead', 'admin'],
      request: (role) =>
        request(ctx.httpServer as never)
          .post('/api/cases')
          .set(auth(roster[role].token))
          .send({ title: 'RBAC probe', severity: 'low', category: 'other', teamId: roster.lead.teamId }),
    },
    {
      action: 'close a critical-severity case (CLOSE_HIGH_CRITICAL_CASE)',
      allowedRoles: ['lead', 'ciso', 'admin'],
      request: (role) =>
        request(ctx.httpServer as never)
          .patch(`/api/cases/${highSeverityCaseId}`)
          .set(auth(roster[role].token))
          .send({ status: 'closed' }),
    },
    {
      action: 'view live chat (CHAT_ON_CASE)',
      allowedRoles: ['analyst1', 'analyst2', 'lead'],
      request: (role) =>
        request(ctx.httpServer as never)
          .get(`/api/chat/cases/${caseId}/messages`)
          .set(auth(roster[role].token)),
    },
    {
      action: 'export chat transcript (EXPORT_CHAT_NOTES)',
      allowedRoles: ['lead', 'ciso', 'admin'],
      request: (role) =>
        request(ctx.httpServer as never)
          .get(`/api/chat/cases/${caseId}/export`)
          .set(auth(roster[role].token)),
    },
    {
      action: 'finalize a PIR report (FINALIZE_PIR)',
      allowedRoles: ['lead', 'ciso'],
      request: (role) =>
        request(ctx.httpServer as never)
          .post(`/api/pir/reports/${pirReportId}/finalize`)
          .set(auth(roster[role].token)),
    },
    {
      action: 'approve TI outbound sharing (APPROVE_TI_SHARING)',
      allowedRoles: ['ciso'],
      request: (role) =>
        request(ctx.httpServer as never)
          .post('/api/threat-intel/share-requests/999999/approve')
          .set(auth(roster[role].token))
          .send({}),
    },
    {
      action: 'list users (MANAGE_USERS)',
      allowedRoles: ['admin'],
      request: (role) =>
        request(ctx.httpServer as never)
          .get('/api/users')
          .set(auth(roster[role].token)),
    },
    {
      action: "view a case's audit log (VIEW_AUDIT_LOG)",
      allowedRoles: ['lead', 'ciso', 'auditor', 'admin'],
      request: (role) =>
        request(ctx.httpServer as never)
          .get(`/api/audit/cases/${caseId}`)
          .set(auth(roster[role].token)),
    },
  ];

  describe.each(rows)('$action', ({ allowedRoles, request: makeRequest }) => {
    it.each(ALL_ROLES)('role: %s', async (role) => {
      const res = await makeRequest(role);
      if (allowedRoles.includes(role)) {
        expect(res.status).not.toBe(403);
      } else {
        expect(res.status).toBe(403);
      }
    });
  });
});
