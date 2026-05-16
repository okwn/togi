import { hasPermission, ROLE_PERMISSIONS } from '../rbac';

describe('RBAC', () => {
  it('OWNER should have all permissions', () => {
    expect(hasPermission('OWNER', 'admins:manage')).toBe(true);
    expect(hasPermission('OWNER', 'policy:write')).toBe(true);
    expect(hasPermission('OWNER', 'logs:export')).toBe(true);
    expect(hasPermission('OWNER', 'group:settings')).toBe(true);
  });

  it('VIEWER should only have policy:read', () => {
    expect(hasPermission('VIEWER', 'policy:read')).toBe(true);
    expect(hasPermission('VIEWER', 'admins:manage')).toBe(false);
    expect(hasPermission('VIEWER', 'policy:write')).toBe(false);
  });

  it('MODERATOR should have review and punishment permissions but not admins:manage', () => {
    expect(hasPermission('MODERATOR', 'reviewQueue:read')).toBe(true);
    expect(hasPermission('MODERATOR', 'punishments:create')).toBe(true);
    expect(hasPermission('MODERATOR', 'admins:manage')).toBe(false);
    expect(hasPermission('MODERATOR', 'policy:write')).toBe(false);
  });

  it('SUPERVISOR should have policy:write but not admins:manage or logs:export', () => {
    expect(hasPermission('SUPERVISOR', 'policy:write')).toBe(true);
    expect(hasPermission('SUPERVISOR', 'admins:manage')).toBe(false);
    expect(hasPermission('SUPERVISOR', 'logs:export')).toBe(false);
  });
});