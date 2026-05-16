'use client';

// This hook is primarily for UI gating — server-side enforcement is authoritative
export function usePermission(_permission: string): boolean {
  // For now, UI controls are hidden based on what the server returns
  // The auth-me response includes group memberships with roles
  return false;
}