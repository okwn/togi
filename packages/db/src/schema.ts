import { pgTable, uuid, bigint, varchar, timestamp, jsonb, text, integer, index, uniqueIndex, pgEnum } from 'drizzle-orm/pg-core';

// Enums
export const roleEnum = pgEnum('role', ['OWNER', 'SUPERVISOR', 'MODERATOR', 'VIEWER']);
export const groupStatusEnum = pgEnum('group_status', ['ACTIVE', 'SETUP_PENDING', 'DISABLED']);

// Users table
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  telegramUserId: bigint('telegram_user_id', { mode: 'number' }).unique().notNull(),
  username: varchar('username', { length: 255 }),
  firstName: varchar('first_name', { length: 255 }),
  lastName: varchar('last_name', { length: 255 }),
  languageCode: varchar('language_code', { length: 10 }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// Groups table
export const groups = pgTable('groups', {
  id: uuid('id').primaryKey().defaultRandom(),
  telegramChatId: bigint('telegram_chat_id', { mode: 'number' }).unique().notNull(),
  title: varchar('title', { length: 255 }),
  type: varchar('type', { length: 50 }).notNull(),
  status: groupStatusEnum('status').notNull().default('SETUP_PENDING'),
  botAdminStatus: varchar('bot_admin_status', { length: 30 }).notNull().default('UNKNOWN'),
  ownerTelegramUserId: bigint('owner_telegram_user_id', { mode: 'number' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// Group admins table
export const groupAdmins = pgTable('group_admins', {
  id: uuid('id').primaryKey().defaultRandom(),
  groupId: uuid('group_id').notNull().references(() => groups.id, { onDelete: 'cascade' }),
  telegramUserId: bigint('telegram_user_id', { mode: 'number' }).notNull(),
  role: roleEnum('role').notNull().default('VIEWER'),
  permissions: jsonb('permissions').$type<string[]>().default([]),
  addedByTelegramUserId: bigint('added_by_telegram_user_id', { mode: 'number' }),
  verifiedAt: timestamp('verified_at', { withTimezone: true }),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  groupTelegramUserUnique: uniqueIndex('group_admins_group_telegram_user_unique').on(table.groupId, table.telegramUserId),
  groupIdIdx: index('idx_group_admins_group_id').on(table.groupId),
}));

// Group policies table
export const groupPolicies = pgTable('group_policies', {
  id: uuid('id').primaryKey().defaultRandom(),
  groupId: uuid('group_id').notNull().references(() => groups.id, { onDelete: 'cascade' }),
  mode: varchar('mode', { length: 20 }).notNull(),
  config: jsonb('config').notNull().default({}),
  version: integer('version').notNull().default(1),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  groupModeUnique: uniqueIndex('group_policies_group_mode_unique').on(table.groupId, table.mode),
  groupIdIdx: index('idx_group_policies_group_id').on(table.groupId),
}));

// Violations table
export const violations = pgTable('violations', {
  id: uuid('id').primaryKey().defaultRandom(),
  groupId: uuid('group_id').notNull().references(() => groups.id, { onDelete: 'cascade' }),
  telegramUserId: bigint('telegram_user_id', { mode: 'number' }),
  telegramMessageId: bigint('telegram_message_id', { mode: 'number' }),
  violationType: varchar('violation_type', { length: 50 }).notNull(),
  severity: varchar('severity', { length: 20 }).notNull(),
  riskScore: integer('risk_score').notNull(),
  action: varchar('action', { length: 50 }).notNull(),
  reason: text('reason'),
  labels: jsonb('labels').default([]),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  groupIdIdx: index('idx_violations_group_id').on(table.groupId),
  createdAtIdx: index('idx_violations_created_at').on(table.createdAt),
}));

// Punishments table
export const punishments = pgTable('punishments', {
  id: uuid('id').primaryKey().defaultRandom(),
  groupId: uuid('group_id').notNull().references(() => groups.id, { onDelete: 'cascade' }),
  telegramUserId: bigint('telegram_user_id', { mode: 'number' }).notNull(),
  type: varchar('type', { length: 20 }).notNull(),
  untilAt: timestamp('until_at', { withTimezone: true }),
  status: varchar('status', { length: 20 }).notNull().default('ACTIVE'),
  source: varchar('source', { length: 20 }).notNull().default('AUTO'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  groupIdIdx: index('idx_punishments_group_id').on(table.groupId),
  telegramUserIdIdx: index('idx_punishments_telegram_user_id').on(table.telegramUserId),
  statusIdx: index('idx_punishments_status').on(table.status),
}));

// Domain rules table
export const domainRules = pgTable('domain_rules', {
  id: uuid('id').primaryKey().defaultRandom(),
  groupId: uuid('group_id').references(() => groups.id, { onDelete: 'cascade' }),
  domain: varchar('domain', { length: 255 }).notNull(),
  ruleType: varchar('rule_type', { length: 20 }).notNull(),
  reason: text('reason'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  domainIdx: index('idx_domain_rules_domain').on(table.domain),
  groupIdIdx: index('idx_domain_rules_group_id').on(table.groupId),
}));

// Audit logs table
export const auditLogs = pgTable('audit_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  groupId: uuid('group_id').references(() => groups.id, { onDelete: 'set null' }),
  actorTelegramUserId: bigint('actor_telegram_user_id', { mode: 'number' }),
  action: varchar('action', { length: 50 }).notNull(),
  targetType: varchar('target_type', { length: 50 }),
  targetId: varchar('target_id', { length: 255 }),
  metadata: jsonb('metadata').default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  groupIdIdx: index('idx_audit_logs_group_id').on(table.groupId),
  createdAtIdx: index('idx_audit_logs_created_at').on(table.createdAt),
}));

