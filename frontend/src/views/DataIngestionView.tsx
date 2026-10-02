import React, { useState, useEffect, useRef } from 'react';
import { api, IngestionBatchItem } from '../api/client';

export interface DataIngestionViewProps {
  onNavigate: (viewId: string, params?: any) => void;
}

export const DataIngestionView: React.FC<DataIngestionViewProps> = ({ onNavigate }) => {
  const [ingestionType, setIngestionType] = useState<'attendance' | 'calendar' | 'students' | 'timetable'>('attendance');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [history, setHistory] = useState<IngestionBatchItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  // Dev sample loader state
  const [isDevLoading, setIsDevLoading] = useState(false);
  const [devResult, setDevResult] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchHistory = async () => {
    setLoadingHistory(true);
    try {
      const items = await api.getIngestionHistory();
      setHistory(items);
    } catch (err) {
      console.error('Failed to load ingestion history:', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadMessage(null);

    try {
      const res = await api.uploadCsv(ingestionType, file);
      setUploadMessage({
        type: 'success',
        text: `Successfully ingested ${file.name}: ${res.records_inserted ?? res.events_ingested ?? res.total_rows ?? 'All'} records processed.`,
      });
      await fetchHistory();
    } catch (err: any) {
      setUploadMessage({
        type: 'error',
        text: `Ingestion failed: ${err.message || 'Check CSV format and column headers.'}`,
      });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDevLoadSampleData = async () => {
    setIsDevLoading(true);
    setDevResult(null);
    setUploadMessage(null);
    try {
      await api.loadSampleData();
      setDevResult(
        `Sample data loaded: CS-3B Students, Academic Calendar 2026, Timetable Slots, and October Attendance records ingested into Makerove graph database.`
      );
      await fetchHistory();
    } catch (err: any) {
      setUploadMessage({
        type: 'error',
        text: `Failed to load dev sample data: ${err.message}`,
      });
    } finally {
      setIsDevLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-8">
      {/* Workspace Header */}
      <div>
        <h1 className="text-2xl font-bold text-primary tracking-tight">Data Ingestion</h1>
        <p className="text-sm text-on-surface-variant mt-0.5">
          Upload student rosters, attendance registers, timetables, and academic calendars to expand the classroom knowledge graph.
        </p>
      </div>

      {/* Dev-only Sample Data Loader Banner */}
      {import.meta.env.DEV && (
        <div className="p-4 bg-secondary-container/30 border border-secondary/40 rounded-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 shadow-xs">
          <div>
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-secondary text-[20px]">science</span>
              <h3 className="text-xs font-bold text-primary uppercase tracking-wider">
                Development Environment Active (Dev-Only Loader)
              </h3>
            </div>
            <p className="text-xs text-on-surface-variant mt-1">
              Load realistic benchmark datasets from <code className="bg-surface-container px-1 py-0.5 rounded text-[11px]">sample_data/</code> (CS-3B Roster, Attendance, Calendar, Timetable).
            </p>
          </div>
          <button
            onClick={handleDevLoadSampleData}
            disabled={isDevLoading}
            className="px-4 py-2 bg-secondary text-on-secondary rounded-lg text-xs font-semibold hover:opacity-90 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 whitespace-nowrap shadow-xs"
          >
            <span className="material-symbols-outlined text-[16px]">
              {isDevLoading ? 'sync' : 'database'}
            </span>
            {isDevLoading ? 'Loading Sample CSVs...' : 'Load Sample Data (Dev Only)'}
          </button>
        </div>
      )}

      {devResult && (
        <div className="p-3 bg-tertiary-container/30 border border-tertiary/40 rounded-lg text-xs text-on-tertiary-container font-medium flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px]">verified</span>
            <span>{devResult}</span>
          </div>
          <button
            onClick={() => onNavigate('dashboard')}
            className="text-primary font-bold underline hover:opacity-80 cursor-pointer ml-3 whitespace-nowrap"
          >
            View Dashboard &rarr;
          </button>
        </div>
      )}

      {uploadMessage && (
        <div
          className={`p-3.5 rounded-lg text-xs font-medium flex items-center gap-2 ${
            uploadMessage.type === 'success'
              ? 'bg-tertiary-container/30 border border-tertiary/40 text-on-tertiary-container'
              : 'bg-error-container/30 border border-error/40 text-on-error-container'
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">
            {uploadMessage.type === 'success' ? 'check_circle' : 'error'}
          </span>
          <span>{uploadMessage.text}</span>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* Upload Area (Left / Main Col 8) */}
        <div className="xl:col-span-8 flex flex-col gap-6">
          {/* Target Data Type Selector */}
          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-4 shadow-xs flex flex-wrap items-center justify-between gap-3">
            <div>
              <label className="text-xs font-bold text-on-surface uppercase tracking-wider block">
                Select CSV Dataset Type
              </label>
              <p className="text-[11px] text-on-surface-variant">Choose the schema for the file being ingested</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  { id: 'attendance', label: 'Attendance Register', icon: 'rule' },
                  { id: 'students', label: 'Student Roster', icon: 'groups' },
                  { id: 'calendar', label: 'Academic Calendar', icon: 'calendar_today' },
                  { id: 'timetable', label: 'Weekly Timetable', icon: 'schedule' },
                ] as const
              ).map((t) => (
                <button
                  key={t.id}
                  onClick={() => setIngestionType(t.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                    ingestionType === t.id
                      ? 'bg-primary text-on-primary shadow-xs'
                      : 'bg-surface-container hover:bg-surface-container-high text-on-surface'
                  }`}
                >
                  <span className="material-symbols-outlined text-[15px]">{t.icon}</span>
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Real Upload Area */}
          <input
            type="file"
            ref={fileInputRef}
            accept=".csv,.txt"
            onChange={handleFileChange}
            className="hidden"
          />

          <div
            onClick={() => fileInputRef.current?.click()}
            className="bg-surface-container-lowest rounded-xl border-2 border-dashed border-outline-variant p-8 relative group cursor-pointer hover:border-primary hover:bg-surface-container-low transition-all text-center shadow-xs"
          >
            <div className="flex flex-col items-center justify-center py-6">
              <div className="w-16 h-16 rounded-full bg-surface-container-high flex items-center justify-center mb-4 group-hover:bg-primary-container group-hover:text-on-primary-container transition-colors">
                <span className="material-symbols-outlined text-[32px] text-primary">
                  {isUploading ? 'sync' : 'cloud_upload'}
                </span>
              </div>
              <h3 className="text-base font-bold text-primary mb-1">
                {isUploading ? 'Ingesting and Parsing CSV...' : `Upload ${ingestionType.toUpperCase()} CSV`}
              </h3>
              <p className="text-xs text-on-surface-variant max-w-md mx-auto mb-4">
                Click to browse or drop an authentic <strong>.csv</strong> file formatted according to the schema.
              </p>
              <button
                type="button"
                className="bg-primary-container text-on-primary-container rounded-lg px-4 py-2 text-xs font-semibold hover:bg-primary hover:text-on-primary transition-colors shadow-xs pointer-events-none"
              >
                Select File
              </button>
            </div>
          </div>

          {/* Ingestion History Table */}
          <div className="bg-surface-container-lowest rounded-xl border border-outline-variant overflow-hidden flex flex-col shadow-xs">
            <div className="bg-surface-container-low px-4 py-3 border-b border-outline-variant flex justify-between items-center">
              <h4 className="text-xs font-bold text-on-surface uppercase tracking-wider">
                Ingestion Audit History
              </h4>
              <button
                onClick={fetchHistory}
                className="text-xs text-primary font-semibold hover:underline flex items-center gap-1 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[14px]">refresh</span> Refresh
              </button>
            </div>

            {loadingHistory ? (
              <div className="p-8 text-center text-xs text-on-surface-variant">Loading history...</div>
            ) : history.length === 0 ? (
              <div className="p-8 text-center text-xs text-on-surface-variant space-y-2">
                <p>No files ingested yet.</p>
                <p className="text-[11px]">Upload a CSV above or click "Load Sample Data (Dev Only)" to populate.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-surface-container border-b border-outline-variant text-[11px] font-semibold text-on-surface-variant uppercase">
                      <th className="p-3">File Name</th>
                      <th className="p-3">Type</th>
                      <th className="p-3">Rows</th>
                      <th className="p-3">Status</th>
                      <th className="p-3">Timestamp</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant">
                    {history.map((item) => (
                      <tr key={item.id} className="hover:bg-surface-container-low transition-colors">
                        <td className="p-3 font-semibold text-on-surface">{item.filename}</td>
                        <td className="p-3 uppercase font-mono text-[10px] text-primary">{item.data_type}</td>
                        <td className="p-3 text-on-surface-variant">
                          {item.success_count} ok {item.error_count > 0 ? `(${item.error_count} err)` : ''}
                        </td>
                        <td className="p-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                              item.status === 'SUCCESS'
                                ? 'bg-tertiary-container text-on-tertiary-container'
                                : 'bg-error-container text-on-error-container'
                            }`}
                          >
                            {item.status}
                          </span>
                        </td>
                        <td className="p-3 text-on-surface-variant font-mono text-[11px]">
                          {item.created_at || 'Just now'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Right Reference Column (Col 4) */}
        <div className="xl:col-span-4 flex flex-col gap-4">
          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-5 shadow-xs">
            <h4 className="text-xs font-bold text-primary uppercase tracking-wider mb-2">
              Expected CSV Schemas
            </h4>
            <div className="space-y-3 text-xs text-on-surface-variant">
              <div>
                <span className="font-semibold text-on-surface block">1. Attendance CSV:</span>
                <code className="text-[10px] bg-surface-container p-1 rounded block mt-0.5 text-primary">
                  date, roll_no, period, subject_code, status
                </code>
              </div>
              <div>
                <span className="font-semibold text-on-surface block">2. Student Roster CSV:</span>
                <code className="text-[10px] bg-surface-container p-1 rounded block mt-0.5 text-primary">
                  roll_no, name, section_code, branch, year, dob, gender
                </code>
              </div>
              <div>
                <span className="font-semibold text-on-surface block">3. Academic Calendar CSV:</span>
                <code className="text-[10px] bg-surface-container p-1 rounded block mt-0.5 text-primary">
                  date, name, type, is_holiday
                </code>
              </div>
              <div>
                <span className="font-semibold text-on-surface block">4. Weekly Timetable CSV:</span>
                <code className="text-[10px] bg-surface-container p-1 rounded block mt-0.5 text-primary">
                  section_code, day, period, subject_code, teacher_id
                </code>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
