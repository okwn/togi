'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { AlertTriangle, Eye, History, RefreshCw, UserX, Shield } from 'lucide-react';
import type { Member } from '@/types';

const mockMembers: Member[] = [
  { telegramUserId: 111, username: 'spammer_user', firstName: 'Spam', punishmentType: 'WARN', punishmentExpiresAt: null, warningCount: 2 },
  { telegramUserId: 222, username: 'troll_account', firstName: 'Troll', punishmentType: 'MUTE', punishmentExpiresAt: new Date(Date.now() + 3600000).toISOString(), warningCount: 1 },
  { telegramUserId: 333, username: 'scam_bot', firstName: 'Scam', punishmentType: 'BAN', punishmentExpiresAt: null, warningCount: 5 },
  { telegramUserId: 444, username: 'normal_user', firstName: 'Normal', punishmentType: null, punishmentExpiresAt: null, warningCount: 0 },
];

export default function GroupMembersPage() {
  const params = useParams();
  const groupId = params.groupId as string;

  const members = mockMembers;

  const warned = members.filter((m) => m.punishmentType === 'WARN');
  const muted = members.filter((m) => m.punishmentType === 'MUTE');
  const banned = members.filter((m) => m.punishmentType === 'BAN');
  const risky = members.filter((m) => m.warningCount >= 1 && !m.punishmentType);

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-slate-400">
        <Link href="/dashboard" className="hover:text-white">Dashboard</Link>
        <span>/</span>
        <Link href={`/dashboard/groups/${groupId}`} className="hover:text-white">Group</Link>
        <span>/</span>
        <span className="text-white">Members</span>
      </div>

      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white">Group Members</h1>
        <p className="text-slate-400 mt-1">Manage punished users and view member status</p>
      </div>

      {/* Members Grid */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Risky Users */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          <div className="p-4 border-b border-slate-800 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-yellow-400" />
            <h3 className="font-semibold text-white">Risky Users</h3>
            <span className="ml-auto text-sm text-slate-400">{risky.length}</span>
          </div>
          <div className="divide-y divide-slate-800">
            {risky.map((member) => (
              <MemberRow key={member.telegramUserId} member={member} groupId={groupId} />
            ))}
            {risky.length === 0 && (
              <div className="p-4 text-center text-slate-500 text-sm">No risky users</div>
            )}
          </div>
        </div>

        {/* Warned Users */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          <div className="p-4 border-b border-slate-800 flex items-center gap-2">
            <Shield className="w-4 h-4 text-yellow-400" />
            <h3 className="font-semibold text-white">Warned Users</h3>
            <span className="ml-auto text-sm text-slate-400">{warned.length}</span>
          </div>
          <div className="divide-y divide-slate-800">
            {warned.map((member) => (
              <MemberRow key={member.telegramUserId} member={member} groupId={groupId} />
            ))}
            {warned.length === 0 && (
              <div className="p-4 text-center text-slate-500 text-sm">No warned users</div>
            )}
          </div>
        </div>

        {/* Muted Users */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          <div className="p-4 border-b border-slate-800 flex items-center gap-2">
            <Shield className="w-4 h-4 text-orange-400" />
            <h3 className="font-semibold text-white">Muted Users</h3>
            <span className="ml-auto text-sm text-slate-400">{muted.length}</span>
          </div>
          <div className="divide-y divide-slate-800">
            {muted.map((member) => (
              <MemberRow key={member.telegramUserId} member={member} groupId={groupId} />
            ))}
            {muted.length === 0 && (
              <div className="p-4 text-center text-slate-500 text-sm">No muted users</div>
            )}
          </div>
        </div>

        {/* Banned Users */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          <div className="p-4 border-b border-slate-800 flex items-center gap-2">
            <UserX className="w-4 h-4 text-red-400" />
            <h3 className="font-semibold text-white">Banned Users</h3>
            <span className="ml-auto text-sm text-slate-400">{banned.length}</span>
          </div>
          <div className="divide-y divide-slate-800">
            {banned.map((member) => (
              <MemberRow key={member.telegramUserId} member={member} groupId={groupId} />
            ))}
            {banned.length === 0 && (
              <div className="p-4 text-center text-slate-500 text-sm">No banned users</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function MemberRow({ member, groupId }: { member: Member; groupId: string }) {
  return (
    <div className="p-3 flex items-center justify-between">
      <div>
        <div className="flex items-center gap-2">
          <span className="text-white font-medium">
            {member.username ? `@${member.username}` : member.firstName}
          </span>
          {member.punishmentType && (
            <span className={`px-2 py-0.5 text-xs rounded ${
              member.punishmentType === 'BAN' ? 'bg-red-500/10 text-red-400' :
              member.punishmentType === 'MUTE' ? 'bg-orange-500/10 text-orange-400' :
              'bg-yellow-500/10 text-yellow-400'
            }`}>
              {member.punishmentType}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
          <span>ID: {member.telegramUserId}</span>
          {member.warningCount > 0 && (
            <span>{member.warningCount} warning{member.warningCount > 1 ? 's' : ''}</span>
          )}
          {member.punishmentExpiresAt && (
            <span>Expires: {new Date(member.punishmentExpiresAt).toLocaleTimeString()}</span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1">
        <button className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition-colors" title="View History">
          <History className="w-4 h-4" />
        </button>
        <button className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition-colors" title="Add to Watchlist">
          <Eye className="w-4 h-4" />
        </button>
        {member.punishmentType && (
          <button className="p-2 text-slate-400 hover:text-green-400 hover:bg-slate-800 rounded transition-colors" title="Revoke Punishment">
            <RefreshCw className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}