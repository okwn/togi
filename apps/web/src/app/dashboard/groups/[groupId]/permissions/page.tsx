'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Shield, Check, X, RefreshCw, ExternalLink } from 'lucide-react';

const requiredPermissions = [
  { name: 'Delete Messages', description: 'Remove spam and inappropriate messages', required: true },
  { name: 'Restrict Members', description: 'Mute, kick, or ban users who violate rules', required: true },
  { name: 'Invite Users', description: 'Manage join requests and invite links', required: false },
  { name: 'Manage Chat', description: 'Change group settings and permissions', required: false },
  { name: 'Pin Messages', description: 'Pin important announcements', required: false },
];

const botStatus = {
  isAdmin: true,
  permissions: {
    can_delete_messages: true,
    can_restrict_members: true,
    can_invite_users: true,
    can_manage_chat: false,
    can_pin_messages: true,
  },
};

export default function GroupPermissionsPage() {
  const params = useParams();
  const groupId = params.groupId as string;

  const isComplete = botStatus.isAdmin &&
    botStatus.permissions.can_delete_messages &&
    botStatus.permissions.can_restrict_members;

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-slate-400">
        <Link href="/dashboard" className="hover:text-white">Dashboard</Link>
        <span>/</span>
        <Link href={`/dashboard/groups/${groupId}`} className="hover:text-white">Group</Link>
        <span>/</span>
        <span className="text-white">Permissions</span>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Bot Permissions</h1>
          <p className="text-slate-400 mt-1">Check and manage TOGI bot permissions in your group</p>
        </div>
        <button className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg flex items-center gap-2 transition-colors">
          <RefreshCw className="w-4 h-4" />
          Recheck Permissions
        </button>
      </div>

      {/* Status Banner */}
      {isComplete ? (
        <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-500/20 rounded-full flex items-center justify-center">
              <Check className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-green-400">All Required Permissions Granted</h3>
              <p className="text-green-400/80 text-sm mt-1">
                TOGI bot has all the permissions it needs to protect your group effectively.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-yellow-500/20 rounded-full flex items-center justify-center">
              <X className="w-5 h-5 text-yellow-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-yellow-400">Missing Required Permissions</h3>
              <p className="text-yellow-400/80 text-sm mt-1">
                TOGI needs at least Delete Messages and Restrict Members permissions to function.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Permission Checklist */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-white mb-6">Required Telegram Permissions</h3>
        <div className="space-y-4">
          {requiredPermissions.map((perm) => {
            const hasPermission = perm.required
              ? botStatus.isAdmin && botStatus.permissions[perm.name.toLowerCase().replace(/ /g, '_') as keyof typeof botStatus.permissions] !== false
              : botStatus.permissions[perm.name.toLowerCase().replace(/ /g, '_') as keyof typeof botStatus.permissions] === true;

            return (
              <div
                key={perm.name}
                className={`p-4 rounded-lg border ${
                  hasPermission
                    ? 'bg-green-500/5 border-green-500/20'
                    : perm.required
                    ? 'bg-red-500/5 border-red-500/20'
                    : 'bg-slate-800/50 border-slate-700'
                }`}
              >
                <div className="flex items-start gap-4">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                    hasPermission ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                  }`}>
                    {hasPermission ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className={`font-medium ${hasPermission ? 'text-green-400' : 'text-red-400'}`}>
                        {perm.name}
                      </h4>
                      {perm.required && (
                        <span className="px-2 py-0.5 text-xs bg-slate-700 text-slate-300 rounded">Required</span>
                      )}
                    </div>
                    <p className="text-sm text-slate-400 mt-1">{perm.description}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* How to Fix */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-white mb-4">How to Grant Permissions</h3>
        <ol className="space-y-3 text-slate-400">
          <li className="flex items-start gap-3">
            <span className="w-6 h-6 bg-slate-800 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">1</span>
            <span>Open your Telegram group and go to Group Settings</span>
          </li>
          <li className="flex items-start gap-3">
            <span className="w-6 h-6 bg-slate-800 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">2</span>
            <span>Tap on "Add Admin" or edit the TOGI bot's existing admin status</span>
          </li>
          <li className="flex items-start gap-3">
            <span className="w-6 h-6 bg-slate-800 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">3</span>
            <span>Enable the required permissions (Delete Messages, Restrict Members)</span>
          </li>
          <li className="flex items-start gap-3">
            <span className="w-6 h-6 bg-slate-800 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">4</span>
            <span>Save the changes and return to this dashboard</span>
          </li>
        </ol>

        <div className="mt-6 p-4 bg-slate-800/50 rounded-lg">
          <p className="text-sm text-slate-400">
            <strong className="text-white">Note:</strong> The TOGI bot needs to be re-added as an admin after making permission changes.
            You can do this by removing the bot and re-adding it with the new permissions.
          </p>
        </div>
      </div>
    </div>
  );
}