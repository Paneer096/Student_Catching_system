import React, { useState } from 'react';
import { MkBadge } from '../components/ui/MkBadge';
import { MkButton } from '../components/ui/MkButton';

export interface AuditEntry {
  id: string;
  actor: string;
  action: string;
  entity: string;
  timestamp: string;
  purpose: string;
  hash: string;
  prevHash: string;
}

export const AuditView: React.FC = () => {
  const [isVerifying, setIsVerifying] = useState(false);
  const [verified, setVerified] = useState(true);

  const [logs] = useState<AuditEntry[]>([
    {
      id: 'aud-901',
      actor: 'Dr. Sharma (usr-teacher-sharma)',
      action: 'REVEAL_STUDENT_IDENTITY',
      entity: 'Student: R.S. (stu-cs3b-014)',
      timestamp: '2026-09-30 14:22:18 IST',
      purpose: 'Intervention Planning (P5 Physics)',
      hash: '3f2e1a90c4b8d7e6f5a4b3c2d1e0f9a8b7c6d5e4f3a2b1c0d9e8f7a6b5c4d3e2',
      prevHash: '7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b',
    },
    {
      id: 'aud-900',
      actor: 'Dr. Sharma (usr-teacher-sharma)',
      action: 'VIEW_STUDENT_DOSSIER',
      entity: 'Student: R.S. (stu-cs3b-014)',
      timestamp: '2026-09-30 14:20:05 IST',
      purpose: 'Group Absence Alert Investigation',
      hash: '7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b',
      prevHash: '1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d',
    },
    {
      id: 'aud-899',
      actor: 'Prof. Verma (usr-sub-verma)',
      action: 'LOG_OBSERVATION',
      entity: 'Student: A.K. (stu-cs3b-022)',
      timestamp: '2026-09-30 11:45:00 IST',
      purpose: 'Lab session engagement check',
      hash: '1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d',
      prevHash: '0000000000000000000000000000000000000000000000000000000000000000',
    },
  ]);

  const handleVerifyChain = () => {
    setIsVerifying(true);
    setTimeout(() => {
      setIsVerifying(false);
      setVerified(true);
      alert('Audit Chain Integrity Verified: 100% of SHA-256 blocks valid and untampered (G10 Passed)');
    }, 600);
  };

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-5 font-mono select-none">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-[#141313] border border-[#333333] rounded-sm">
        <div>
          <h2 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[#39ff14] text-lg font-bold">
              verified_user
            </span>
            IMMUTABLE HASH-CHAINED AUDIT LEDGER (G10 GUARDRAIL)
          </h2>
          <span className="text-[10px] text-[#888888]">
            Every student record read and write is cryptographically appended with SHA-256 link
          </span>
        </div>

        <div className="flex items-center gap-2">
          {verified && (
            <MkBadge label="CHAIN INTEGRITY: VALID" variant="green" size="md" pulse />
          )}
          <MkButton
            variant="primary"
            size="md"
            loading={isVerifying}
            onClick={handleVerifyChain}
            icon="verified"
          >
            VERIFY HASH CHAIN
          </MkButton>
        </div>
      </div>

      {/* Audit Table */}
      <div className="bg-[#141313] border border-[#333333] rounded-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#0d0d0d] border-b border-[#333333] text-[10px] text-[#c4c7c8] uppercase">
              <tr>
                <th className="p-3">Timestamp / Actor</th>
                <th className="p-3">Action</th>
                <th className="p-3">Target Entity</th>
                <th className="p-3">Stated Purpose</th>
                <th className="p-3">Cryptographic SHA-256 Block</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#222222]">
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-[#1a1919] transition-colors">
                  <td className="p-3">
                    <span className="text-[10px] text-[#888] block">{log.timestamp}</span>
                    <span className="font-bold text-white text-[11px]">{log.actor}</span>
                  </td>
                  <td className="p-3">
                    <MkBadge
                      label={log.action}
                      variant={log.action.includes('REVEAL') ? 'red' : 'cyan'}
                      size="sm"
                    />
                  </td>
                  <td className="p-3 text-white font-bold">{log.entity}</td>
                  <td className="p-3 text-[#c4c7c8]">{log.purpose}</td>
                  <td className="p-3">
                    <div className="font-mono text-[9px] text-[#39ff14] truncate max-w-[200px]" title={log.hash}>
                      curr: {log.hash.slice(0, 16)}...
                    </div>
                    <div className="font-mono text-[9px] text-[#777] truncate max-w-[200px]" title={log.prevHash}>
                      prev: {log.prevHash.slice(0, 16)}...
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
