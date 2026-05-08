import type {
  Group,
  PolicyConfig,
  SecurityScore,
  Violation,
  AuditLog,
  DomainRule,
  Member,
} from '@/types';

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';

async function fetchApi<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`API Error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

// Groups
export async function getGroups(): Promise<Group[]> {
  return fetchApi<Group[]>('/api/groups');
}

export async function getGroup(id: string): Promise<Group> {
  return fetchApi<Group>(`/api/groups/${id}`);
}

// Policy
export async function getGroupPolicy(groupId: string): Promise<PolicyConfig> {
  return fetchApi<PolicyConfig>(`/api/groups/${groupId}/policy`);
}

export async function updateGroupPolicy(
  groupId: string,
  policy: PolicyConfig
): Promise<PolicyConfig> {
  return fetchApi<PolicyConfig>(`/api/groups/${groupId}/policy`, {
    method: 'PATCH',
    body: JSON.stringify(policy),
  });
}

// Security Score
export async function getSecurityScore(groupId: string): Promise<SecurityScore> {
  return fetchApi<SecurityScore>(`/api/groups/${groupId}/security-score`);
}

// Violations
export async function getViolations(
  groupId: string,
  filters?: {
    severity?: string;
    label?: string;
    action?: string;
    startDate?: string;
    endDate?: string;
  }
): Promise<Violation[]> {
  const params = new URLSearchParams();
  if (filters?.severity) params.set('severity', filters.severity);
  if (filters?.label) params.set('label', filters.label);
  if (filters?.action) params.set('action', filters.action);
  if (filters?.startDate) params.set('startDate', filters.startDate);
  if (filters?.endDate) params.set('endDate', filters.endDate);

  const queryString = params.toString();
  const endpoint = `/api/groups/${groupId}/violations${queryString ? `?${queryString}` : ''}`;

  return fetchApi<Violation[]>(endpoint);
}

// Audit Logs
export async function getAuditLogs(
  groupId: string,
  limit = 50
): Promise<AuditLog[]> {
  return fetchApi<AuditLog[]>(`/api/groups/${groupId}/audit-logs?limit=${limit}`);
}

// Domain Rules
export async function getDomainRules(groupId: string): Promise<DomainRule[]> {
  return fetchApi<DomainRule[]>(`/api/groups/${groupId}/domains`);
}

export async function addDomainRule(
  groupId: string,
  domain: string,
  ruleType: 'ALLOW' | 'BLOCK' | 'WATCH'
): Promise<DomainRule> {
  return fetchApi<DomainRule>(`/api/groups/${groupId}/domains`, {
    method: 'POST',
    body: JSON.stringify({ domain, ruleType }),
  });
}

export async function deleteDomainRule(
  groupId: string,
  ruleId: string
): Promise<void> {
  return fetchApi<void>(`/api/groups/${groupId}/domains/${ruleId}`, {
    method: 'DELETE',
  });
}

// Members
export async function getGroupMembers(groupId: string): Promise<Member[]> {
  return fetchApi<Member[]>(`/api/groups/${groupId}/members`);
}

export async function revokePunishment(
  groupId: string,
  telegramUserId: number
): Promise<void> {
  return fetchApi<void>(`/api/groups/${groupId}/members/${telegramUserId}/revoke`, {
    method: 'POST',
  });
}