// Message fingerprints table
export const messageFingerprints = pgTable('message_fingerprints', {
  id: uuid('id').primaryKey().defaultRandom(),
  groupId: uuid('group_id').notNull().references(() => groups.id, { onDelete: 'cascade' }),
  telegramUserId: bigint('telegram_user_id', { mode: 'number' }),
  telegramMessageId: bigint('telegram_message_id', { mode: 'number' }),
  textHash: varchar('text_hash', { length: 64 }).notNull(),
  linkDomains: jsonb('link_domains').default([]),
  riskScore: integer('risk_score'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  groupIdIdx: index('idx_message_fingerprints_group_id').on(table.groupId),
  textHashIdx: index('idx_message_fingerprints_text_hash').on(table.textHash),
}));

// Review queue table
export const reviewQueue = pgTable('review_queue', {
  id: uuid('id').primaryKey().defaultRandom(),
  groupId: uuid('group_id').notNull().references(() => groups.id, { onDelete: 'cascade' }),
  itemType: varchar('item_type', { length: 20 }).notNull(), // 'message' | 'user'
  itemId: bigint('item_id', { mode: 'number' }), // telegram message or user id
  telegramUserId: bigint('telegram_user_id', { mode: 'number' }),
  telegramMessageId: bigint('telegram_message_id', { mode: 'number' }),
  reason: text('reason').notNull(),
  reasonType: varchar('reason_type', { length: 50 }).notNull(), // e.g., 'LINK', 'SPAM', 'NEW_USER'
  labels: jsonb('labels').default([]),
  riskScore: integer('risk_score'),
  status: varchar('status', { length: 20 }).notNull().default('PENDING'),
  reviewedBy: bigint('reviewed_by', { mode: 'number' }),
  reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
  reviewNote: text('review_note'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  groupIdIdx: index('idx_review_queue_group_id').on(table.groupId),
  statusIdx: index('idx_review_queue_status').on(table.status),
  createdAtIdx: index('idx_review_queue_created_at').on(table.createdAt),
}));

// Sessions table
export const sessions = pgTable('sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  telegramUserId: bigint('telegram_user_id', { mode: 'number' }).notNull().references(() => users.id),
  userAgentHash: varchar('user_agent_hash', { length: 64 }).notNull(),
  ipHash: varchar('ip_hash', { length: 64 }).notNull(),
  csrfToken: varchar('csrf_token', { length: 64 }).unique().notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
}, (table) => ({
  telegramUserIdIdx: index('idx_sessions_telegram_user_id').on(table.telegramUserId),
  csrfTokenIdx: index('idx_sessions_csrf_token').on(table.csrfToken),
  expiresAtIdx: index('idx_sessions_expires_at').on(table.expiresAt),
}));

// Type exports
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Group = typeof groups.$inferSelect;
export type NewGroup = typeof groups.$inferInsert;
export type GroupAdmin = typeof groupAdmins.$inferSelect;
export type NewGroupAdmin = typeof groupAdmins.$inferInsert;
export type GroupPolicy = typeof groupPolicies.$inferSelect;
export type NewGroupPolicy = typeof groupPolicies.$inferInsert;
export type Violation = typeof violations.$inferSelect;
export type NewViolation = typeof violations.$inferInsert;
export type Punishment = typeof punishments.$inferSelect;
export type NewPunishment = typeof punishments.$inferInsert;
export type DomainRule = typeof domainRules.$inferSelect;
export type NewDomainRule = typeof domainRules.$inferInsert;
export type AuditLog = typeof auditLogs.$inferSelect;
export type NewAuditLog = typeof auditLogs.$inferInsert;
export type MessageFingerprint = typeof messageFingerprints.$inferSelect;
export type NewMessageFingerprint = typeof messageFingerprints.$inferInsert;
export type ReviewQueueItem = typeof reviewQueue.$inferSelect;
export type NewReviewQueueItem = typeof reviewQueue.$inferInsert;
export type Role = 'OWNER' | 'SUPERVISOR' | 'MODERATOR' | 'VIEWER';
export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;
