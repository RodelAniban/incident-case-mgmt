# Incident Case Management System

Self-hosted incident case management for a SOC/IR team, built per the
[architecture plan](./docs/PLAN.md). All five roadmap phases are implemented:
auth & RBAC, the core case/ticket model, an immutable audit log, a starter
dashboard, encrypted chain-of-custody-tracked evidence, a rich-text case
narrative with inline images, real-time per-case chat & notes, versioned
post-incident review reports, and threat-intelligence integration (feed
import, per-case IOC linking, watchlist matching, TLP-gated outbound-sharing
approval). Phase 6 (hardening & go-live) is underway — the security-hardening
slice (rate limiting, security headers, fail-fast config validation, strict
input validation, TOTP-based MFA gating evidence access, real JWT
revocation on logout), optional Google Sign-In (domain-gated
auto-provisioning, server-verified ID tokens), full User & Role
Administration (create/deactivate accounts, role/team changes, password
resets, team management), and a 123-test backend e2e suite covering every
security-critical property are all done; the pen test / DR drill /
compliance review are inherently exercises against a real deployment rather
than something to code.

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
| User & Role Administration | Implemented — full CRUD: create/deactivate accounts, change role/team, reset passwords, team management |
| Audit log | Implemented — hash-chained, tamper-evident history per case |
| Evidence Management | Implemented — AES-256-GCM encrypted, WORM-locked intake; hash-verified download; append-only custody ledger; per-item access grants |
| Case Narrative | Implemented — Word-style rich text, sanitized server-side, with encrypted inline images/screenshots |
| Secure Analyst Chat & Notes | Implemented — real-time per-case chat over WebSocket, markdown (no links/images), audited export |
| PIR Templates | Implemented — versioned reports (immutable once finalized), auto-seeded timeline, remediation action-item tracker |
| Threat Intelligence Integration | Implemented — feed import, per-case IOC linking + attribution, watchlist matching, TLP-gated outbound-sharing approval |

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

## Threat Intelligence Integration

Unlike Evidence/Narrative/Chat/PIR, this one isn't purely case-scoped — it has
a real global surface (`/threat-intel`) alongside a per-case panel, because
the underlying data (the IOC store, the CISO's approval queue) is
inherently cross-case:

- **Feed import is a normalized upsert, not raw storage**: `POST
  /threat-intel/import` accepts a simplified STIX-like indicator array
  (a real integration would translate an actual STIX 2.1 bundle into this
  shape) and upserts by `(type, value)` — a re-import refreshes confidence,
  TLP, and attribution on the *same* row rather than duplicating it. Restricted
  to Admin — feed configuration is a platform task, not tied to a matrix
  permission, the same "direct role check" pattern already used for evidence
  access-grant management.
- **Watchlist matching, for real**: importing an indicator that's already
  linked to a case creates a `ThreatWatchlistMatch`, surfaced as a banner on
  that case until acknowledged. It's not a toy — I verified it end-to-end
  through the actual UI: link an IOC to a case, re-import fresh intel on that
  same IOC, watch the "New intel on X — already linked to this case" banner
  appear without any manual refresh logic.
- **Attribution linking**: a case's associated threat actors/campaigns are
  computed from its linked indicators' `threatActor`/`campaign` fields, not
  stored redundantly on the case itself.
- **TLP enforced on the way out, not just the way in**: `requestShare()`
  refuses to even create a pending request unless the case is `CLOSED` and
  the indicator is `TLP:CLEAR` or `TLP:GREEN` — `TLP:AMBER`, `AMBER+STRICT`,
  and `RED` are permanently ineligible for outbound sharing, matching what
  those markings actually mean.
- **`APPROVE_TI_SHARING` is CISO-only in the matrix — not even IR Lead has
  it.** That's Phase 1's design, not something added here; this phase is the
  first to actually exercise it. Approving/rejecting writes an audit-trail
  entry (`field: 'ti_share_approved'` / `'ti_share_rejected'`).
- **Known limitation**: no actual outbound delivery. There's no real sharing
  community to push to in a scaffold — approval is the complete, real,
  audited action; the "send it to MISP/whoever" step is a documented gap,
  the same honest trade-off as evidence storage using local WORM instead of
  MinIO.

## User & Role Administration

Replaces the earlier "seed or edit users directly via the backend seed
script" placeholder with a real admin UI (Admin nav → User & Role
Administration), backed by `POST/PATCH /users`, `POST /users/:id/reset-password`,
and `GET/POST /teams` — all `MANAGE_USERS` (Admin-only), per the matrix:

- **Admin never picks a password for someone else.** Creating a user or
  resetting one's password generates a random one server-side and returns
  it exactly once in the API response, for the admin to hand off out of
  band — never emailed, never logged, never retrievable again.
