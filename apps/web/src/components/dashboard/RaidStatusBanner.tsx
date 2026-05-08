'use client';

import { useState, useEffect } from 'react';

interface RaidStatus {
  active: boolean;
  startedAt: number | null;
  reason: string | null;
  expiresAt: number | null;
  triggerStats: {
    joins: number;
    messages: number;
    links: number;
    newUsersLinks: number;
    mentions: number;
  };
}

interface RaidStatusBannerProps {
  groupId: string;
}

export function RaidStatusBanner({ groupId }: RaidStatusBannerProps) {
  const [raidStatus, setRaidStatus] = useState<RaidStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchRaidStatus() {
      try {
        const response = await fetch(`/api/groups/${groupId}/raid-status`);
        if (response.ok) {
          const data = await response.json();
          setRaidStatus(data);
        }
      } catch {
        // Silently fail
      } finally {
        setLoading(false);
      }
    }

    fetchRaidStatus();
    const interval = setInterval(fetchRaidStatus, 30000);
    return () => clearInterval(interval);
  }, [groupId]);

  if (loading) {
    return (
      <div className="animate-pulse h-20 bg-gray-100 rounded-lg" />
    );
  }

  if (!raidStatus?.active) {
    return null;
  }

  const startedAt = raidStatus.startedAt
    ? new Date(raidStatus.startedAt).toLocaleTimeString()
    : 'Unknown';
  const expiresAt = raidStatus.expiresAt
    ? new Date(raidStatus.expiresAt).toLocaleTimeString()
    : 'Unknown';

  return (
    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-red-600 text-xl">🚨</span>
        <h3 className="font-semibold text-red-800">Raid Mode Active</h3>
      </div>
      <p className="text-sm text-red-700 mb-2">
        <strong>Reason:</strong> {raidStatus.reason || 'Unknown'}
      </p>
      <p className="text-sm text-red-700 mb-2">
        <strong>Started:</strong> {startedAt} | <strong>Expires:</strong> {expiresAt}
      </p>
      <div className="grid grid-cols-5 gap-2 text-xs text-red-700">
        <div className="text-center p-2 bg-red-100 rounded">
          <div className="font-semibold">{raidStatus.triggerStats?.joins || 0}</div>
          <div>Joins</div>
        </div>
        <div className="text-center p-2 bg-red-100 rounded">
          <div className="font-semibold">{raidStatus.triggerStats?.messages || 0}</div>
          <div>Messages</div>
        </div>
        <div className="text-center p-2 bg-red-100 rounded">
          <div className="font-semibold">{raidStatus.triggerStats?.links || 0}</div>
          <div>Links</div>
        </div>
        <div className="text-center p-2 bg-red-100 rounded">
          <div className="font-semibold">{raidStatus.triggerStats?.newUsersLinks || 0}</div>
          <div>New User Links</div>
        </div>
        <div className="text-center p-2 bg-red-100 rounded">
          <div className="font-semibold">{raidStatus.triggerStats?.mentions || 0}</div>
          <div>Mentions</div>
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        <button
          onClick={async () => {
            await fetch(`/api/groups/${groupId}/lockdown`, { method: 'DELETE' });
            setRaidStatus({ ...raidStatus, active: false });
          }}
          className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700"
        >
          Unlock Group
        </button>
      </div>
    </div>
  );
}

export default RaidStatusBanner;
