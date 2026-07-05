# Incident Case Management System

Self-hosted incident case management for a SOC/IR team, built per the
[architecture plan](./docs/PLAN.md). Phases 1–4 are implemented: auth & RBAC,
the core case/ticket model, an immutable audit log, a starter dashboard,
encrypted chain-of-custody-tracked evidence, a rich-text case narrative with
inline images, real-time per-case chat & notes, and versioned post-incident
review reports. Threat-intel integration exists as reserved schema + a
placeholder route, ready to be filled in per the roadmap.

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
| Case Narrative | Implemented — Word-style rich text, sanitized server-side, with encrypted inline images/screenshots |
| Secure Analyst Chat & Notes | Implemented — real-time per-case chat over WebSocket, markdown (no links/images), audited export |
| PIR Templates | Implemented — versioned reports (immutable once finalized), auto-seeded timeline, remediation action-item tracker |
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

## Secure Analyst Chat & Notes

Per-case chat (Case detail → Chat & Notes), delivered in real time over a
NestJS WebSocket gateway (`backend/src/chat/chat.gateway.ts`):

- **Structured notes**: each message can be tagged Finding / Hypothesis /
  Action item / Shift hand-off, matching the plan's spec for structured,
  taggable analyst notes.
- **Markdown, not HTML**: message bodies are stored as plain markdown text —
  there's nothing to sanitize at rest since it's never HTML in the database.
  Rendering runs it through `marked` then a tight DOMPurify allowlist that
  excludes both `<a>` and `<img>`, so links degrade to plain text and images
  vanish entirely. That's `no external egress / no third-party embeds` from
  the plan, enforced structurally rather than by convention.
- **Two distinct permissions, on purpose**: `CHAT_ON_CASE` (L1/L2/Lead) gates
  live viewing and posting; `EXPORT_CHAT_NOTES` (Lead/CISO/Admin) is separate
  — CISO and Admin can't casually browse a live case chat, but can pull a
  plain-text transcript, and doing so writes an entry to the case's audit
  trail (`field: 'chat_export'`), matching the plan's "export requires
  approval and is itself an audited action."
- **Socket auth**: a raw WebSocket connection carries no session. The gateway
  requires an explicit `join {caseId, token}` message, verifies the JWT and
  re-runs the same `CHAT_ON_CASE` + case-team-scope check the REST endpoints
  use, before the socket is added to that case's room — no join, no messages.
- **Known limitation**: no retention/legal-hold engine yet (the plan calls
  for message retention tied to case retention with a legal-hold override) —
  messages persist indefinitely today.

## PIR Templates

Post-incident review lives inside the case detail page too (Case detail →
Post-Incident Review):

- **Five fixed sections** (timeline reconstruction, root cause, detection gap
  analysis, response effectiveness, lessons learned), each edited with the
  same Tiptap/`NarrativeEditor` component the case narrative uses — including
  inline images — rather than a separate rich-text stack.
- **Auto-seeded timeline**: starting a PIR merges the case's audit history and
  evidence collection timestamps into an initial timeline list, so the
  analyst edits a real starting point instead of a blank page. It's a
  one-time seed at creation, not continuously re-synced — later case activity
  won't silently rewrite something the analyst has already edited.
- **Templates by category** (`backend/src/pir/pir-templates.ts`): Phishing,
  Ransomware, Insider Threat, Data Breach, Generic — the five sections don't
  change shape, only the template's framing text does.
- **Two distinct permissions, again on purpose**: `CREATE_EDIT_CASE`
  (L1/L2/Lead/Admin) drafts and edits sections; `FINALIZE_PIR` (Lead/CISO)
  approves. CISO can finalize a report it can't edit a word of — an approval
  role, not an authoring one, consistent with the rest of the matrix.
- **Immutable once finalized, versioned rather than mutated**: `PirReport` is
  `ManyToOne` on `Case`, not `OneToOne` — a case can have several report rows
  over time, one per version. Finalizing freezes that row's sections forever;
  further changes go through `POST /pir/cases/:id/versions` (also
  `FINALIZE_PIR`-gated), which copies the finalized content forward into a
  new draft row rather than editing history. Finalizing writes an audit-trail
  entry (`field: 'pir_finalized'`).
- **Action items stay live after finalization** — remediation tracking
  (owner, due date, done/not-done) is deliberately exempt from the
  immutability rule; only the narrative sections freeze. `owner` is a
  free-text label, not a user lookup, since remediation is often assigned to
  a team or a vendor, not an individual account.
- **Known limitation**: no reminder/notification engine (the plan calls for
  "follow-up reminders") and no formal PIR distribution-list/classification
  restriction beyond normal case-team RBAC scoping.

## Notes for going further

- `synchronize: true` in `backend/src/database/database.module.ts` is a
  scaffold convenience — swap for TypeORM migrations before this holds real
  incident data. It's also not fully reliable across relation-shape changes:
  changing `PirReport.case` from `OneToOne` to `ManyToOne` mid-development
  left a stale `UNIQUE` constraint on `caseId` in SQLite that `synchronize`
  didn't drop, and every insert past the first failed until the dev DB file
  was deleted and reseeded. Expect to do the same after any relation-shape
  change until this moves to real migrations.
- The RBAC matrix lives in `backend/src/common/permissions.ts` and is mirrored
  (read-only, UI-gating purposes) in `frontend/src/api/types.ts`. The API is
  always the enforcement point.
- Evidence upload buffers the whole file in memory (`multer.memoryStorage()`)
  — fine for the scaffold, but real disk images / memory dumps need chunked
  or streamed intake instead.
- `@nestjs/platform-express@10.x` bundles its own `multer@2.0.2`, which has an
  open DoS advisory (deeply-nested multipart field names) only fixed by a
  NestJS v11 major upgrade. `@nestjs/websockets`/`@nestjs/platform-socket.io`
  pull in a similar tier of transitive moderate DoS-class advisories (`qs`,
  `ajv`, `uuid`) via `@nestjs/core`. All of this is low risk for an internal,
  non-public-facing SOC tool, but worth revisiting — likely via a NestJS v11
  upgrade — before any internet-facing deployment.
