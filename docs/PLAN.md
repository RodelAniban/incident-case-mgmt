# Architecture & Feature Plan (repo reference)

Condensed, in-repo version of the design doc this scaffold implements.

## Architecture

```
Client        Analyst Web Console (React + MUI)
                 |  HTTPS / WSS
Edge          API Gateway  ·  Auth (JWT today, SSO/SAML later)
                 |
Services      Case & Ticketing · Evidence · Chat & Notes · PIR · TI Enrichment · Notifications
                 |
Data          SQLite (WAL) · Local WORM filesystem storage (Phase 2 — see note below) · Search index (later) · Redis (later)
                 |  controlled egress proxy
External      Org SSO/LDAP · SIEM · TI feeds (MISP/TAXII)
```

## Core entities

`Team`, `User` (role, team), `Case` (severity/category/status/assignee/SLA),
`CaseHistoryEntry` (hash-chained audit trail), `EvidenceItem` +
`EvidenceCustodyEntry` + `EvidenceAccessGrant`, `CaseImage`, `ChatMessage`,
`PirReport` (versioned, `ManyToOne` on `Case`) + `PirActionItem`, and reserved
schema for `ThreatIndicator`.

## Access control matrix

| Permission | Analyst L1 | Analyst L2 | IR Lead | CISO/Mgr | Auditor | Admin |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| View assigned cases | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| View all cases | — | — | ✓ | ✓ | ✓ | ✓ |
| Create / edit case | ✓ | ✓ | ✓ | — | — | ✓ |
| Close High/Critical case | — | — | ✓ | ✓ | — | ✓ |
| Upload evidence | ✓ | ✓ | ✓ | — | — | ✓ |
| Download evidence | — | ✓ | ✓ | ✓ | — | ✓ |
| View evidence metadata | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Chat / notes on case | ✓ | ✓ | ✓ | — | — | — |
| Export chat / notes | — | — | ✓ | ✓ | — | ✓ |
| Finalize PIR | — | — | ✓ | ✓ | — | — |
| Approve TI outbound sharing | — | — | — | ✓ | — | — |
| Manage users & roles | — | — | — | — | — | ✓ |
| View audit log | — | — | ✓ | ✓ | ✓ | ✓ |

Enforced in `backend/src/common/permissions.ts` via `PermissionsGuard` on
every route. The frontend copy in `frontend/src/api/types.ts` is UI-gating
only — it decides what to render, not what to allow.

## Roadmap

1. **Foundation** (done) — auth/RBAC, case model, audit log, dashboard
2. **Evidence Management** (done) — AES-256-GCM intake, SHA-256 verified download,
   OS-enforced WORM lock (`chmod 0444`), per-item access grants, custody ledger
3. **Secure Chat & Notes** (done) — real-time per-case chat over WebSocket,
   tagged notes (finding/hypothesis/action-item/hand-off), markdown rendering
   with no links or images (no external egress), audited export
4. **PIR Templates** (done) — 5 fixed sections shared with the narrative editor,
   auto-seeded timeline from case history + evidence, immutable-once-finalized
   versioning, remediation action-item tracker
5. **Threat Intel Integration** — STIX/TAXII ingestion, watchlist matching
6. **Hardening & go-live** — pen test, DR drill, compliance review

Note: the plan's original storage recommendation was MinIO (S3-compatible,
Object Lock). The scaffold uses local filesystem storage with an app-level
WORM lock instead, to avoid standing up an extra service for a single-org
dev scaffold — swap `backend/src/evidence/evidence-storage.util.ts` for an
S3/MinIO-backed implementation before scaling beyond one host.