- **Role and team changes take effect on the user's very next request, not
  their next login.** `JwtStrategy` already re-reads the live user row on
  every request (see MFA/JWT-revocation above); it now also returns the
  *current* role/team from that row instead of the JWT's original claims,
  so a promotion or reassignment applies immediately even to a token
  that's already been sitting in someone's browser for hours.
- **Deactivating an account is real, not cosmetic**: it's rejected at the
  next login attempt *and* kills any session the account is mid-use in
  right now. This uses a `sessionVersion` counter embedded in every JWT
  (`sv`) rather than an invalidation timestamp — comparing `iat` against a
  timestamp is racy at 1-second JWT resolution (a reset and a fresh login
  can land in the same wall-clock second); exact integer equality against
  a counter that only ever increments has no such ambiguity. The same
  counter backs password resets.
- **Two hard-coded lockout guards, both in `UsersService.updateUser`**: an
  admin can't change their own role or active status (ask another admin),
  and the last active Admin account can never be deactivated or demoted —
  in practice the self-protection rule alone already guarantees this in
  sequential use (there's no "someone else" to act on if you're the only
  admin), but the count check is cheap defense-in-depth against a
  narrow concurrent-request race and against this invariant surviving
  future changes to the self-protection rule.
- **No accounts are ever hard-deleted.** `CaseHistoryEntry.actor`,
  `EvidenceCustodyEntry.actor`, and similar FKs point at users throughout
  the case history — deleting a row would either cascade-destroy audit
  history or leave it pointing nowhere. Disabling (`isActive: false`)
  is the only removal path, matching how real incident-response tooling
  has to preserve "who did this" forever.
- **Found and fixed while building this**: `GET /users` (and the new
  create/update endpoints) were leaking `mfaSecretCiphertext`/`Iv`/`AuthTag`
  and the session counter, because the original handler stripped only
  `passwordHash` by name via object spread — which silently stops
  protecting a field the moment `@Exclude()` is the only thing guarding it
  server-side. Fixed with an explicit allow-list (`toSafeUser` in
  `users.service.ts`) instead of a block-list, and turned into a permanent
  regression test (`security.e2e-spec.ts`) that checks the whole sensitive
  set, not just the one field that was already handled.
- **Known limitation**: no persisted audit trail for admin actions
  themselves (role changes, deactivations, password resets) — only
  case-scoped actions get the hash-chained ledger described above. These
  actions are logged via the server's own process logs, not a queryable,
  tamper-evident record. Building that would mean a second, parallel audit
  system (case history is intentionally case-scoped), which felt like a
  separate feature rather than part of "admin CRUD."

## Security Hardening (Phase 6, in progress)

- **Rate limiting**: a global ceiling (100 req/min/IP via `@nestjs/throttler`)
  plus a much stricter override on `POST /auth/login` (5/min/IP). The login
  limit is per-IP, not per-account — it doesn't leak whether a given email
  exists by behaving differently, and one attacker can't route around it by
  cycling through account names.
- **Security headers via `helmet`**: `X-Powered-By` is gone, `X-Frame-Options`,
  `X-Content-Type-Options`, `Strict-Transport-Security`, and friends are set.
  One deliberate override: `crossOriginResourcePolicy: 'cross-origin'` —
  helmet's `same-origin` default would have silently broken every inline
  image embed and evidence download, since the frontend and API are
  different origins by design here and access control already happens via
  the unguessable UUID / JWT check, not the browser's same-origin policy.
- **Fail-fast startup validation** (`backend/src/common/startup-validation.util.ts`):
  when `NODE_ENV=production`, the app refuses to boot if `JWT_SECRET` is
  still the scaffold default (or under 32 characters) or
  `EVIDENCE_ENCRYPTION_KEY` is missing/malformed — instead of the previous
  behavior, where a misconfigured production instance would run fine until
  the first evidence upload threw at request time. In development it just
  warns.
- **`forbidNonWhitelisted` on the global `ValidationPipe`**: a request body
  carrying a field no DTO declares is now rejected (400) instead of silently
  stripped — verified with `{"...", "isAdmin": true}` against case creation,
  which now correctly 400s instead of quietly ignoring the extra field.
- **`npm audit fix` run on both apps**: nothing was fixable without a major
  version bump (`@nestjs/cli@11`, `@nestjs/typeorm@11`, `vite@8`) — the
  remaining advisories are the same transitive, DoS-class, low-risk-for-an-
  internal-tool ones already called out below.
