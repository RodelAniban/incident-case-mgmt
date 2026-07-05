import * as request from 'supertest';
import { createTestApp, seedRoster, TestAppContext } from './utils/test-app';

describe('smoke: test infrastructure', () => {
  let ctx: TestAppContext;

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  afterAll(async () => {
    await ctx.close();
  });

  it('boots the app and seeds a full role roster', async () => {
    const roster = await seedRoster(ctx);
    expect(roster.admin.token).toBeTruthy();
    expect(roster.analyst1.teamId).toBe(roster.lead.teamId);
  });

  it('rejects unauthenticated requests', async () => {
    const res = await request(ctx.httpServer as never).get('/api/cases');
    expect(res.status).toBe(401);
  });
});
