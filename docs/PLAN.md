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
Data          SQLite (WAL) · Object storage (WORM, Phase 2) · Search index (later) · Redis (later)
                 |  controlled egress proxy
External      Org SSO/LDAP · SIEM · TI feeds (MISP/TAXII)
```

## Core entities

`Team`, `User` (role, team), `Case` (severity/category/status/assignee/SLA),
`CaseHistoryEntry` (hash-chained audit trail), and reserved schema for
`EvidenceItem`, `ChatMessage`, `PirReport`, `ThreatIndicator`.

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

1. **Foundation** (this scaffold) — auth/RBAC, case model, audit log, dashboard
2. **Evidence Management** — intake, hashing, chain-of-custody, WORM storage
3. **Secure Chat & Notes** — case-scoped encrypted collaboration
4. **PIR Templates** — root-cause template library, action-item tracking
5. **Threat Intel Integration** — STIX/TAXII ingestion, watchlist matching
6. **Hardening & go-live** — pen test, DR drill, compliance review
