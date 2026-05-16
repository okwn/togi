import { useState } from 'react';

interface AgentStatus {
  enabled: boolean;
  mode: string;
  lastRun: string | null;
}

interface AgentRun {
  id: string;
  startedAt: string;
  triggerType: string;
  status: string;
  executedCount: number;
  recommendedCount: number;
}

interface Recommendation {
  id: string;
  type: string;
  priority: string;
  reason: string;
  createdAt: string;
}

export default function AgentPage({ groupId }: { groupId: string }) {
  const [status, setStatus] = useState<AgentStatus>({
    enabled: false,
    mode: 'RECOMMEND_ONLY',
    lastRun: null,
  });

  const [runs, setRuns] = useState<AgentRun[]>([]);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);

  const handleApprove = async (id: string) => {
    // API call to approve recommendation
  };

  const handleReject = async (id: string) => {
    // API call to reject recommendation
  };

  return (
    <div className="space-y-6">
      {/* Agent Status Section */}
      <div className="bg-card rounded-lg p-6">
        <h2 className="text-lg font-medium mb-4">Security Agent</h2>
        <div className="flex items-center justify-between">
          <div>
            <p className={`text-sm ${status.enabled ? 'text-green-500' : 'text-red-500'}`}>
              {status.enabled ? '🟢 Enabled' : '🔴 Disabled'}
            </p>
            <p className="text-sm text-muted">Mode: {status.mode}</p>
            <p className="text-sm text-muted">
              Last run: {status.lastRun ?? 'Never'}
            </p>
          </div>
          <button
            onClick={() => setStatus(s => ({ ...s, enabled: !s.enabled }))}
            className={`px-4 py-2 rounded ${status.enabled ? 'bg-red-500' : 'bg-green-500'}`}
          >
            {status.enabled ? 'Disable' : 'Enable'}
          </button>
        </div>
      </div>

      {/* Recent Agent Runs */}
      <div className="bg-card rounded-lg p-6">
        <h3 className="text-md font-medium mb-4">Recent Agent Runs</h3>
        {runs.length === 0 ? (
          <p className="text-muted text-sm">No agent runs yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2">Time</th>
                <th className="text-left py-2">Trigger</th>
                <th className="text-left py-2">Status</th>
                <th className="text-left py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {runs.map(run => (
                <tr key={run.id} className="border-b">
                  <td className="py-2">{new Date(run.startedAt).toLocaleString()}</td>
                  <td className="py-2">{run.triggerType}</td>
                  <td className="py-2">{run.status}</td>
                  <td className="py-2">{run.executedCount} exec, {run.recommendedCount} rec</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pending Recommendations */}
      <div className="bg-card rounded-lg p-6">
        <h3 className="text-md font-medium mb-4">Pending Recommendations</h3>
        {recommendations.length === 0 ? (
          <p className="text-muted text-sm">No pending recommendations.</p>
        ) : (
          <div className="space-y-4">
            {recommendations.map(rec => (
              <div key={rec.id} className="border rounded-lg p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <span className={`text-xs px-2 py-1 rounded ${
                      rec.priority === 'HIGH' ? 'bg-red-500/20 text-red-400' :
                      rec.priority === 'MEDIUM' ? 'bg-yellow-500/20 text-yellow-400' :
                      'bg-blue-500/20 text-blue-400'
                    }`}>
                      {rec.type}
                    </span>
                    <p className="text-sm mt-2">{rec.reason}</p>
                    <p className="text-xs text-muted mt-1">
                      {new Date(rec.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleApprove(rec.id)}
                      className="px-3 py-1 bg-green-500/20 text-green-400 rounded text-sm"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => handleReject(rec.id)}
                      className="px-3 py-1 bg-red-500/20 text-red-400 rounded text-sm"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Agent Configuration */}
      <div className="bg-card rounded-lg p-6">
        <h3 className="text-md font-medium mb-4">Configuration</h3>
        <div className="space-y-4">
          <div>
            <label className="text-sm text-muted">Mode</label>
            <select
              value={status.mode}
              onChange={(e) => setStatus(s => ({ ...s, mode: e.target.value }))}
              className="w-full mt-1 bg-background border rounded px-3 py-2"
            >
              <option value="OBSERVE_ONLY">Observe Only</option>
              <option value="RECOMMEND_ONLY">Recommend Only</option>
              <option value="AUTO_LOW_RISK">Auto (Low Risk)</option>
              <option value="AUTO_HIGH_RISK_WITH_POLICY">Auto (High Risk with Policy)</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}