- **MFA (TOTP) gating evidence access**: `POST /auth/mfa/setup` generates a
  secret (`otplib`) encrypted at rest with the same AES-256-GCM key as
  evidence/case-images, returns a QR code (`qrcode`) for the user's
  authenticator app; `POST /auth/mfa/verify` confirms enrollment with a real
  code before `User.mfaEnabled` ever flips true — an abandoned setup can't
  accidentally lock an account into two-step login. Once enabled, `POST
  /auth/login` stops short of a real session and returns a short-lived
  `mfaToken` instead; `POST /auth/mfa/login-verify` exchanges a valid code
  for the actual `accessToken`. `MfaRequiredGuard`
  (`backend/src/common/guards/mfa-required.guard.ts`) then gates the two
  endpoints that actually touch evidence content — upload and download —
  checked against the live DB row, not a JWT claim, so enabling/disabling
  mid-session takes effect immediately without a fresh login. Disabling MFA
  itself requires a valid code, not just an authenticated session — a
  stolen-but-unlocked token can't turn MFA off on its own. Manage it under
  the account-security icon (🔒) in the top bar.
- **Real JWT revocation on logout**: every issued token now carries a random
  `jti`; `POST /auth/logout` records that `jti` in a `RevokedToken` table
  (pruned lazily on each write once its own token would have expired anyway,
  so it never grows unbounded), and `JwtStrategy` rejects any request
  bearing a revoked `jti`. Revocation is per-token, not per-account — logging
  out in one tab doesn't invalidate a session open in another. Previously,
  logout only cleared the browser's local storage; a copied bearer token
  stayed valid until its natural expiry regardless.

## Google Sign-In (SSO)

Optional — disabled unless configured (`GOOGLE_CLIENT_ID`/`VITE_GOOGLE_CLIENT_ID`,
see both `.env.example` files). Not part of the original 6-phase roadmap
(the plan only ever said "SSO/SAML later") — added as its own slice on top:

- **The backend never trusts a client-asserted email.** The frontend
  ("Sign in with Google" via `@react-oauth/google`, Google's own Identity
  Services widget) only ever hands the API a Google-issued ID token;
  `POST /auth/google` verifies it server-side with `google-auth-library`
  against `GOOGLE_CLIENT_ID` before looking at anything inside it, and
  rejects tokens where Google hasn't itself verified the email
  (`email_verified`).
- **Existing accounts can always sign in this way** if the verified email
  matches — SSO is just an alternate credential, not a separate identity.
  It reuses the exact same `login()` the password flow calls, so an account
  with MFA enabled still gets the same two-step challenge afterward
  (`mfaRequired`/`mfaToken`) — which credential got you there doesn't change
  what evidence access requires.
