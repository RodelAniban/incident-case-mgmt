# Incident Case Management System

Self-hosted incident case management for a SOC/IR team. This is the Phase 1
("Foundation") slice of the [architecture plan](./docs/PLAN.md): auth & RBAC,
the core case/ticket model, an immutable audit log, and a starter dashboard.
Evidence, chat, PIR, and threat-intel modules exist as reserved schema +
placeholder routes, ready to be filled in per the roadmap.

## Stack

- **Backend**: NestJS + TypeORM, SQLite (WAL-mode, single file, zero ops)
- **Frontend**: React + TypeScript + Material UI (MUI), Vite

## Getting started

### 1. Backend

```bash
cd backend
cp .env.example .env
npm install        # already run if you used the scaffold script
npm run seed        # creates demo teams, one user per role, three sample cases
npm run start:dev
```

API listens on `http://localhost:3000/api`.

Demo accounts (password `ChangeMe123!` for all):

| Role            | Email                  |
|-----------------|------------------------|
| Analyst L1      | analyst1@example.com   |
| Analyst L2      | analyst2@example.com   |
| IR Lead         | lead@example.com       |
| CISO / Manager  | ciso@example.com       |
| Auditor         | auditor@example.com    |
| Admin           | admin@example.com      |

### 2. Frontend

```bash
cd frontend
cp .env.example .env
npm install        # already run if you used the scaffold script
npm run dev
```

App runs on `http://localhost:5173`. Log in with any demo account above to
see role-scoped navigation and data.

## What's implemented vs. reserved

| Module | Status |
|---|---|
| Dashboard | Implemented — KPI summary + recent cases, scoped by role |
| Incident Ticketing | Implemented — create/list/update, field-level audit trail |
| Access control (RBAC) | Implemented — role → permission matrix enforced on every route |
| Audit log | Implemented — hash-chained, tamper-evident history per case |
| Evidence Management | Schema + stub route only (Phase 2) |
| Secure Analyst Chat & Notes | Schema + stub route only (Phase 3) |
| PIR Templates | Schema + stub route only (Phase 4) |
| Threat Intelligence Integration | Schema + stub route only (Phase 5) |

## Notes for going further

- `synchronize: true` in `backend/src/database/database.module.ts` is a
  scaffold convenience — swap for TypeORM migrations before this holds real
  incident data.
- The RBAC matrix lives in `backend/src/common/permissions.ts` and is mirrored
  (read-only, UI-gating purposes) in `frontend/src/api/types.ts`. The API is
  always the enforcement point.
