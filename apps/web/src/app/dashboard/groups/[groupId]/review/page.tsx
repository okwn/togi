'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';

interface ReviewItem {
  id: string;
  itemType: 'message' | 'user';
  itemId: string | null;
  telegramUserId: string | null;
  telegramMessageId: string | null;
  reason: string;
  reasonType: string;
  labels: string[];
  riskScore: number;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED';
  createdAt: string;
}

export default function ReviewQueuePage() {
  const params = useParams();
  const groupId = params.groupId as string;

  const [items, setItems] = useState<ReviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'PENDING' | 'APPROVED' | 'REJECTED'>('PENDING');
  const [processing, setProcessing] = useState<string | null>(null);

  const fetchItems = useCallback(async () => {
    try {
      const response = await fetch(`/api/groups/${groupId}/review-queue?status=${filter}`);
      if (response.ok) {
        const data = await response.json();
        setItems(data.items || []);
      }
    } catch (error) {
      console.error('Failed to fetch review queue:', error);
    } finally {
      setLoading(false);
    }
  }, [groupId, filter]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const handleApprove = async (itemId: string) => {
    setProcessing(itemId);
    try {
      const response = await fetch(`/api/groups/${groupId}/review-queue/${itemId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (response.ok) {
        setItems(items.filter(item => item.id !== itemId));
      }
    } finally {
      setProcessing(null);
    }
  };

  const handleReject = async (itemId: string) => {
    setProcessing(itemId);
    try {
      const response = await fetch(`/api/groups/${groupId}/review-queue/${itemId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (response.ok) {
        setItems(items.filter(item => item.id !== itemId));
      }
    } finally {
      setProcessing(null);
    }
  };

  const getReasonBadgeColor = (reasonType: string) => {
    switch (reasonType) {
      case 'LINK':
      case 'BLOCKED_DOMAIN':
        return 'bg-blue-100 text-blue-800';
      case 'SPAM':
      case 'FLOOD':
        return 'bg-yellow-100 text-yellow-800';
      case 'NEW_USER':
        return 'bg-purple-100 text-purple-800';
      case 'RAID':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Review Queue</h1>
        <div className="flex gap-2">
          {(['PENDING', 'APPROVED', 'REJECTED'] as const).map((status) => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filter === status
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse h-24 bg-gray-100 rounded-lg" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <p className="text-gray-500">No {filter.toLowerCase()} items in review queue</p>
        </div>
      ) : (
        <div className="space-y-4">
          {items.map((item) => (
            <div
              key={item.id}
              className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span
                      className={`px-2 py-1 rounded text-xs font-medium ${getReasonBadgeColor(
                        item.reasonType
                      )}`}
                    >
                      {item.reasonType}
                    </span>
                    <span className="text-xs text-gray-500">
                      {new Date(item.createdAt).toLocaleString()}
                    </span>
                    {item.riskScore && (
                      <span
                        className={`text-xs font-medium px-2 py-1 rounded ${
                          item.riskScore >= 70
                            ? 'bg-red-100 text-red-800'
                            : item.riskScore >= 50
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-green-100 text-green-800'
                        }`}
                      >
                        Risk: {item.riskScore}
                      </span>
                    )}
                  </div>

                  <p className="text-sm text-gray-700 mb-2">{item.reason}</p>

                  <div className="flex flex-wrap gap-1 mb-2">
                    {item.labels?.map((label, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded"
                      >
                        {label}
                      </span>
                    ))}
                  </div>

                  <p className="text-xs text-gray-500">
                    Type: {item.itemType}
                    {item.telegramUserId && ` | User: ${item.telegramUserId}`}
                    {item.telegramMessageId && ` | Message: ${item.telegramMessageId}`}
                  </p>
                </div>

                {filter === 'PENDING' && (
                  <div className="flex gap-2 ml-4">
                    <button
                      onClick={() => handleApprove(item.id)}
                      disabled={processing === item.id}
                      className="px-4 py-2 bg-green-600 text-white text-sm rounded hover:bg-green-700 disabled:opacity-50"
                    >
                      {processing === item.id ? 'Processing...' : 'Approve'}
                    </button>
                    <button
                      onClick={() => handleReject(item.id)}
                      disabled={processing === item.id}
                      className="px-4 py-2 bg-red-600 text-white text-sm rounded hover:bg-red-700 disabled:opacity-50"
                    >
                      {processing === item.id ? 'Processing...' : 'Reject'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
