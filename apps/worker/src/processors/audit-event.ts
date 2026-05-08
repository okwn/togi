// Audit Event Processor
import type { AuditEventJob } from '../types';
import { recordJobComplete, recordJobFailure } from '../metrics';
import { db, auditLogs } from '@togi/db';

export async function processAuditEvent(job: AuditEventJob): Promise<{ auditId: string }> {
  const startTime = Date.now();

  try {
    console.log(`[AuditEvent] Processing audit for group ${job.groupId}, action: ${job.action}`);

    // Insert audit log into database
    const [inserted] = await db
      .insert(auditLogs)
      .values({
        groupId: job.groupId,
        actorTelegramUserId: job.actorTelegramUserId,
        action: job.action,
        targetType: job.targetType,
        targetId: job.targetId,
        metadata: job.metadata,
      })
      .returning();

    const duration = Date.now() - startTime;
    recordJobComplete(duration);

    console.log(`[AuditEvent] Created audit log ${inserted.id} in ${duration}ms`);

    return { auditId: inserted.id };
  } catch (error) {
    recordJobFailure();
    const duration = Date.now() - startTime;
    console.error(`[AuditEvent] Failed to create audit log:`, error);
    throw error;
  }
}