# Incident Case Management System

Self-hosted incident case management for a SOC/IR team, built per the
[architecture plan](./docs/PLAN.md). Phase 1 (Foundation) and Phase 2
(Evidence Management) are implemented: auth & RBAC, the core case/ticket
model, an immutable audit log, a starter dashboard, and encrypted,
chain-of-custody-tracked evidence intake. Chat, PIR, and threat-intel
modules exist as reserved schema + placeholder routes, ready to be filled
in per the roadmap.

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
| Evidence Management | Implemented — AES-256-GCM encrypted, WORM-locked intake; hash-verified download; append-only custody ledger; per-item access grants |
| Secure Analyst Chat & Notes | Schema + stub route only (Phase 3) |
| PIR Templates | Schema + stub route only (Phase 4) |
| Threat Intelligence Integration | Schema + stub route only (Phase 5) |

## Evidence Management

Evidence lives inside a case (Case detail page → Evidence panel), not as a
standalone section:

- **Intake**: upload computes a SHA-256 of the plaintext, encrypts it with
  AES-256-GCM (key from `EVIDENCE_ENCRYPTION_KEY`), writes the ciphertext to
  `EVIDENCE_STORAGE_DIR`, then `chmod`s it `0444` — a real, OS-enforced
  write-once original, not just an app-level promise.
- **Download**: requires a logged reason. The blob is decrypted, GCM's
  built-in auth tag is checked (catches tampering before anything else runs),
  then the SHA-256 is re-verified against the original. Any mismatch fails
  closed with a 500, never silently serves altered content.
- **Per-item access**: being on the case team isn't enough. Analyst L2 can
  only download evidence they collected themselves, or an item an IR Lead /
  CISO / Admin has explicitly granted them. Leadership roles retain
  unconditional oversight access. Every grant, revoke, and download is
  recorded in the custody ledger (`EvidenceCustodyEntry`).

## Case Narrative

The case detail page has a rich-text "Narrative" field (Case detail → Edit),
with a Word-style toolbar (paragraph styles, bold/italic/underline/strike,
lists, blockquote) plus inline images:

- **Formatting**: edited with Tiptap, sanitized server-side
  (`backend/src/cases/sanitize-narrative.util.ts`) against a strict tag/attribute
  allowlist before it's ever stored — pasting a `<script>` tag or an `onerror`
  handler gets stripped, not escaped-and-displayed.
- **Inline images**: insert via the toolbar, drag-and-drop, or paste directly
  from the clipboard (the same gesture as pasting a screenshot into Word).
  Images are encrypted at rest (same AES-256-GCM as evidence, now shared via
  `backend/src/common/encryption.util.ts`) and served from a random-UUID
  `publicId` rather than a sequential id.
- **Why the image endpoint has no auth guard**: a plain `<img src>` can't send
  an `Authorization` header, so `GET /api/case-images/:publicId/raw` is
  deliberately public — access control is the UUID being unguessable, handed
  out only via the authenticated upload endpoint to users who could already
  edit the case. This is weaker than the evidence access-grant model on
  purpose: these are narrative illustrations, not chain-of-custody evidence.
  The sanitizer only ever allows `<img>` src values matching
  `/api/case-images/<uuid>/raw` (any host) — external hotlinks, `data:` URIs,
  and `javascript:` URIs are all rejected, closing off the obvious abuse of a
  more permissive image allowlist (tracking pixels, XSS via crafted src).
- **Known limitation**: deleting an image out of the narrative doesn't delete
  its stored blob — there's no garbage collection pass in this scaffold.

## Notes for going further

- `synchronize: true` in `backend/src/database/database.module.ts` is a
  scaffold convenience — swap for TypeORM migrations before this holds real
  incident data.
- The RBAC matrix lives in `backend/src/common/permissions.ts` and is mirrored
  (read-only, UI-gating purposes) in `frontend/src/api/types.ts`. The API is
  always the enforcement point.
- Evidence upload buffers the whole file in memory (`multer.memoryStorage()`)
  — fine for the scaffold, but real disk images / memory dumps need chunked
  or streamed intake instead.
- `@nestjs/platform-express@10.x` bundles its own `multer@2.0.2`, which has an
  open DoS advisory (deeply-nested multipart field names) only fixed by a
  NestJS v11 major upgrade. Low risk for an internal, non-public-facing SOC
  tool, but worth revisiting before any internet-facing deployment.
