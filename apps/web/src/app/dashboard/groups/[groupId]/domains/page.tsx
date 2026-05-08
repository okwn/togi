'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Plus, Trash2, Globe, Shield, Eye, AlertTriangle } from 'lucide-react';
import type { DomainRule } from '@/types';

const mockDomainRules: DomainRule[] = [
  { id: '1', groupId: '1', domain: 'telegram.org', ruleType: 'ALLOW', createdAt: new Date().toISOString() },
  { id: '2', groupId: '1', domain: 'github.com', ruleType: 'ALLOW', createdAt: new Date().toISOString() },
  { id: '3', groupId: '1', domain: 'bit.ly', ruleType: 'BLOCK', createdAt: new Date().toISOString() },
  { id: '4', groupId: '1', domain: 'tinyurl.com', ruleType: 'BLOCK', createdAt: new Date().toISOString() },
  { id: '5', groupId: '1', domain: 'suspicious.xyz', ruleType: 'WATCH', createdAt: new Date().toISOString() },
];

function isValidDomain(domain: string): boolean {
  const domainRegex = /^([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;
  return domainRegex.test(domain);
}

export default function GroupDomainsPage() {
  const params = useParams();
  const groupId = params.groupId as string;

  const [domainRules, setDomainRules] = useState(mockDomainRules);
  const [newDomain, setNewDomain] = useState('');
  const [newRuleType, setNewRuleType] = useState<'ALLOW' | 'BLOCK' | 'WATCH'>('ALLOW');
  const [error, setError] = useState('');

  const allowlist = domainRules.filter((r) => r.ruleType === 'ALLOW');
  const blocklist = domainRules.filter((r) => r.ruleType === 'BLOCK');
  const watchlist = domainRules.filter((r) => r.ruleType === 'WATCH');

  const handleAddDomain = () => {
    setError('');

    if (!newDomain.trim()) {
      setError('Please enter a domain');
      return;
    }

    if (!isValidDomain(newDomain.trim())) {
      setError('Please enter a valid domain (e.g., example.com)');
      return;
    }

    if (domainRules.some((r) => r.domain === newDomain.trim())) {
      setError('Domain already exists in list');
      return;
    }

    const newRule: DomainRule = {
      id: Date.now().toString(),
      groupId,
      domain: newDomain.trim().toLowerCase(),
      ruleType: newRuleType,
      createdAt: new Date().toISOString(),
    };

    setDomainRules([...domainRules, newRule]);
    setNewDomain('');
  };

  const handleDeleteDomain = (id: string) => {
    setDomainRules(domainRules.filter((r) => r.id !== id));
  };

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-slate-400">
        <Link href="/dashboard" className="hover:text-white">Dashboard</Link>
        <span>/</span>
        <Link href={`/dashboard/groups/${groupId}`} className="hover:text-white">Group</Link>
        <span>/</span>
        <span className="text-white">Domain Rules</span>
      </div>

      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white">Domain Rules</h1>
        <p className="text-slate-400 mt-1">Manage allowlists, blocklists, and watchlists for domains</p>
      </div>

      {/* Add Domain Form */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Add Domain Rule</h3>

        <div className="flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-64">
            <label className="block text-sm text-slate-400 mb-2">Domain</label>
            <input
              type="text"
              value={newDomain}
              onChange={(e) => setNewDomain(e.target.value)}
              placeholder="example.com"
              className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm text-slate-400 mb-2">Rule Type</label>
            <div className="flex gap-2">
              {(['ALLOW', 'BLOCK', 'WATCH'] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => setNewRuleType(type)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    newRuleType === type
                      ? type === 'ALLOW'
                        ? 'bg-green-600 text-white'
                        : type === 'BLOCK'
                        ? 'bg-red-600 text-white'
                        : 'bg-yellow-600 text-white'
                      : 'bg-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  {type.charAt(0) + type.slice(1).toLowerCase()}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={handleAddDomain}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium flex items-center gap-2 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add
          </button>
        </div>

        {error && (
          <div className="mt-4 flex items-center gap-2 text-red-400 text-sm">
            <AlertTriangle className="w-4 h-4" />
            {error}
          </div>
        )}

        {/* Rule Type Explanations */}
        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div className="p-3 bg-green-500/5 border border-green-500/20 rounded-lg">
            <div className="flex items-center gap-2 text-green-400 font-medium mb-1">
              <Shield className="w-4 h-4" />
              Allowlist
            </div>
            <p className="text-slate-400">Domains that are never blocked, even if they appear in threat lists.</p>
          </div>
          <div className="p-3 bg-red-500/5 border border-red-500/20 rounded-lg">
            <div className="flex items-center gap-2 text-red-400 font-medium mb-1">
              <Shield className="w-4 h-4" />
              Blocklist
            </div>
            <p className="text-slate-400">Domains that are always blocked, regardless of context.</p>
          </div>
          <div className="p-3 bg-yellow-500/5 border border-yellow-500/20 rounded-lg">
            <div className="flex items-center gap-2 text-yellow-400 font-medium mb-1">
              <Eye className="w-4 h-4" />
              Watchlist
            </div>
            <p className="text-slate-400">Domains that trigger alerts but are not automatically blocked.</p>
          </div>
        </div>
      </div>

      {/* Domain Tables */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Allowlist */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          <div className="p-4 border-b border-slate-800 flex items-center gap-2">
            <Shield className="w-4 h-4 text-green-400" />
            <h3 className="font-semibold text-white">Allowlist</h3>
            <span className="ml-auto text-sm text-slate-400">{allowlist.length}</span>
          </div>
          <div className="divide-y divide-slate-800">
            {allowlist.map((rule) => (
              <div key={rule.id} className="p-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Globe className="w-4 h-4 text-slate-400" />
                  <span className="text-white font-mono text-sm">{rule.domain}</span>
                </div>
                <button
                  onClick={() => handleDeleteDomain(rule.id)}
                  className="text-slate-500 hover:text-red-400 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
            {allowlist.length === 0 && (
              <div className="p-4 text-center text-slate-500 text-sm">No domains in allowlist</div>
            )}
          </div>
        </div>

        {/* Blocklist */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          <div className="p-4 border-b border-slate-800 flex items-center gap-2">
            <Shield className="w-4 h-4 text-red-400" />
            <h3 className="font-semibold text-white">Blocklist</h3>
            <span className="ml-auto text-sm text-slate-400">{blocklist.length}</span>
          </div>
          <div className="divide-y divide-slate-800">
            {blocklist.map((rule) => (
              <div key={rule.id} className="p-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Globe className="w-4 h-4 text-slate-400" />
                  <span className="text-white font-mono text-sm">{rule.domain}</span>
                </div>
                <button
                  onClick={() => handleDeleteDomain(rule.id)}
                  className="text-slate-500 hover:text-red-400 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
            {blocklist.length === 0 && (
              <div className="p-4 text-center text-slate-500 text-sm">No domains in blocklist</div>
            )}
          </div>
        </div>

        {/* Watchlist */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          <div className="p-4 border-b border-slate-800 flex items-center gap-2">
            <Eye className="w-4 h-4 text-yellow-400" />
            <h3 className="font-semibold text-white">Watchlist</h3>
            <span className="ml-auto text-sm text-slate-400">{watchlist.length}</span>
          </div>
          <div className="divide-y divide-slate-800">
            {watchlist.map((rule) => (
              <div key={rule.id} className="p-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Globe className="w-4 h-4 text-slate-400" />
                  <span className="text-white font-mono text-sm">{rule.domain}</span>
                </div>
                <button
                  onClick={() => handleDeleteDomain(rule.id)}
                  className="text-slate-500 hover:text-red-400 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
            {watchlist.length === 0 && (
              <div className="p-4 text-center text-slate-500 text-sm">No domains in watchlist</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}