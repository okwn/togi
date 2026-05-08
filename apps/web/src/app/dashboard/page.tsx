'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { Shield, AlertTriangle, Users, Activity } from 'lucide-react';
import type { Group, Violation, SecurityScore } from '@/types';

// Mock data for development
const mockGroups: Group[] = [
  {
    id: '1',
    telegramChatId: -1001234567890,
    name: 'Crypto Trading signals',
    type: 'supergroup',
    status: 'ACTIVE',
    botAdminStatus: 'ADMIN',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: '2',
    telegramChatId: -1009876543210,
    name: 'Tech Community',
    type: 'supergroup',
    status: 'ACTIVE',
    botAdminStatus: 'ADMIN',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

const mockViolations: Violation[] = [
  {
    id: '1',
    groupId: '1',
    telegramUserId: 111,
    telegramMessageId: 'msg-1',
    violationType: 'SPAM,FLOOD',
    severity: 'HIGH',
    riskScore: 85,
    action: 'DELETE_MUTE',
    reason: 'User sent 15 messages in 10 seconds',
    createdAt: new Date(Date.now() - 300000).toISOString(),
  },
  {
    id: '2',
    groupId: '1',
    telegramUserId: 222,
    telegramMessageId: 'msg-2',
    violationType: 'LINK,BLOCKED_DOMAIN',
    severity: 'CRITICAL',
    riskScore: 95,
    action: 'DELETE_BAN',
    reason: 'Posted link to phishing site',
    createdAt: new Date(Date.now() - 600000).toISOString(),
  },
  {
    id: '3',
    groupId: '2',
    telegramUserId: 333,
    telegramMessageId: 'msg-3',
    violationType: 'THREAT',
    severity: 'HIGH',
    riskScore: 80,
    action: 'DELETE_WARN',
    reason: 'Harassment threat detected',
    createdAt: new Date(Date.now() - 900000).toISOString(),
  },
];

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

export default function DashboardPage() {
  // In production, use actual API calls
  // const { data: groups } = useQuery({ queryKey: ['groups'], queryFn: getGroups });
  // const { data: violations } = useQuery({ queryKey: ['violations'], queryFn: () => getViolations() });
  // const { data: securityScore } = useQuery({ queryKey: ['security-score'], queryFn: () => getSecurityScore() });

  const groups = mockGroups;
  const violations = mockViolations;
  const securityScore = mockSecurityScore;

  const recentViolations = violations.slice(0, 5);

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold text-white">Dashboard</h1>
        <p className="text-slate-400 mt-1">Overview of your group protection status</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<Shield className="w-5 h-5" />}
          label="Security Score"
          value={`${securityScore.total}/100`}
          trend={securityScore.total >= 80 ? 'good' : 'warning'}
        />
        <StatCard
          icon={<Users className="w-5 h-5" />}
          label="Active Groups"
          value={groups.length.toString()}
        />
        <StatCard
          icon={<AlertTriangle className="w-5 h-5" />}
          label="Violations (24h)"
          value={violations.length.toString()}
        />
        <StatCard
          icon={<Activity className="w-5 h-5" />}
          label="System Status"
          value="Online"
          trend="good"
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Groups List */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-xl p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-white">Your Groups</h2>
            <Link
              href="/dashboard/groups"
              className="text-sm text-blue-400 hover:text-blue-300"
            >
              View all →
            </Link>
          </div>
          <div className="space-y-3">
            {groups.map((group) => (
              <Link
                key={group.id}
                href={`/dashboard/groups/${group.id}`}
                className="block p-4 bg-slate-800/50 hover:bg-slate-800 rounded-lg transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium text-white">{group.name}</h3>
                    <p className="text-sm text-slate-400 mt-1">
                      ID: {group.telegramChatId}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <StatusBadge
                      status={group.botAdminStatus === 'ADMIN' ? 'good' : 'warning'}
                      label={group.botAdminStatus === 'ADMIN' ? 'Protected' : 'Not Admin'}
                    />
                    <span className="text-slate-500">→</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Quick Setup Hints */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <h2 className="text-xl font-semibold text-white mb-6">Quick Setup</h2>
          <div className="space-y-4">
            <SetupHint
              step={1}
              title="Add Bot as Admin"
              description="Give TOGI bot full admin permissions for best protection"
              done={groups.some((g) => g.botAdminStatus === 'ADMIN')}
            />
            <SetupHint
              step={2}
              title="Choose Protection Mode"
              description="Start with Balanced mode, adjust based on your needs"
              done={groups.length > 0}
            />
            <SetupHint
              step={3}
              title="Configure Allowlists"
              description="Add trusted domains to your allowlist"
              done={false}
            />
          </div>
        </div>
      </div>

      {/* Recent Violations */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-white">Recent Violations</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-sm text-slate-400 border-b border-slate-800">
                <th className="pb-3 font-medium">Time</th>
                <th className="pb-3 font-medium">Group</th>
                <th className="pb-3 font-medium">Type</th>
                <th className="pb-3 font-medium">Severity</th>
                <th className="pb-3 font-medium">Action</th>
                <th className="pb-3 font-medium">Risk</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {recentViolations.map((violation) => (
                <tr key={violation.id} className="border-b border-slate-800/50 last:border-0">
                  <td className="py-3 text-slate-400">
                    {new Date(violation.createdAt).toLocaleTimeString()}
                  </td>
                  <td className="py-3 text-white">
                    {groups.find((g) => g.id === violation.groupId)?.name || 'Unknown'}
                  </td>
                  <td className="py-3">
                    <div className="flex flex-wrap gap-1">
                      {violation.violationType.split(',').map((label) => (
                        <span
                          key={label}
                          className="px-2 py-0.5 bg-slate-800 text-slate-300 rounded text-xs"
                        >
                          {label}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="py-3">
                    <SeverityBadge severity={violation.severity} />
                  </td>
                  <td className="py-3 text-slate-300">{violation.action}</td>
                  <td className="py-3">
                    <span className={getRiskColor(violation.riskScore)}>
                      {violation.riskScore}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  trend,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  trend?: 'good' | 'warning' | 'bad';
}) {
  const bgColors = {
    good: 'bg-green-500/10 border-green-500/20',
    warning: 'bg-yellow-500/10 border-yellow-500/20',
    bad: 'bg-red-500/10 border-red-500/20',
    default: 'bg-slate-800 border-slate-700',
  };

  const trendColor = trend ? textColors[trend] : 'text-white';

  return (
    <div className={`p-4 rounded-xl border ${bgColors[trend || 'default']}`}>
      <div className="flex items-center gap-3">
        <div className="text-slate-400">{icon}</div>
        <div>
          <p className="text-sm text-slate-400">{label}</p>
          <p className={`text-2xl font-bold ${trendColor}`}>{value}</p>
        </div>
      </div>
    </div>
  );
}

const textColors = {
  good: 'text-green-400',
  warning: 'text-yellow-400',
  bad: 'text-red-400',
};

function StatusBadge({ status, label }: { status: 'good' | 'warning'; label: string }) {
  const colors = {
    good: 'bg-green-500/10 text-green-400 border-green-500/20',
    warning: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  };

  return (
    <span className={`px-2 py-1 text-xs font-medium rounded border ${colors[status]}`}>
      {label}
    </span>
  );
}

function SeverityBadge({ severity }: { severity: string }) {
  const colors: Record<string, string> = {
    LOW: 'bg-slate-500/10 text-slate-400',
    MEDIUM: 'bg-yellow-500/10 text-yellow-400',
    HIGH: 'bg-orange-500/10 text-orange-400',
    CRITICAL: 'bg-red-500/10 text-red-400',
  };

  return (
    <span className={`px-2 py-1 text-xs font-medium rounded ${colors[severity] || colors.LOW}`}>
      {severity}
    </span>
  );
}

function SetupHint({
  step,
  title,
  description,
  done,
}: {
  step: number;
  title: string;
  description: string;
  done: boolean;
}) {
  return (
    <div className="flex items-start gap-3">
      <div
        className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
          done ? 'bg-green-500 text-white' : 'bg-slate-700 text-slate-400'
        }`}
      >
        {done ? '✓' : step}
      </div>
      <div>
        <h4 className={`font-medium ${done ? 'text-slate-400' : 'text-white'}`}>{title}</h4>
        <p className="text-sm text-slate-500">{description}</p>
      </div>
    </div>
  );
}

function getRiskColor(score: number): string {
  if (score >= 80) return 'text-red-400';
  if (score >= 60) return 'text-orange-400';
  if (score >= 40) return 'text-yellow-400';
  return 'text-green-400';
}