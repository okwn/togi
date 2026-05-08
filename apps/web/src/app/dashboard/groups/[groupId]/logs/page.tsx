'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Calendar, Filter, Download } from 'lucide-react';
import type { Violation } from '@/types';

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
    groupId: '1',
    telegramUserId: 333,
    telegramMessageId: 'msg-3',
    violationType: 'THREAT',
    severity: 'HIGH',
    riskScore: 80,
    action: 'DELETE_WARN',
    reason: 'Harassment threat detected',
    createdAt: new Date(Date.now() - 900000).toISOString(),
  },
  {
    id: '4',
    groupId: '1',
    telegramUserId: 444,
    telegramMessageId: 'msg-4',
    violationType: 'DUPLICATE',
    severity: 'LOW',
    riskScore: 35,
    action: 'DELETE',
    reason: 'Same message repeated 3 times',
    createdAt: new Date(Date.now() - 1200000).toISOString(),
  },
  {
    id: '5',
    groupId: '1',
    telegramUserId: 555,
    telegramMessageId: 'msg-5',
    violationType: 'MENTION_SPAM',
    severity: 'MEDIUM',
    riskScore: 55,
    action: 'DELETE_WARN',
    reason: 'User mentioned 15 people in one message',
    createdAt: new Date(Date.now() - 1500000).toISOString(),
  },
];

export default function GroupLogsPage() {
  const params = useParams();
  const groupId = params.groupId as string;

  const [filters, setFilters] = useState({
    severity: '',
    label: '',
    action: '',
  });

  const violations = mockViolations;

  const filteredViolations = violations.filter((v) => {
    if (filters.severity && v.severity !== filters.severity) return false;
    if (filters.label && !v.violationType.includes(filters.label)) return false;
    if (filters.action && v.action !== filters.action) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-slate-400">
        <Link href="/dashboard" className="hover:text-white">Dashboard</Link>
        <span>/</span>
        <Link href={`/dashboard/groups/${groupId}`} className="hover:text-white">Group</Link>
        <span>/</span>
        <span className="text-white">Logs</span>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Violation Logs</h1>
          <p className="text-slate-400 mt-1">View and filter moderation actions</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
        <div className="flex flex-wrap gap-4">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400" />
            <span className="text-sm text-slate-400">Filters:</span>
          </div>

          <select
            value={filters.severity}
            onChange={(e) => setFilters((f) => ({ ...f, severity: e.target.value }))}
            className="bg-slate-800 border border-slate-700 text-white text-sm rounded-lg px-3 py-2"
          >
            <option value="">All Severities</option>
            <option value="LOW">LOW</option>
            <option value="MEDIUM">MEDIUM</option>
            <option value="HIGH">HIGH</option>
            <option value="CRITICAL">CRITICAL</option>
          </select>

          <select
            value={filters.label}
            onChange={(e) => setFilters((f) => ({ ...f, label: e.target.value }))}
            className="bg-slate-800 border border-slate-700 text-white text-sm rounded-lg px-3 py-2"
          >
            <option value="">All Labels</option>
            <option value="SPAM">SPAM</option>
            <option value="FLOOD">FLOOD</option>
            <option value="LINK">LINK</option>
            <option value="THREAT">THREAT</option>
            <option value="DUPLICATE">DUPLICATE</option>
            <option value="MENTION_SPAM">MENTION_SPAM</option>
          </select>

          <select
            value={filters.action}
            onChange={(e) => setFilters((f) => ({ ...f, action: e.target.value }))}
            className="bg-slate-800 border border-slate-700 text-white text-sm rounded-lg px-3 py-2"
          >
            <option value="">All Actions</option>
            <option value="DELETE">DELETE</option>
            <option value="DELETE_WARN">DELETE_WARN</option>
            <option value="DELETE_MUTE">DELETE_MUTE</option>
            <option value="DELETE_BAN">DELETE_BAN</option>
            <option value="WARN">WARN</option>
            <option value="MUTE">MUTE</option>
            <option value="BAN">BAN</option>
          </select>

          {(filters.severity || filters.label || filters.action) && (
            <button
              onClick={() => setFilters({ severity: '', label: '', action: '' })}
              className="text-sm text-blue-400 hover:text-blue-300"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* Violations Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-sm text-slate-400 border-b border-slate-800">
                <th className="p-4 font-medium">Time</th>
                <th className="p-4 font-medium">User ID</th>
                <th className="p-4 font-medium">Message ID</th>
                <th className="p-4 font-medium">Labels</th>
                <th className="p-4 font-medium">Severity</th>
                <th className="p-4 font-medium">Action</th>
                <th className="p-4 font-medium">Risk Score</th>
                <th className="p-4 font-medium">Reason</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {filteredViolations.map((violation) => (
                <tr key={violation.id} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                  <td className="p-4 text-slate-400">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-3 h-3" />
                      {new Date(violation.createdAt).toLocaleString()}
                    </div>
                  </td>
                  <td className="p-4 text-white font-mono">
                    {violation.telegramUserId ?? 'N/A'}
                  </td>
                  <td className="p-4 text-slate-400 font-mono">
                    {violation.telegramMessageId ?? 'N/A'}
                  </td>
                  <td className="p-4">
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
                  <td className="p-4">
                    <SeverityBadge severity={violation.severity} />
                  </td>
                  <td className="p-4">
                    <ActionBadge action={violation.action} />
                  </td>
                  <td className="p-4">
                    <span className={getRiskColor(violation.riskScore)}>
                      {violation.riskScore}
                    </span>
                  </td>
                  <td className="p-4 text-slate-300 max-w-xs truncate">
                    {violation.reason}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredViolations.length === 0 && (
          <div className="p-8 text-center text-slate-400">
            No violations found matching your filters
          </div>
        )}
      </div>
    </div>
  );
}

function SeverityBadge({ severity }: { severity: string }) {
  const colors: Record<string, string> = {
    LOW: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
    MEDIUM: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
    HIGH: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
    CRITICAL: 'bg-red-500/10 text-red-400 border-red-500/20',
  };

  return (
    <span className={`px-2 py-1 text-xs font-medium rounded border ${colors[severity] || colors.LOW}`}>
      {severity}
    </span>
  );
}

function ActionBadge({ action }: { action: string }) {
  const colors: Record<string, string> = {
    DELETE: 'bg-slate-500/10 text-slate-400',
    DELETE_WARN: 'bg-yellow-500/10 text-yellow-400',
    DELETE_MUTE: 'bg-orange-500/10 text-orange-400',
    DELETE_BAN: 'bg-red-500/10 text-red-400',
    WARN: 'bg-blue-500/10 text-blue-400',
    MUTE: 'bg-purple-500/10 text-purple-400',
    BAN: 'bg-red-500/10 text-red-400',
  };

  return (
    <span className={`px-2 py-1 text-xs font-medium rounded ${colors[action] || colors.DELETE}`}>
      {action}
    </span>
  );
}

function getRiskColor(score: number): string {
  if (score >= 80) return 'text-red-400';
  if (score >= 60) return 'text-orange-400';
  if (score >= 40) return 'text-yellow-400';
  return 'text-green-400';
}