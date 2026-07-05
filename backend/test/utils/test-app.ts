import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';
import { configureApp } from '../../src/common/configure-app';
import { Role } from '../../src/common/roles.enum';
import { UsersService } from '../../src/users/users.service';

export interface TestAppContext {
  app: INestApplication;
  httpServer: unknown;
  baseUrl: string;
  usersService: UsersService;
  close: () => Promise<void>;
}

/**
 * Boots a full app instance — real guards, real TypeORM, real crypto — against
 * an isolated in-memory SQLite DB and a per-test temp directory for evidence /
 * case-image blob storage. Shares configureApp() with main.ts's bootstrap()
 * so tests exercise the exact same middleware stack production requests go
 * through, instead of a hand-copied approximation that can drift out of sync.
 *
 * Rate limiting is disabled globally for the whole suite (via
 * DISABLE_THROTTLING, set in test/env-setup.ts and read by AppModule) — the
 * suite logs in many fixture users per run, which would otherwise trip the
 * same 5/min login throttle real traffic would. The throttle config itself
 * is still covered, via a metadata check in auth.e2e-spec.ts.
 */
export async function createTestApp(options: { listen?: boolean } = {}): Promise<TestAppContext> {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'icms-test-'));

  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'test-jwt-secret-not-for-production-use-only-in-ci-runs';
  process.env.JWT_EXPIRES_IN = '1h';
  process.env.DB_PATH = ':memory:';
  process.env.CORS_ORIGIN = 'http://localhost:5173';
  process.env.EVIDENCE_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString('base64');
  process.env.EVIDENCE_STORAGE_DIR = path.join(tmpDir, 'evidence');
  process.env.CASE_IMAGE_STORAGE_DIR = path.join(tmpDir, 'case-images');

  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();

  const app = moduleRef.createNestApplication();
  configureApp(app);
  app.enableCors({ origin: process.env.CORS_ORIGIN });

  let baseUrl = '';
  if (options.listen) {
    const { IoAdapter } = await import('@nestjs/platform-socket.io');
    app.useWebSocketAdapter(new IoAdapter(app));
    await app.listen(0);
    const address = app.getHttpServer().address();
    baseUrl = `http://127.0.0.1:${address.port}`;
  } else {
    await app.init();
  }

  return {
    app,
    httpServer: app.getHttpServer(),
    baseUrl,
    usersService: app.get(UsersService),
    close: async () => {
      await app.close();
      fs.rmSync(tmpDir, { recursive: true, force: true });
    },
  };
}

export const TEST_PASSWORD = 'TestPassword123!';

export interface TestActor {
  token: string;
  userId: number;
  email: string;
  teamId: number | null;
}

export async function createUserAndLogin(
  ctx: TestAppContext,
  params: { email: string; name: string; role: Role; teamName?: string },
): Promise<TestActor> {
  const user = await ctx.usersService.createUser({ ...params, password: TEST_PASSWORD });
  const res = await request(ctx.httpServer as never)
    .post('/api/auth/login')
    .send({ email: params.email, password: TEST_PASSWORD });
  if (res.status !== 201) {
    throw new Error(`Fixture login failed for ${params.email}: ${JSON.stringify(res.body)}`);
  }
  return { token: res.body.accessToken, userId: user.id, email: user.email, teamId: user.team?.id ?? null };
}

export interface TestRoster {
  analyst1: TestActor;
  analyst2: TestActor;
  lead: TestActor;
  ciso: TestActor;
  auditor: TestActor;
  admin: TestActor;
}

/**
 * One user per role, mirroring backend/src/database/seed.ts, all logged in
 * and ready to use. Sequential on purpose: three of these share a team name,
 * and UsersService's find-or-create-team logic isn't concurrency-safe — two
 * parallel calls can both see "no team yet" and both try to insert it,
 * tripping the team name's unique constraint.
 */
export async function seedRoster(ctx: TestAppContext): Promise<TestRoster> {
  const analyst1 = await createUserAndLogin(ctx, { email: 'analyst1@test.local', name: 'Ana Test', role: Role.ANALYST_L1, teamName: 'Blue Team' });
  const analyst2 = await createUserAndLogin(ctx, { email: 'analyst2@test.local', name: 'Marco Test', role: Role.ANALYST_L2, teamName: 'Blue Team' });
  const lead = await createUserAndLogin(ctx, { email: 'lead@test.local', name: 'Priya Test', role: Role.IR_LEAD, teamName: 'Blue Team' });
  const ciso = await createUserAndLogin(ctx, { email: 'ciso@test.local', name: 'Daniel Test', role: Role.CISO_MANAGER, teamName: 'Leadership' });
  const auditor = await createUserAndLogin(ctx, { email: 'auditor@test.local', name: 'Grace Test', role: Role.AUDITOR, teamName: 'Compliance' });
  const admin = await createUserAndLogin(ctx, { email: 'admin@test.local', name: 'Sys Test', role: Role.ADMIN, teamName: 'Platform' });
  return { analyst1, analyst2, lead, ciso, auditor, admin };
}

export function auth(token: string) {
  return { Authorization: `Bearer ${token}` };
}

export async function createCase(
  ctx: TestAppContext,
  token: string,
  teamId: number,
  overrides: Partial<{ title: string; severity: string; category: string }> = {},
): Promise<{ id: number; caseNumber: string }> {
  const res = await request(ctx.httpServer as never)
    .post('/api/cases')
    .set(auth(token))
    .send({
      title: overrides.title ?? 'Test case',
      severity: overrides.severity ?? 'medium',
      category: overrides.category ?? 'other',
      teamId,
    });
  if (res.status !== 201) {
    throw new Error(`Fixture case creation failed: ${JSON.stringify(res.body)}`);
  }
  return { id: res.body.id, caseNumber: res.body.caseNumber };
}
