'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ChevronLeft, Save, AlertTriangle } from 'lucide-react';
import type { PolicyConfig } from '@/types';

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

const tabs = [
  { id: 'spam', label: 'Spam & Flood', section: 'spamProtection' },
  { id: 'links', label: 'Link Protection', section: 'linkProtection' },
  { id: 'newmembers', label: 'New Members', section: 'newMemberProtection' },
  { id: 'threats', label: 'Threats', section: 'threatProtection' },
  { id: 'raid', label: 'Raid Protection', section: 'raidProtection' },
  { id: 'actions', label: 'Actions', section: 'actionPolicy' },
  { id: 'alerts', label: 'Admin Alerts', section: 'adminAlerts' },
];

export default function GroupSettingsPage() {
  const params = useParams();
  const groupId = params.groupId as string;

  const [policy, setPolicy] = useState<PolicyConfig>(mockPolicy);
  const [activeTab, setActiveTab] = useState('spam');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [hasChanges, setHasChanges] = useState(false);

  const handleSave = async () => {
    setSaveStatus('saving');
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setSaveStatus('saved');
    setHasChanges(false);
    setTimeout(() => setSaveStatus('idle'), 2000);
  };

  const updatePolicy = (path: string[], value: unknown) => {
    setPolicy((prev) => {
      const updated = JSON.parse(JSON.stringify(prev));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let current: any = updated;
      for (let i = 0; i < path.length - 1; i++) {
        const key = path[i];
        current[key] = { ...current[key] };
        current = current[key];
      }
      current[path[path.length - 1]] = value;
      return updated as PolicyConfig;
    });
    setHasChanges(true);
  };

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-slate-400">
        <Link href="/dashboard" className="hover:text-white">Dashboard</Link>
        <span>/</span>
        <Link href={`/dashboard/groups/${groupId}`} className="hover:text-white">Group</Link>
        <span>/</span>
        <span className="text-white">Settings</span>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Group Settings</h1>
          <p className="text-slate-400 mt-1">Configure protection settings for this group</p>
        </div>
        <button
          onClick={handleSave}
          disabled={!hasChanges || saveStatus === 'saving'}
          className={`px-4 py-2 rounded-lg flex items-center gap-2 font-medium transition-all ${
            !hasChanges
              ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
              : saveStatus === 'saving'
              ? 'bg-blue-600 text-white'
              : saveStatus === 'saved'
              ? 'bg-green-600 text-white'
              : 'bg-blue-600 hover:bg-blue-700 text-white'
          }`}
        >
          <Save className="w-4 h-4" />
          {saveStatus === 'idle' && 'Save Changes'}
          {saveStatus === 'saving' && 'Saving...'}
          {saveStatus === 'saved' && 'Saved!'}
        </button>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-800">
        <nav className="flex gap-1 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-blue-500 text-white'
                  : 'border-transparent text-slate-400 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        {activeTab === 'spam' && (
          <SpamFloodSettings policy={policy} onChange={updatePolicy} />
        )}
        {activeTab === 'links' && (
          <LinkProtectionSettings policy={policy} onChange={updatePolicy} />
        )}
        {activeTab === 'newmembers' && (
          <NewMemberSettings policy={policy} onChange={updatePolicy} />
        )}
        {activeTab === 'threats' && (
          <ThreatSettings policy={policy} onChange={updatePolicy} />
        )}
        {activeTab === 'raid' && (
          <RaidSettings policy={policy} onChange={updatePolicy} />
        )}
        {activeTab === 'actions' && (
          <ActionSettings policy={policy} onChange={updatePolicy} />
        )}
        {activeTab === 'alerts' && (
          <AlertSettings policy={policy} onChange={updatePolicy} />
        )}
      </div>
    </div>
  );
}

function SettingCard({
  title,
  description,
  children,
  warning,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  warning?: string;
}) {
  return (
    <div className="p-4 bg-slate-800/50 rounded-lg">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <h4 className="font-medium text-white">{title}</h4>
          <p className="text-sm text-slate-400 mt-1">{description}</p>
          {warning && (
            <div className="flex items-center gap-2 mt-2 text-xs text-yellow-400">
              <AlertTriangle className="w-3 h-3" />
              {warning}
            </div>
          )}
        </div>
        {children}
      </div>
    </div>
  );
}

