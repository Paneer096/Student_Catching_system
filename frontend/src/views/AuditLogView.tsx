import React, { useState, useEffect } from 'react';
import { api, AuditLogItem } from '../api/client';

export interface AuditLogViewProps {
  onNavigate: (viewId: string) => void;
}

export const AuditLogView: React.FC<AuditLogViewProps> = () => {
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [verifying, setVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState<{ verified: boolean; message: string; total_records: number } | null>(null);

  const fetchLogs = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getAuditLogs();
      setLogs(data);
    } catch (err: any) {
      setError(err?.message || 'Failed to fetch audit log');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const handleVerifyChain = async () => {
    setVerifying(true);
    setVerifyResult(null);
    try {
      const res = await api.verifyAuditChain();
      setVerifyResult(res);
    } catch (err: any) {
      alert(`Audit verification failed: ${err.message}`);
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-8">
      {/* Header */}
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold text-primary tracking-tight">Tamper-Evident Audit Trail</h1>
          <p className="text-sm text-on-surface-variant mt-0.5">
            Cryptographic SHA-256 hash-chained log guaranteeing accountability, non-repudiation, and privacy compliance.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleVerifyChain}
            disabled={verifying}
            className="px-3.5 py-1.5 bg-primary text-on-primary rounded-lg text-xs font-semibold hover:opacity-90 transition-opacity flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-[16px]">
              {verifying ? 'sync' : 'verified_user'}
            </span>
            {verifying ? 'Verifying Hashes...' : 'Verify Chain Integrity'}
          </button>
        </div>
      </div>

      {verifyResult && (
        <div
          className={`p-4 rounded-xl border flex items-center gap-3 text-xs font-semibold ${
            verifyResult.verified
              ? 'bg-tertiary-container/30 border-tertiary/40 text-on-tertiary-container'
              : 'bg-error-container/30 border-error/40 text-on-error-container'
          }`}
        >
          <span className="material-symbols-outlined text-[20px]">
            {verifyResult.verified ? 'check_circle' : 'warning'}
          </span>
          <div>
            <div className="font-bold">
              {verifyResult.verified ? 'Chain Integrity Verified' : 'Chain Integrity Violation'}
            </div>
            <div className="font-normal mt-0.5 text-on-surface-variant">
              {verifyResult.message} ({verifyResult.total_records} total cryptographic links examined)
            </div>
          </div>
        </div>
      )}

      {/* Main Table / Container */}
      <div className="bg-surface-container-lowest rounded-xl border border-outline-variant overflow-hidden shadow-xs">
        <div className="p-4 bg-surface-container-low border-b border-outline-variant flex justify-between items-center">
          <h3 className="text-xs font-bold text-on-surface uppercase tracking-wider">
            Audit Records ({logs.length})
          </h3>
          <button
            onClick={fetchLogs}
            className="text-xs text-primary font-semibold hover:underline flex items-center gap-1 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[14px]">refresh</span> Refresh
          </button>
        </div>

        {loading ? (
          <div className="p-12 text-center text-xs text-on-surface-variant flex flex-col items-center justify-center space-y-2">
            <span className="material-symbols-outlined text-[24px] text-primary animate-spin">sync</span>
            <span>Verifying audit database records...</span>
          </div>
        ) : error ? (
          <div className="p-8 text-center text-xs text-error space-y-2">
            <p>{error}</p>
            <button
              onClick={fetchLogs}
              className="text-xs text-primary underline cursor-pointer"
            >
              Try again
            </button>
          </div>
        ) : logs.length === 0 ? (
          <div className="p-12 text-center text-xs text-on-surface-variant space-y-2">
            <span className="material-symbols-outlined text-[32px] text-outline">history_edu</span>
            <p className="font-bold text-on-surface">No Audit Events Logged Yet</p>
            <p className="max-w-md mx-auto">
              System events such as logins, dataset ingestions, student identity views, and intervention deployments are automatically committed to this immutable SHA-256 hash chain.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-surface-container border-b border-outline-variant text-[11px] font-semibold text-on-surface-variant uppercase">
                  <th className="p-3">Log ID</th>
                  <th className="p-3">Actor / Role</th>
                  <th className="p-3">Action</th>
                  <th className="p-3">SHA-256 Hash</th>
                  <th className="p-3">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant font-mono">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-surface-container-low transition-colors">
                    <td className="p-3 font-semibold text-primary">{log.id.slice(0, 8)}</td>
                    <td className="p-3 font-sans text-on-surface">
                      <div className="font-semibold">{log.actor_user_id}</div>
                      <div className="text-[10px] text-on-surface-variant uppercase">{log.actor_role}</div>
                    </td>
                    <td className="p-3 font-sans font-semibold text-primary">{log.action}</td>
                    <td className="p-3 text-[10px] text-on-surface-variant max-w-xs truncate" title={log.hash}>
                      {log.hash.slice(0, 16)}...
                    </td>
                    <td className="p-3 text-[11px] text-on-surface-variant font-sans">{log.timestamp}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
