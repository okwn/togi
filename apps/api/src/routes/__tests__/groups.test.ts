import { buildApp } from '../../server';
import { db, sessions, users, groups, groupAdmins, groupPolicies } from '@togi/db';
import { eq } from 'drizzle-orm';

describe('Groups API integration tests', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  // Test data IDs - using static strings for test predictability
  const TEST_USER_ID = 99999999;
  let TEST_GROUP_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
  const TEST_VIEWER_USER_ID = 88888888;
  const TEST_ADMIN_USER_ID = 77777777;

  // Auth tokens - set after login
  let viewerSessionId: string;
  let adminSessionId: string;
  let viewerCsrfToken: string;
  let adminCsrfToken: string;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();

    // Clean up any existing test data first
    await cleanupTestData();

    // Create test user for viewers
    await db.insert(users).values({
      telegramUserId: TEST_VIEWER_USER_ID,
      username: 'test_viewer',
      firstName: 'Test',
      lastName: 'Viewer',
    }).onConflictDoNothing();

    // Create test user for admins
    await db.insert(users).values({
      telegramUserId: TEST_ADMIN_USER_ID,
      username: 'test_admin',
      firstName: 'Test',
      lastName: 'Admin',
    }).onConflictDoNothing();

    // Create test group
    // Note: id is auto-generated, we get it back via returning()
    // Use unique telegramChatId to avoid conflicts between test runs
    const [createdGroup] = await db.insert(groups).values({
      telegramChatId: Date.now() % 1000000 + 100000, // Unique enough for tests
      title: 'Test Group',
      type: 'supergroup',
      status: 'ACTIVE',
      botAdminStatus: 'ADMIN',
      ownerTelegramUserId: TEST_ADMIN_USER_ID,
    }).returning();

    // Reassign the outer variable (not creating a new const)
    TEST_GROUP_ID = createdGroup.id;

    // Create VIEWER role for viewer user on the group
    await db.insert(groupAdmins).values({
      groupId: TEST_GROUP_ID,
      telegramUserId: TEST_VIEWER_USER_ID,
      role: 'VIEWER',
      permissions: [],
      verifiedAt: new Date(),
    }).onConflictDoNothing();

    // Create MODERATOR role for admin user (has policy:write permission)
    await db.insert(groupAdmins).values({
      groupId: TEST_GROUP_ID,
      telegramUserId: TEST_ADMIN_USER_ID,
      role: 'MODERATOR',
      permissions: ['policy:read', 'policy:write', 'logs:read', 'group:settings'],
      verifiedAt: new Date(),
    }).onConflictDoNothing();

    // Create sessions for both users
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours

    const [viewerSession] = await db.insert(sessions).values({
      telegramUserId: TEST_VIEWER_USER_ID,
      userAgentHash: 'test-viewer-ua-hash',
      ipHash: 'test-viewer-ip-hash',
      csrfToken: 'viewer-csrf-token-12345678901234567890123456789012',
      expiresAt,
    }).returning();

    const [adminSession] = await db.insert(sessions).values({
      telegramUserId: TEST_ADMIN_USER_ID,
      userAgentHash: 'test-admin-ua-hash',
      ipHash: 'test-admin-ip-hash',
      csrfToken: 'admin-csrf-token-12345678901234567890123456789012',
      expiresAt,
    }).returning();

    viewerSessionId = viewerSession.id;
    adminSessionId = adminSession.id;
    viewerCsrfToken = viewerSession.csrfToken;
    adminCsrfToken = adminSession.csrfToken;
  });

  afterAll(async () => {
    await cleanupTestData();
    await app.close();
  });

  async function cleanupTestData() {
    // Delete in correct order to avoid FK violations
    await db.delete(groupPolicies).where(eq(groupPolicies.groupId, TEST_GROUP_ID));
    await db.delete(groupAdmins).where(eq(groupAdmins.groupId, TEST_GROUP_ID));
    await db.delete(sessions).where(eq(sessions.telegramUserId, TEST_VIEWER_USER_ID));
    await db.delete(sessions).where(eq(sessions.telegramUserId, TEST_ADMIN_USER_ID));
    await db.delete(groups).where(eq(groups.id, TEST_GROUP_ID));
    await db.delete(users).where(eq(users.telegramUserId, TEST_VIEWER_USER_ID));
    await db.delete(users).where(eq(users.telegramUserId, TEST_ADMIN_USER_ID));
  }

  describe('GET /api/groups/:id/policy', () => {
    it('should return policy for valid group with auth', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/groups/${TEST_GROUP_ID}/policy`,
        cookies: { session_id: adminSessionId },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body).toHaveProperty('policy');
      expect(body.policy).toHaveProperty('mode');
      expect(body.policy).toHaveProperty('config');
    });

    it('should reject unauthenticated requests with 401', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/groups/${TEST_GROUP_ID}/policy`,
      });

      expect(res.statusCode).toBe(401);
      const body = JSON.parse(res.body);
      expect(body.error.code).toBe('AUTH_REQUIRED');
    });

    it('should return default policy when no policy exists', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/groups/${TEST_GROUP_ID}/policy`,
        cookies: { session_id: adminSessionId },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.policy.isDefault).toBe(true);
      expect(body.policy.mode).toBe('BALANCED');
    });

    it('should return existing policy when policy exists', async () => {
      // First, create a policy
      await db.insert(groupPolicies).values({
        groupId: TEST_GROUP_ID,
        mode: 'STRICT',
        config: { trustThreshold: 0, linkDomainStrategy: 'BLOCK_ALL' },
        version: 1,
      }).onConflictDoNothing();

      const res = await app.inject({
        method: 'GET',
        url: `/api/groups/${TEST_GROUP_ID}/policy`,
        cookies: { session_id: adminSessionId },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.policy.mode).toBe('STRICT');
      expect(body.policy.isDefault).toBe(false);
    });
  });

  describe('PATCH /api/groups/:id/policy', () => {
    it('should accept valid policy update from admin', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: `/api/groups/${TEST_GROUP_ID}/policy`,
        cookies: { session_id: adminSessionId },
        headers: {
          'x-csrf-token': adminCsrfToken,
          'content-type': 'application/json',
        },
        payload: {
          mode: 'STRICT',
          config: { trustThreshold: 1, linkDomainStrategy: 'BLOCK_ALL' },
        },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body).toHaveProperty('policy');
      expect(body.policy.mode).toBe('STRICT');
      expect(body.policy.version).toBeGreaterThanOrEqual(1);
    });

    it('should reject viewer attempting to modify policy with 403', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: `/api/groups/${TEST_GROUP_ID}/policy`,
        cookies: { session_id: viewerSessionId },
        headers: {
          'x-csrf-token': viewerCsrfToken,
          'content-type': 'application/json',
        },
        payload: {
          mode: 'STRICT',
        },
      });

      expect(res.statusCode).toBe(403);
      const body = JSON.parse(res.body);
      expect(body.error.code).toBe('ACCESS_DENIED');
    });

    it('should reject invalid policy mode with 400', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: `/api/groups/${TEST_GROUP_ID}/policy`,
        cookies: { session_id: adminSessionId },
        headers: {
          'x-csrf-token': adminCsrfToken,
          'content-type': 'application/json',
        },
        payload: {
          mode: 'INVALID_MODE',
        },
      });

      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.body);
      expect(body.error).toBe('Invalid policy mode');
    });

    it('should require CSRF token for policy update', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: `/api/groups/${TEST_GROUP_ID}/policy`,
        cookies: { session_id: adminSessionId },
        headers: {
          'content-type': 'application/json',
        },
        payload: {
          mode: 'STRICT',
        },
      });

      expect(res.statusCode).toBe(403);
    });

    it('should reject request without auth for policy update', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: `/api/groups/${TEST_GROUP_ID}/policy`,
        headers: {
          'x-csrf-token': adminCsrfToken,
          'content-type': 'application/json',
        },
        payload: {
          mode: 'STRICT',
        },
      });

      expect(res.statusCode).toBe(401);
    });

    it('should reject request for non-existent group with 404', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: '/api/groups/non-existent-group-id/policy',
        cookies: { session_id: adminSessionId },
        headers: {
          'x-csrf-token': adminCsrfToken,
          'content-type': 'application/json',
        },
        payload: {
          mode: 'STRICT',
        },
      });

      expect(res.statusCode).toBe(404);
    });
  });

  describe('GET /api/groups/:id', () => {
    it('should return group details with auth', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/groups/${TEST_GROUP_ID}`,
        cookies: { session_id: adminSessionId },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body).toHaveProperty('group');
      expect(body.group.id).toBe(TEST_GROUP_ID);
      expect(body.group.title).toBe('Test Group');
    });

    it('should reject unauthenticated requests with 401', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/groups/${TEST_GROUP_ID}`,
      });

      expect(res.statusCode).toBe(401);
    });

    it('should return 404 for non-existent group', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/groups/non-existent-id',
        cookies: { session_id: adminSessionId },
      });

      expect(res.statusCode).toBe(404);
    });
  });

  describe('RBAC - Permission checks', () => {
    it('should allow user with policy:read to get group details', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/groups/${TEST_GROUP_ID}`,
        cookies: { session_id: viewerSessionId },
      });

      expect(res.statusCode).toBe(200);
    });

    it('should deny user without policy:read permission', async () => {
      // Create a user with no group membership
      const NO_ACCESS_USER_ID = 66666666;
      await db.insert(users).values({
        telegramUserId: NO_ACCESS_USER_ID,
        username: 'no_access_user',
        firstName: 'No',
        lastName: 'Access',
      }).onConflictDoNothing();

      const [noAccessSession] = await db.insert(sessions).values({
        telegramUserId: NO_ACCESS_USER_ID,
        userAgentHash: 'no-access-ua-hash',
        ipHash: 'no-access-ip-hash',
        csrfToken: 'no-access-csrf-token-123456789012345678901234',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      }).returning();

      const res = await app.inject({
        method: 'GET',
        url: `/api/groups/${TEST_GROUP_ID}`,
        cookies: { session_id: noAccessSession.id },
      });

      expect(res.statusCode).toBe(403);

      // Cleanup
      await db.delete(sessions).where(eq(sessions.id, noAccessSession.id));
      await db.delete(users).where(eq(users.telegramUserId, NO_ACCESS_USER_ID));
    });
  });
});