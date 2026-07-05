import { Role } from './roles.enum';

/**
 * Mirrors the access control matrix in the architecture plan (Section 05).
 * The API is the source of truth for enforcement; the frontend only reads
 * this shape to decide what to render, never to decide what to allow.
 */
export enum Permission {
  VIEW_ASSIGNED_CASES = 'view_assigned_cases',
  VIEW_ALL_CASES = 'view_all_cases',
  CREATE_EDIT_CASE = 'create_edit_case',
  CLOSE_HIGH_CRITICAL_CASE = 'close_high_critical_case',
  UPLOAD_EVIDENCE = 'upload_evidence',
  DOWNLOAD_EVIDENCE = 'download_evidence',
  VIEW_EVIDENCE_METADATA = 'view_evidence_metadata',
  CHAT_ON_CASE = 'chat_on_case',
  EXPORT_CHAT_NOTES = 'export_chat_notes',
  FINALIZE_PIR = 'finalize_pir',
  APPROVE_TI_SHARING = 'approve_ti_sharing',
  MANAGE_USERS = 'manage_users',
  VIEW_AUDIT_LOG = 'view_audit_log',
}

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  [Role.ANALYST_L1]: [
    Permission.VIEW_ASSIGNED_CASES,
    Permission.CREATE_EDIT_CASE,
    Permission.UPLOAD_EVIDENCE,
    Permission.VIEW_EVIDENCE_METADATA,
    Permission.CHAT_ON_CASE,
  ],
  [Role.ANALYST_L2]: [
    Permission.VIEW_ASSIGNED_CASES,
    Permission.CREATE_EDIT_CASE,
    Permission.UPLOAD_EVIDENCE,
    Permission.DOWNLOAD_EVIDENCE,
    Permission.VIEW_EVIDENCE_METADATA,
    Permission.CHAT_ON_CASE,
  ],
  [Role.IR_LEAD]: [
    Permission.VIEW_ASSIGNED_CASES,
    Permission.VIEW_ALL_CASES,
    Permission.CREATE_EDIT_CASE,
    Permission.CLOSE_HIGH_CRITICAL_CASE,
    Permission.UPLOAD_EVIDENCE,
    Permission.DOWNLOAD_EVIDENCE,
    Permission.VIEW_EVIDENCE_METADATA,
    Permission.CHAT_ON_CASE,
    Permission.EXPORT_CHAT_NOTES,
    Permission.FINALIZE_PIR,
    Permission.VIEW_AUDIT_LOG,
  ],
  [Role.CISO_MANAGER]: [
    Permission.VIEW_ASSIGNED_CASES,
    Permission.VIEW_ALL_CASES,
    Permission.CLOSE_HIGH_CRITICAL_CASE,
    Permission.DOWNLOAD_EVIDENCE,
    Permission.VIEW_EVIDENCE_METADATA,
    Permission.EXPORT_CHAT_NOTES,
    Permission.FINALIZE_PIR,
    Permission.APPROVE_TI_SHARING,
    Permission.VIEW_AUDIT_LOG,
  ],
  [Role.AUDITOR]: [
    Permission.VIEW_ASSIGNED_CASES,
    Permission.VIEW_ALL_CASES,
    Permission.VIEW_EVIDENCE_METADATA,
    Permission.VIEW_AUDIT_LOG,
  ],
  [Role.ADMIN]: [
    Permission.VIEW_ASSIGNED_CASES,
    Permission.VIEW_ALL_CASES,
    Permission.CREATE_EDIT_CASE,
    Permission.CLOSE_HIGH_CRITICAL_CASE,
    Permission.UPLOAD_EVIDENCE,
    Permission.DOWNLOAD_EVIDENCE,
    Permission.VIEW_EVIDENCE_METADATA,
    Permission.EXPORT_CHAT_NOTES,
    Permission.MANAGE_USERS,
    Permission.VIEW_AUDIT_LOG,
  ],
};

export function roleHasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}
