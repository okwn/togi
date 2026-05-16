import { db } from '@togi/db';
import { sessions, users } from '@togi/db';
import { eq, and, isNull, gt } from 'drizzle-orm';
import { createHash, randomBytes } from 'crypto';

export interface Session {
  id: string;
  telegramUserId: number;
  userAgentHash: string;
  ipHash: string;
  csrfToken: string;
  expiresAt: Date;
  createdAt: Date;
  revokedAt: Date | null;
}

export interface SessionWithUser extends Session {
  user: {
    telegramUserId: number;
    username: string | null;
    firstName: string | null;
    lastName: string | null;
  } | null;
}

function hashField(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export async function createSession(params: {
  telegramUserId: number;
  userAgent: string;
  ip: string;
  expiresAt: Date;
}): Promise<Session> {
  const csrfToken = randomBytes(32).toString('hex');
  const userAgentHash = hashField(params.userAgent);
  const ipHash = hashField(params.ip);

  const [session] = await db.insert(sessions).values({
    telegramUserId: params.telegramUserId,
    userAgentHash,
    ipHash,
    csrfToken,
    expiresAt: params.expiresAt,
  }).returning();

  return session;
}

export async function validateSession(sessionId: string): Promise<SessionWithUser | null> {
  const now = new Date();

  const [session] = await db
    .select()
    .from(sessions)
    .where(and(
      eq(sessions.id, sessionId),
      isNull(sessions.revokedAt),
      gt(sessions.expiresAt, now)
    ))
    .limit(1);

  if (!session) return null;

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.telegramUserId, session.telegramUserId))
    .limit(1);

  return { ...session, user: user || null };
}

export async function revokeSession(sessionId: string): Promise<void> {
  await db
    .update(sessions)
    .set({ revokedAt: new Date() })
    .where(eq(sessions.id, sessionId));
}