function Toggle({
  enabled,
  onChange,
}: {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
}) {
  return (
    <button
      role="switch"
      aria-checked={enabled}
      onClick={() => onChange(!enabled)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
        enabled ? 'bg-blue-600' : 'bg-slate-700'
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
          enabled ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  );
}

function Slider({
  value,
  min,
  max,
  step = 1,
  onChange,
  unit = '',
}: {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  unit?: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="flex-1 h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
      />
      <span className="text-sm text-white font-medium w-16 text-right">
        {value}{unit}
      </span>
    </div>
  );
}

function SpamFloodSettings({
  policy,
  onChange,
}: {
  policy: PolicyConfig;
  onChange: (path: string[], value: unknown) => void;
}) {
  const sp = policy.spamProtection;
  const fp = policy.floodProtection;

  return (
    <div className="space-y-6">
      <SettingCard
        title="Enable Spam Protection"
        description="Detect and remove spam messages automatically"
      >
        <Toggle
          enabled={sp.enabled}
          onChange={(v) => onChange(['spamProtection', 'enabled'], v)}
        />
      </SettingCard>

      <SettingCard
        title="Delete Threshold"
        description="Risk score threshold for automatic deletion (0-100)"
        warning="Lower values = more aggressive deletion"
      >
        <div className="w-48">
          <Slider
            value={sp.deleteThreshold}
            min={0}
            max={100}
            onChange={(v) => onChange(['spamProtection', 'deleteThreshold'], v)}
          />
        </div>
      </SettingCard>

      <SettingCard
        title="Flood Detection"
        description="Messages per window before flood action is triggered"
      >
        <div className="space-y-4 w-64">
          <div>
            <label className="text-sm text-slate-400">Max Messages</label>
            <Slider
              value={fp.maxMessages}
              min={3}
              max={20}
              onChange={(v) => onChange(['floodProtection', 'maxMessages'], v)}
            />
          </div>
          <div>
            <label className="text-sm text-slate-400">Window (seconds)</label>
            <Slider
              value={fp.windowSeconds}
              min={5}
              max={120}
              onChange={(v) => onChange(['floodProtection', 'windowSeconds'], v)}
            />
          </div>
        </div>
      </SettingCard>
    </div>
  );
}

function LinkProtectionSettings({
  policy,
  onChange,
}: {
  policy: PolicyConfig;
  onChange: (path: string[], value: unknown) => void;
}) {
  const lp = policy.linkProtection;

  return (
    <div className="space-y-6">
      <SettingCard
        title="Enable Link Protection"
        description="Block malicious links and suspicious URLs"
      >
        <Toggle
          enabled={lp.enabled}
          onChange={(v) => onChange(['linkProtection', 'enabled'], v)}
        />
      </SettingCard>

      <SettingCard
        title="Block URL Shorteners"
        description="bit.ly, tinyurl.com, goo.gl, and similar services"
        warning="May affect legitimate shortened links"
      >
        <Toggle
          enabled={!lp.allowShorteners}
          onChange={(v) => onChange(['linkProtection', 'allowShorteners'], !v)}
        />
      </SettingCard>

      <SettingCard
        title="New Users Cannot Send Links"
        description="New users cannot post links during their probation period"
      >
        <Toggle
          enabled={lp.blockNewUserLinks}
          onChange={(v) => onChange(['linkProtection', 'blockNewUserLinks'], v)}
        />
      </SettingCard>

      <SettingCard
        title="Block Telegram Invites"
        description="Prevent users from sharing invite links to other Telegram groups"
      >
        <Toggle
          enabled={lp.blockTelegramInvites}
          onChange={(v) => onChange(['linkProtection', 'blockTelegramInvites'], v)}
        />
      </SettingCard>

      <SettingCard
        title="Block Discord Invites"
        description="Prevent users from sharing Discord server invite links"
      >
        <Toggle
          enabled={lp.blockDiscordInvites}
          onChange={(v) => onChange(['linkProtection', 'blockDiscordInvites'], v)}
        />
      </SettingCard>
    </div>
  );
}

function NewMemberSettings({
  policy,
  onChange,
}: {
  policy: PolicyConfig;
  onChange: (path: string[], value: unknown) => void;
}) {
  const nmp = policy.newMemberProtection;

  return (
    <div className="space-y-6">
      <SettingCard
        title="Enable New Member Protection"
        description="Apply restrictions to newly joined users"
      >
        <Toggle
          enabled={nmp.enabled}
          onChange={(v) => onChange(['newMemberProtection', 'enabled'], v)}
        />
      </SettingCard>

      <SettingCard
        title="Probation Period"
        description="How long new users are in probation (minutes)"
      >
        <div className="w-48">
          <Slider
            value={nmp.probationMinutes}
            min={1}
            max={60}
            onChange={(v) => onChange(['newMemberProtection', 'probationMinutes'], v)}
          />
        </div>
      </SettingCard>

      <SettingCard
        title="Restrict New Users"
        description="Apply message restrictions to new users during probation"
      >
        <Toggle
          enabled={nmp.restrictNewUsers}
          onChange={(v) => onChange(['newMemberProtection', 'restrictNewUsers'], v)}
        />
      </SettingCard>

      <SettingCard
        title="Allow Media"
        description="Allow new users to send photos, videos, and files"
      >
        <Toggle
          enabled={nmp.allowMedia}
          onChange={(v) => onChange(['newMemberProtection', 'allowMedia'], v)}
        />
      </SettingCard>
    </div>
  );
}

function ThreatSettings({
  policy,
  onChange,
}: {
  policy: PolicyConfig;
  onChange: (path: string[], value: unknown) => void;
}) {
  const tp = policy.threatProtection;

  return (
    <div className="space-y-6">
      <SettingCard
        title="Enable Threat Protection"
        description="Detect threats, harassment, and harmful content"
      >
        <Toggle
          enabled={tp.enabled}
          onChange={(v) => onChange(['threatProtection', 'enabled'], v)}
        />
      </SettingCard>

      <SettingCard
        title="Scan Messages"
        description="Analyze message content for threats and harassment"
      >
        <Toggle
          enabled={tp.scanMessages}
          onChange={(v) => onChange(['threatProtection', 'scanMessages'], v)}
        />
      </SettingCard>

      <SettingCard
        title="Block Keywords"
        description="Use keyword lists to detect harmful content"
        warning="Ensure your keyword lists are regularly updated"
      >
        <Toggle
          enabled={tp.blockKeywords}
          onChange={(v) => onChange(['threatProtection', 'blockKeywords'], v)}
        />
      </SettingCard>
    </div>
  );
}

function RaidSettings({
  policy,
  onChange,
}: {
  policy: PolicyConfig;
  onChange: (path: string[], value: unknown) => void;
}) {
  const rp = policy.raidProtection;

  return (
    <div className="space-y-6">
      <SettingCard
        title="Enable Raid Protection"
        description="Detect and respond to raid attacks"
      >
        <Toggle
          enabled={rp.enabled}
          onChange={(v) => onChange(['raidProtection', 'enabled'], v)}
        />
      </SettingCard>

      <SettingCard
        title="Join Detection Window"
        description="Time window to track join bursts (seconds)"
      >
        <div className="w-48">
          <Slider
            value={rp.joinWindowSeconds}
            min={10}
            max={300}
            onChange={(v) => onChange(['raidProtection', 'joinWindowSeconds'], v)}
          />
        </div>
      </SettingCard>

      <SettingCard
        title="Maximum Allowed Joins"
        description="Maximum joins in window before raid is detected"
      >
        <div className="w-48">
          <Slider
            value={rp.maxJoins}
            min={3}
            max={50}
            onChange={(v) => onChange(['raidProtection', 'maxJoins'], v)}
          />
        </div>
      </SettingCard>

      <SettingCard
        title="Auto Lockdown"
        description="Automatically lockdown group when raid is detected"
        warning="All members except admins will be muted"
      >
        <Toggle
          enabled={rp.autoLockdown}
          onChange={(v) => onChange(['raidProtection', 'autoLockdown'], v)}
        />
      </SettingCard>
    </div>
  );
}

function ActionSettings({
  policy,
  onChange,
}: {
  policy: PolicyConfig;
  onChange: (path: string[], value: unknown) => void;
}) {
  const ap = policy.actionPolicy;

  return (
    <div className="space-y-6">
      <SettingCard
        title="Warn Threshold"
        description="Warnings before mute action is triggered"
      >
        <div className="w-32">
          <Slider
            value={ap.warnThreshold}
            min={1}
            max={10}
            onChange={(v) => onChange(['actionPolicy', 'warnThreshold'], v)}
          />
        </div>
      </SettingCard>

      <SettingCard
        title="Mute Duration"
        description="How long users are muted (minutes)"
      >
        <div className="w-32">
          <Slider
            value={ap.muteDurationMinutes}
            min={5}
            max={1440}
            onChange={(v) => onChange(['actionPolicy', 'muteDurationMinutes'], v)}
          />
        </div>
      </SettingCard>

      <SettingCard
        title="Maximum Warnings"
        description="Maximum warnings before user is banned"
      >
        <div className="w-32">
          <Slider
            value={ap.maxWarnings}
            min={1}
            max={10}
            onChange={(v) => onChange(['actionPolicy', 'maxWarnings'], v)}
          />
        </div>
      </SettingCard>
    </div>
  );
}

function AlertSettings({
  policy,
  onChange,
}: {
  policy: PolicyConfig;
  onChange: (path: string[], value: unknown) => void;
}) {
  const aa = policy.adminAlerts;

  return (
    <div className="space-y-6">
      <SettingCard
        title="Enable Admin Alerts"
        description="Receive alerts for high-severity violations"
      >
        <Toggle
          enabled={aa.enabled}
          onChange={(v) => onChange(['adminAlerts', 'enabled'], v)}
        />
      </SettingCard>

      <SettingCard
        title="Alert Threshold"
        description="Minimum severity to trigger alerts"
      >
        <div className="flex gap-2">
          {(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const).map((level) => (
            <button
              key={level}
              onClick={() => onChange(['adminAlerts', 'severityThreshold'], level)}
              className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                aa.severityThreshold === level
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              {level}
            </button>
          ))}
        </div>
      </SettingCard>
    </div>
  );
}