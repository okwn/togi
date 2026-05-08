export interface SecurityEventJob {
  eventId: string;
  eventType: string;
  chatId: string;
  userId?: string;
  username?: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  policyId?: string;
  policyType?: string;
  reason?: string;
  metadata: Record<string, unknown>;
  timestamp: number;
}

export interface EnqueueSecurityEventOptions {
  event: SecurityEventJob;
  queue?: string;
}

export async function enqueueSecurityEvent(
  options: EnqueueSecurityEventOptions
): Promise<void> {
  // Placeholder - queue implementation comes in Phase 06
  console.log('[Queue:Stub] enqueueSecurityEvent called:', {
    eventId: options.event.eventId,
    eventType: options.event.eventType,
    chatId: options.event.chatId,
    severity: options.event.severity,
    reason: options.event.reason,
  });
}

export function createSecurityEvent(
  type: string,
  chatId: string,
  severity: SecurityEventJob['severity'],
  metadata: Record<string, unknown>
): SecurityEventJob {
  return {
    eventId: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    eventType: type,
    chatId,
    severity,
    metadata,
    timestamp: Date.now(),
  };
}
