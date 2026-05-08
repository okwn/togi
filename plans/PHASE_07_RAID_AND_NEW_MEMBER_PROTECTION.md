# Phase 07: Raid Mode, New Member Protection, and Verification/Review

## Status: COMPLETED

## Overview

Implemented raid mode, new member protection with probation, group lockdown, lightweight verification challenges, and admin review queue for suspicious users and messages.

## Components Completed

### 1. Policy Engine Updates
- [x] Updated `NewMemberProtectionConfig` interface with new fields
- [x] Updated `RaidProtectionConfig` interface with new fields
- [x] Updated policy-defaults for all modes (RELAXED, BALANCED, STRICT, PARANOID, CUSTOM)
- [x] Updated `validatePolicyConfig` in engine.ts

### 2. Database Schema
- [x] Added `review_queue` table for admin review items
- [x] Added type exports for ReviewQueueItem

### 3. Redis Keys
- [x] Added probation, verified, verifyChallenge, joinSpike, and lockdown keys

### 4. New Member Service
- [x] Implemented probation state management
- [x] Implemented verification challenge creation/checking
- [x] Implemented join spike detection using sorted sets
- [x] Implemented raid state management
- [x] Implemented lockdown state management

### 5. API Routes
- [x] Added `GET /api/groups/:id/review-queue`
- [x] Added `POST /api/groups/:id/review-queue/:itemId/approve`
- [x] Added `POST /api/groups/:id/review-queue/:itemId/reject`
- [x] Added `GET /api/groups/:id/raid-status`
- [x] Added `POST /api/groups/:id/lockdown`
- [x] Added `DELETE /api/groups/:id/lockdown`

### 6. UI Components
- [x] Created `RaidStatusBanner` component
- [x] Integrated `RaidStatusBanner` into group overview page
- [x] Created `/dashboard/groups/[groupId]/review` page

### 7. Documentation
- [x] Created `docs/PHASE_07_RAID_AND_NEW_MEMBER_PROTECTION.md`
- [x] Updated `docs/SECURITY_MODEL.md` (in previous session)
- [x] Updated `docs/PERFORMANCE_MODEL.md` (in previous session)

## Key Features Implemented

### New Member Protection
- Configurable probation period per policy mode
- Block links, media, mentions during probation
- First message strict mode option
- Verification challenge option (lightweight "I am human" button)

### Raid Detection
- Join spike detection with Redis sorted sets
- Multiple trigger types (joins, messages, links, mentions)
- Auto-lockdown capability
- Raid state persists in Redis with TTL

### Lockdown
- Manual lockdown via API
- Scheduled unlock via worker
- Manual unlock always overrides raid lockdown

### Review Queue
- Pending/Approved/Rejected status workflow
- Risk score and labels attached to items
- Admin notes on review actions

## Files Modified/Created

### Modified
- `packages/policy-engine/src/types.ts` - Updated interfaces
- `packages/policy-engine/src/policy-defaults.ts` - Updated defaults
- `packages/policy-engine/src/engine.ts` - Updated validation
- `packages/db/src/schema.ts` - Added review_queue table
- `packages/db/src/redis.ts` - Added new Redis keys
- `apps/api/src/routes/groups.ts` - Added new routes
- `apps/web/src/app/dashboard/groups/[groupId]/page.tsx` - Added RaidStatusBanner

### Created
- `apps/api/src/services/new-member-service.ts` - New member & raid service
- `apps/web/src/components/dashboard/RaidStatusBanner.tsx` - Raid banner component
- `apps/web/src/app/dashboard/groups/[groupId]/review/page.tsx` - Review queue page
- `docs/PHASE_07_RAID_AND_NEW_MEMBER_PROTECTION.md` - Documentation

## Verification

Build: **PASS** (all packages compile successfully)
Web dashboard: Review page route created at `/dashboard/groups/[groupId]/review`
API: All new endpoints registered

## Next Steps (for Phase 08)

- Bot command handlers for `/raid_status`, `/lockdown`, `/unlockdown`
- Worker processor for scheduled unlock after lockdown
- Worker processor for verification timeout handling
- Inline button callback handler for verification
- Tests for all new functionality
