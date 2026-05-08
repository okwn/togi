'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Shield, AlertTriangle, Users, Activity, Settings, FileText, Globe, UserX, Lock } from 'lucide-react';
import { RaidStatusBanner } from '@/components/dashboard/RaidStatusBanner';
import type { Group, PolicyConfig, SecurityScore, Violation, AuditLog } from '@/types';

// Mock data for development
const mockGroup: Group = {
  id: '1',
  telegramChatId: -1001234567890,
  name: 'Crypto Trading Signals',
  type: 'supergroup',
  status: 'ACTIVE',
  botAdminStatus: 'ADMIN',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const mockPolicy: PolicyConfig = {
  mode: 'BALANCED',
  spamProtection: { enabled: true, deleteThreshold: 60, warnCount: 3, windowSeconds: 60 },
  floodProtection: { enabled: true, maxMessages: 7, windowSeconds: 10, mediaMultiplier: 2 },
  linkProtection: { enabled: true, allowShorteners: false, blockNewUserLinks: true, blockTelegramInvites: true, blockDiscordInvites: true },
  newMemberProtection: { enabled: true, probationMinutes: 5, restrictNewUsers: true, allowMedia: false },
  threatProtection: { enabled: true, scanMessages: true, blockKeywords: true },
  raidProtection: { enabled: true, joinWindowSeconds: 60, maxJoins: 10, autoLockdown: true },
  actionPolicy: { warnThreshold: 3, muteThreshold: 5, banThreshold: 8, muteDurationMinutes: 30, maxWarnings: 3 },
  adminAlerts: { enabled: true, severityThreshold: 'HIGH' },
};

const mockSecurityScore: SecurityScore = {
  total: 85,
  botAdminStatus: 20,
  permissions: 25,
  protections: 30,
  lists: 0,
  audit: 10,
  breakdown: {
    hasDeletePermission: true,
    hasRestrictPermission: true,
    hasJoinRequestPermission: true,
    floodProtectionEnabled: true,
    linkProtectionEnabled: true,
    newMemberProtectionEnabled: true,
    raidProtectionEnabled: true,
    hasBlocklist: false,
    hasAllowlist: false,
    auditLoggingEnabled: true,
  },
};

const mockRecentActions: AuditLog[] = [
  {
    id: '1',
    groupId: '1',
    actorTelegramUserId: 123,
    action: 'DELETE_MUTE',
    targetType: 'USER',
    targetId: '456',
    metadata: { reason: 'Spam flood detected', riskScore: 75 },
    createdAt: new Date(Date.now() - 300000).toISOString(),
  },
  {
    id: '2',
    groupId: '1',
    actorTelegramUserId: 123,
    action: 'BAN',
    targetType: 'USER',
    targetId: '789',
    metadata: { reason: 'Phishing link posted', riskScore: 95 },
    createdAt: new Date(Date.now() - 600000).toISOString(),
  },
];

export default function GroupOverviewPage() {
  const params = useParams();
  const groupId = params.groupId as string;

  const group = mockGroup;
  const policy = mockPolicy;
  const securityScore = mockSecurityScore;
  const recentActions = mockRecentActions;

  const modeDescriptions: Record<string, { description: string; badge: string }> = {
    RELAXED: { description: 'Low sensitivity, warn before delete. Good for friendly communities.', badge: 'bg-green-500/10 text-green-400' },
    BALANCED: { description: 'Recommended default. Balanced protection with clear warnings.', badge: 'bg-blue-500/10 text-blue-400' },
    STRICT: { description: 'Recommended for crypto, trading, public communities, and high-risk groups.', badge: 'bg-orange-500/10 text-orange-400' },
    PARANOID: { description: 'Use during raids or for very sensitive groups. May increase false positives.', badge: 'bg-red-500/10 text-red-400' },
  };

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-slate-400">
        <Link href="/dashboard" className="hover:text-white">Dashboard</Link>
        <span>/</span>
        <span className="text-white">{group.name}</span>
      </div>

      {/* Raid Status Banner */}
      <RaidStatusBanner groupId={groupId} />

      {/* Page Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">{group.name}</h1>
          <p className="text-slate-400 mt-1">Group ID: {group.telegramChatId}</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/dashboard/groups/${groupId}/settings`}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg flex items-center gap-2 transition-colors"
          >
            <Settings className="w-4 h-4" />
            Settings
          </Link>
        </div>
      </div>

      {/* Security Score Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <div className="flex items-center gap-4">
          <div className="relative w-24 h-24">
            <svg className="w-24 h-24 transform -rotate-90">
              <circle
                cx="48"
                cy="48"
                r="40"
                stroke="currentColor"
                strokeWidth="8"
                fill="none"
                className="text-slate-800"
              />
              <circle
                cx="48"
                cy="48"
                r="40"
                stroke="currentColor"
                strokeWidth="8"
                fill="none"
                strokeDasharray={`${(securityScore.total / 100) * 251.2} 251.2`}
                className={securityScore.total >= 80 ? 'text-green-500' : securityScore.total >= 50 ? 'text-yellow-500' : 'text-red-500'}
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className={`text-2xl font-bold ${securityScore.total >= 80 ? 'text-green-400' : securityScore.total >= 50 ? 'text-yellow-400' : 'text-red-400'}`}>
                {securityScore.total}
              </span>
            </div>
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-semibold text-white mb-2">Security Score</h2>
            <p className="text-slate-400 mb-4">Your group is well protected.</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <ScoreItem label="Bot Status" value={`${securityScore.botAdminStatus}/20`} />
              <ScoreItem label="Permissions" value={`${securityScore.permissions}/25`} />
              <ScoreItem label="Protections" value={`${securityScore.protections}/30`} />
              <ScoreItem label="Audit" value={`${securityScore.audit}/15`} />
            </div>
          </div>
        </div>
      </div>

      {/* Mode Selector & Quick Info Grid */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Mode Selector */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Protection Mode</h3>
          <div className="space-y-3">
            {Object.entries(modeDescriptions).map(([mode, { description, badge }]) => (
              <button
                key={mode}
                className={`w-full text-left p-3 rounded-lg border transition-all ${
                  policy.mode === mode
                    ? 'border-blue-500 bg-blue-500/10'
                    : 'border-slate-700 hover:border-slate-600'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className={`font-medium ${policy.mode === mode ? 'text-white' : 'text-slate-300'}`}>
                    {mode.charAt(0) + mode.slice(1).toLowerCase()}
                  </span>
                  {policy.mode === mode && (
                    <span className={`px-2 py-0.5 text-xs rounded ${badge}`}>Active</span>
                  )}
                </div>
                <p className="text-xs text-slate-400">{description}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Bot Permission Status */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Bot Permissions</h3>
          <div className="space-y-3">
            <PermissionCheck icon="🗑️" label="Delete Messages" allowed={securityScore.breakdown.hasDeletePermission} />
            <PermissionCheck icon="🔒" label="Restrict Members" allowed={securityScore.breakdown.hasRestrictPermission} />
            <PermissionCheck icon="👋" label="Manage Join Requests" allowed={securityScore.breakdown.hasJoinRequestPermission} />
          </div>
          {securityScore.breakdown.hasDeletePermission && securityScore.breakdown.hasRestrictPermission ? (
            <div className="mt-4 p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
              <p className="text-sm text-green-400">✓ Bot has all required permissions</p>
            </div>
          ) : (
            <Link
              href={`/dashboard/groups/${groupId}/permissions`}
              className="mt-4 block text-center py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-sm transition-colors"
            >
              Fix Permissions
            </Link>
          )}
        </div>

        {/* Raid State */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Raid Status</h3>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
            <span className="text-green-400 font-medium">No Active Raid</span>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between text-slate-400">
              <span>Join Window</span>
              <span>{policy.raidProtection.joinWindowSeconds}s</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Max Joins</span>
              <span>{policy.raidProtection.maxJoins}</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Auto-Lockdown</span>
              <span>{policy.raidProtection.autoLockdown ? 'Enabled' : 'Disabled'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Last 10 Actions */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-white">Recent Actions</h3>
          <Link
            href={`/dashboard/groups/${groupId}/logs`}
            className="text-sm text-blue-400 hover:text-blue-300"
          >
            View all →
          </Link>
        </div>
        <div className="space-y-3">
          {recentActions.map((action) => (
            <div
              key={action.id}
              className="flex items-center gap-4 p-3 bg-slate-800/50 rounded-lg"
            >
              <div className="w-10 h-10 bg-red-500/10 rounded-full flex items-center justify-center">
                <span className="text-lg">
                  {action.action.includes('BAN') ? '🔨' : action.action.includes('MUTE') ? '🔇' : '⚠️'}
                </span>
              </div>
              <div className="flex-1">
                <p className="text-white font-medium">{action.action}</p>
                <p className="text-sm text-slate-400">{action.metadata.reason as string}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-slate-400">
                  {new Date(action.createdAt).toLocaleTimeString()}
                </p>
                <p className="text-xs text-slate-500">Risk: {action.metadata.riskScore as number}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ScoreItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-slate-400 text-xs">{label}</p>
      <p className="text-white font-medium">{value}</p>
    </div>
  );
}

function PermissionCheck({ icon, label, allowed }: { icon: string; label: string; allowed: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-lg">{icon}</span>
      <span className="text-slate-300 flex-1">{label}</span>
      {allowed ? (
        <span className="text-green-400 text-sm">✓</span>
      ) : (
        <span className="text-red-400 text-sm">✗</span>
      )}
    </div>
  );
}