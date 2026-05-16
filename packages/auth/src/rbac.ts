export type Permission =
  | 'policy:read' | 'policy:write'
  | 'admins:manage' | 'admins:read'
  | 'domainRules:manage'
  | 'reviewQueue:read' | 'reviewQueue:approve'
  | 'punishments:create' | 'punishments:read'
  | 'logs:read' | 'logs:export'
  | 'group:settings';

export type Role = 'OWNER' | 'SUPERVISOR' | 'MODERATOR' | 'VIEWER';

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  OWNER: [
    'policy:read', 'policy:write',
    'admins:manage', 'admins:read',
    'domainRules:manage',
    'reviewQueue:read', 'reviewQueue:approve',
    'punishments:create', 'punishments:read',
    'logs:read', 'logs:export',
    'group:settings',
  ],
  SUPERVISOR: [
    'policy:read', 'policy:write',
    'admins:read',
    'reviewQueue:read', 'reviewQueue:approve',
    'punishments:create', 'punishments:read',
    'logs:read',
    'group:settings',
  ],
  MODERATOR: [
    'policy:read',
    'reviewQueue:read', 'reviewQueue:approve',
    'punishments:create', 'punishments:read',
    'logs:read',
  ],
  VIEWER: ['policy:read'],
};

export const MODERATOR_PUNISHMENT_MAX_HOURS = 1;

export function hasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

export function getPermissions(role: Role): Permission[] {
  return ROLE_PERMISSIONS[role] ?? [];
}