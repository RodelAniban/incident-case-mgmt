import { NestFactory } from '@nestjs/core';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppModule } from '../app.module';
import { RequestUser } from '../cases/cases.service';
import { CasesService } from '../cases/cases.service';
import { Role } from '../common/roles.enum';
import { Case, CaseCategory, CaseSeverity } from '../entities/case.entity';
import { UsersService } from '../users/users.service';

const DEMO_PASSWORD = 'ChangeMe123!';

async function seed() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const usersService = app.get(UsersService);
  const casesService = app.get(CasesService);
  const casesRepo = app.get<Repository<Case>>(getRepositoryToken(Case));

  const demoUsers = [
    { email: 'analyst1@example.com', name: 'Ana Reyes', role: Role.ANALYST_L1, teamName: 'Blue Team Alpha' },
    { email: 'analyst2@example.com', name: 'Marco Diaz', role: Role.ANALYST_L2, teamName: 'Blue Team Alpha' },
    { email: 'lead@example.com', name: 'Priya Nair', role: Role.IR_LEAD, teamName: 'Blue Team Alpha' },
    { email: 'ciso@example.com', name: 'Daniel Cho', role: Role.CISO_MANAGER, teamName: 'Leadership' },
    { email: 'auditor@example.com', name: 'Grace Lim', role: Role.AUDITOR, teamName: 'Compliance' },
    { email: 'admin@example.com', name: 'System Admin', role: Role.ADMIN, teamName: 'Platform' },
  ] as const;

  const users: Record<string, Awaited<ReturnType<typeof usersService.createUser>>> = {};
  for (const u of demoUsers) {
    const existing = await usersService.findByEmail(u.email);
    users[u.email] = existing ?? (await usersService.createUser({ ...u, password: DEMO_PASSWORD }));
  }

  const existingCaseCount = await casesRepo.count();
  if (existingCaseCount === 0) {
    const analyst1 = users['analyst1@example.com'];
    const lead = users['lead@example.com'];
    const actor: RequestUser = {
      userId: lead.id,
      email: lead.email,
      role: lead.role,
      teamId: lead.team?.id ?? null,
    };

    const sampleCases = [
      {
        title: 'Suspected phishing — finance distribution list',
        severity: CaseSeverity.HIGH,
        category: CaseCategory.PHISHING,
        teamId: analyst1.team!.id,
        assigneeId: analyst1.id,
      },
      {
        title: 'Anomalous outbound transfer from DB-07',
        severity: CaseSeverity.CRITICAL,
        category: CaseCategory.DATA_EXFILTRATION,
        teamId: analyst1.team!.id,
        assigneeId: lead.id,
      },
      {
        title: 'Unmanaged device observed on corporate VLAN',
        severity: CaseSeverity.LOW,
        category: CaseCategory.OTHER,
        teamId: analyst1.team!.id,
        assigneeId: analyst1.id,
      },
    ];

    for (const c of sampleCases) {
      await casesService.create(c, actor);
    }
  }

  // eslint-disable-next-line no-console
  console.log(`Seed complete. Demo users share the password "${DEMO_PASSWORD}":`);
  demoUsers.forEach((u) => console.log(`  ${u.role.padEnd(14)} ${u.email}`));

  await app.close();
}

seed().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Seed failed:', err);
  process.exit(1);
});