- **A brand-new email only auto-provisions on an allow-listed domain**
  (`GOOGLE_SSO_ALLOWED_DOMAIN`, comma-separated). Checked against the
  verified email's own domain suffix rather than Google's `hd` claim,
  deliberately — personal Gmail accounts never carry an `hd` claim at all
  (only Workspace-managed ones do), so `hd` alone can't support "allow any
  @gmail.com account," which is a real, intended use of this feature, not
  just enterprise Workspace SSO. Auto-provisioned accounts get `Analyst L1`
  with no team — the lowest-privilege role in the matrix — and get a
  random, never-surfaced password (satisfies the `passwordHash` column;
  nobody's meant to ever use it). An Admin still has to assign a real
  team/role before the account is useful for much.
- **An email outside the allow-list, with no existing account, gets a clear
  403** ("ask an admin to create an account first") rather than either
  silently failing or auto-creating an unintended account.
- **Deliberate exception to this app's no-external-egress stance**: loading
  Google's Identity Services script is the one place this app talks to a
  third party by design — SSO inherently requires it. The
  `GoogleOAuthProvider` wrapper (`frontend/src/main.tsx`) is only mounted
  when `VITE_GOOGLE_CLIENT_ID` is set, so a deployment that doesn't want
  Google involved at all never loads that script.

## Automated Test Suite

Every security-critical property that was previously verified manually
per-session (via throwaway curl/Playwright scripts that didn't persist) is
now encoded as a permanent Jest e2e suite:

```bash
cd backend
npm run test:e2e
```

123 tests across 14 spec files (`backend/test/*.e2e-spec.ts`), all boot a real
Nest app (`test/utils/test-app.ts`) — real guards, real TypeORM, real
AES-256-GCM crypto — against an isolated in-memory SQLite DB and a per-test
temp directory for evidence/case-image blobs, rather than mocking anything
security-relevant:

- **`configureApp()` is shared** between `main.ts` and the test bootstrap
  (`backend/src/common/configure-app.ts`) — helmet, `forbidNonWhitelisted`,
  and the passwordHash-stripping serializer interceptor are wired up exactly
  once, so the suite can't silently drift into testing a stricter or looser
  app than what's actually deployed.
- **`rbac.e2e-spec.ts`** encodes the full access-control matrix from
  `docs/PLAN.md` as data-driven assertions (8 actions × 6 roles).
- **`evidence.e2e-spec.ts`** includes a real tamper-detection test: it flips
  a byte in the WORM-locked ciphertext on disk and asserts download fails
  closed (500), plus a WORM permission check (`0o444`) and the full per-item
  access-grant lifecycle (grant, use, revoke, leadership bypass).
- **`chat.e2e-spec.ts`** opens a real Socket.IO connection via
  `socket.io-client` against a listening server and confirms a message
  posted over REST arrives over the socket — not just that the REST side
  works.
- **`case-narrative.e2e-spec.ts`** confirms the sanitizer actually strips
  `<script>` tags, event handlers, and external/`data:`/`javascript:` image
  sources, not just that safe formatting round-trips.
- **`threat-intel.e2e-spec.ts`** and **`security.e2e-spec.ts`** cover the
  TLP-gated share-request lifecycle end-to-end and cross-cutting properties
  (mass-assignment rejection, no `passwordHash`/evidence-internals leakage,
  security headers present) respectively.
- **`mfa.e2e-spec.ts`** drives the real TOTP lifecycle — computing actual
  codes with `otplib` rather than stubbing verification — through enrollment,
  wrong-code rejection, the two-step login exchange, disable, and the
  evidence-upload 403 with its actionable message before enrollment. The
  shared `enableMfaForActor()` test helper (`test/utils/test-app.ts`) drives
  the same real setup→verify flow so `evidence.e2e-spec.ts` and
  `security.e2e-spec.ts` exercise `MfaRequiredGuard` for real instead of
  stubbing `mfaEnabled` directly into the DB.
- **`auth.e2e-spec.ts`**'s `logout / token revocation` block confirms a
  logged-out token is rejected on its very next request, and that revoking
  one token doesn't affect a second, independently-issued token for the same
  user — proving revocation is per-token, not an accidental per-account
  ban.
- **`google-sso.e2e-spec.ts`** stubs only the one boundary that would
  otherwise require a real signed credential and live internet access —
  `OAuth2Client.prototype.verifyIdToken` — and exercises everything
  downstream for real: existing-user login, MFA-after-SSO via the same
  `login()` password auth uses, the `email_verified` check, domain-gated
  auto-provisioning (and its rejection), and that re-authenticating with the
  same Google identity logs into the same account rather than creating a
  second one.
- **`users-admin.e2e-spec.ts`** covers the full admin CRUD lifecycle:
  Admin-only gating across every endpoint, a generated password that
  actually logs in, duplicate-email/duplicate-team rejection, a role+team
  change applying to an already-issued token's very next request (proving
  `JwtStrategy` reads the live row, not the JWT claim), self-lockout
  prevention, and — the two properties easiest to get wrong — that
  deactivating a user kills a session they're already using (not just
  future logins) and that a password reset does the same via the
  `sessionVersion` counter.
- Rate limiting is disabled for the suite via an env flag read at
  `AppModule` decoration time (`DISABLE_THROTTLING`, set in
  `test/env-setup.ts`) — seeding six fixture users per spec file would
  otherwise trip the same 5/min login throttle real traffic hits. The
  throttle's own config is still checked, via a decorator-metadata
  assertion in `auth.e2e-spec.ts`.
- **Not covered**: the frontend has no automated tests yet — this suite is
  backend-only, since that's where the system's actual security-critical
  properties (RBAC, encryption, sanitization, immutability, TLP gating)
  live; frontend tests would mostly confirm buttons render.

## Notes for going further

- `synchronize: true` in `backend/src/database/database.module.ts` is a
  scaffold convenience — swap for TypeORM migrations before this holds real
  incident data. It's also not fully reliable across relation-shape changes:
  changing `PirReport.case` from `OneToOne` to `ManyToOne` mid-development
  left a stale `UNIQUE` constraint on `caseId` in SQLite that `synchronize`
  didn't drop, and every insert past the first failed until the dev DB file
  was deleted and reseeded. Expect to do the same after any relation-shape
  change until this moves to real migrations.
- **TypeORM relations you don't list in `relations: [...]` are `undefined`,
  silently.** `ThreatIntelService.importIndicators` originally queried
  `CaseThreatIndicator` rows without `relations: ['case']`, then built a
  `ThreatWatchlistMatch` from `link.case` — which was `undefined`. No
  exception; SQLite (without FK enforcement) just saved a match row pointing
  nowhere, and the endpoint reported `matched: 1` for a match that then
  couldn't be found in any case's list. If a query result gets its relation
  accessed a few lines later, check `relations: [...]` on that exact query —
  the same object shape from a *different* query with `relations` set won't
  save you.
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
