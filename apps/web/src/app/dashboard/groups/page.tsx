'use client';

import Link from 'next/link';
import { Shield, Plus } from 'lucide-react';
import type { Group } from '@/types';

const mockGroups: Group[] = [
  {
    id: '1',
    telegramChatId: -1001234567890,
    name: 'Crypto Trading Signals',
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
    botAdminStatus: 'NOT_ADMIN',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

export default function GroupsPage() {
  const groups = mockGroups;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Your Groups</h1>
          <p className="text-slate-400 mt-1">Manage all groups protected by TOGI</p>
        </div>
        <button className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-2 transition-colors">
          <Plus className="w-4 h-4" />
          Add Group
        </button>
      </div>

      <div className="grid gap-4">
        {groups.map((group) => (
          <Link
            key={group.id}
            href={`/dashboard/groups/${group.id}`}
            className="bg-slate-900 border border-slate-800 rounded-xl p-6 hover:border-slate-700 transition-all group"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                  group.botAdminStatus === 'ADMIN' ? 'bg-green-500/10' : 'bg-yellow-500/10'
                }`}>
                  <Shield className={`w-6 h-6 ${
                    group.botAdminStatus === 'ADMIN' ? 'text-green-400' : 'text-yellow-400'
                  }`} />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white group-hover:text-blue-400 transition-colors">
                    {group.name}
                  </h3>
                  <p className="text-sm text-slate-400 mt-1">
                    ID: {group.telegramChatId} • {group.type}
                  </p>
                  <div className="flex items-center gap-2 mt-2">
                    <span className={`px-2 py-1 text-xs rounded ${
                      group.botAdminStatus === 'ADMIN'
                        ? 'bg-green-500/10 text-green-400'
                        : 'bg-yellow-500/10 text-yellow-400'
                    }`}>
                      {group.botAdminStatus === 'ADMIN' ? 'Protected' : 'Not Admin'}
                    </span>
                    <span className={`px-2 py-1 text-xs rounded ${
                      group.status === 'ACTIVE'
                        ? 'bg-slate-500/10 text-slate-400'
                        : 'bg-red-500/10 text-red-400'
                    }`}>
                      {group.status}
                    </span>
                  </div>
                </div>
              </div>
              <div className="text-slate-500 group-hover:text-white transition-colors">
                →
              </div>
            </div>
          </Link>
        ))}
      </div>

      {groups.length === 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-12 text-center">
          <Shield className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-white mb-2">No groups yet</h3>
          <p className="text-slate-400 mb-6">Add the TOGI bot to your Telegram group to get started.</p>
          <button className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors">
            Add Your First Group
          </button>
        </div>
      )}
    </div>
  );
}