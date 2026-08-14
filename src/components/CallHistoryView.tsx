import React, { useState } from 'react';
import { 
  PhoneIncoming, PhoneOutgoing, PhoneMissed, Video, Phone, ShieldCheck, 
  Sparkles, FileText, Download, Trash2, Clock, Calendar, CheckCircle2, ChevronRight, X 
} from 'lucide-react';
import { CallRecord, CallType, Contact } from '../types';

interface CallHistoryViewProps {
  callRecords: CallRecord[];
  onRedial: (contactId: string, type: CallType) => void;
  onClearHistory: () => void;
  contacts: Contact[];
}

export const CallHistoryView: React.FC<CallHistoryViewProps> = ({
  callRecords,
  onRedial,
  onClearHistory,
  contacts,
}) => {
  const [selectedRecord, setSelectedRecord] = useState<CallRecord | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [generatedSummary, setGeneratedSummary] = useState<any | null>(null);

  const formatDuration = (sec: number) => {
    if (sec < 60) return `${sec}s`;
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}m ${s}s`;
  };

  const handleGenerateSummary = async (record: CallRecord) => {
    setSelectedRecord(record);
    setSummaryLoading(true);
    setGeneratedSummary(null);

    try {
      const res = await fetch('/api/ai/meeting-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          callId: record.id,
          participants: [record.contactName, 'Self'],
          callType: record.type,
          duration: record.duration,
          transcripts: [
            { speaker: record.contactName, text: 'Discussing the end-to-end encryption key exchange and group mesh latency metrics.' },
            { speaker: 'Self', text: 'Confirmed 256-bit AES-GCM cipher suite and checked safety numbers.' },
            { speaker: record.contactName, text: 'Agreed on implementing post-quantum key encapsulation in the next milestone.' },
          ],
          userNotes: record.notes || 'Routine high-security operational sync.',
        }),
      });
      const data = await res.json();
      if (data.summary) {
        setGeneratedSummary(data.summary);
      }
    } catch (e) {
      console.error('Failed to generate summary', e);
    } finally {
      setSummaryLoading(false);
    }
  };

  const handleExportLogsJson = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(callRecords, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `ciphercall_history_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div id="call-history-view" className="w-full max-w-7xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100 tracking-tight">Call History & AI Minutes</h1>
          <p className="text-xs text-zinc-400">
            Encrypted call records, duration logs, and automated meeting debriefs.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportLogsJson}
            className="flex items-center gap-1.5 px-3 py-2 bg-[#18181d] hover:bg-[#222228] text-zinc-200 border border-zinc-800 rounded-xl text-xs font-medium transition-colors shadow-xs"
          >
            <Download className="w-4 h-4 text-emerald-400" />
            <span>Export Logs (JSON)</span>
          </button>
          {callRecords.length > 0 && (
            <button
              onClick={() => {
                if (confirm('Clear all call history records?')) {
                  onClearHistory();
                }
              }}
              className="flex items-center gap-1.5 px-3 py-2 bg-[#18181d] hover:bg-red-950/60 text-zinc-400 hover:text-red-300 border border-zinc-800 hover:border-red-500/30 rounded-xl text-xs font-medium transition-colors shadow-xs"
            >
              <Trash2 className="w-4 h-4" />
              <span>Clear History</span>
            </button>
          )}
        </div>
      </div>

      {/* Call Records List */}
      {callRecords.length > 0 ? (
        <div className="space-y-3">
          {callRecords.map((record) => (
            <div
              key={record.id}
              id={`call-record-${record.id}`}
              className="bg-[#121216] border border-zinc-800/80 hover:border-zinc-700/80 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition-colors shadow-md shadow-black/20"
            >
              {/* Left Info */}
              <div className="flex items-center gap-3.5">
                <div className="relative">
                  <img
                    src={record.contactAvatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'}
                    alt={record.contactName}
                    className="w-12 h-12 rounded-xl object-cover border border-zinc-750/80 shadow-md"
                  />
                  <div className="absolute -bottom-1 -right-1 p-1 bg-[#0c0c0e] rounded-full border border-zinc-800">
                    {record.direction === 'incoming' ? (
                      <PhoneIncoming className="w-3 h-3 text-emerald-400" />
                    ) : record.direction === 'outgoing' ? (
                      <PhoneOutgoing className="w-3 h-3 text-teal-400" />
                    ) : (
                      <PhoneMissed className="w-3 h-3 text-red-400" />
                    )}
                  </div>
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-zinc-100">{record.contactName}</h3>
                    {record.e2eeVerified && (
                      <span className="px-2 py-0.5 bg-emerald-950/80 border border-emerald-500/30 text-emerald-300 text-[10px] font-mono rounded-md flex items-center gap-1 shadow-xs">
                        <ShieldCheck className="w-3 h-3" /> E2EE Verified
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-zinc-400 font-mono mt-0.5">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-zinc-500" />
                      {record.timestamp}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3 text-zinc-500" />
                      {formatDuration(record.duration)}
                    </span>
                    <span className="capitalize">{record.type} Call</span>
                  </div>
                </div>
              </div>

              {/* Right Action Buttons */}
              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                {/* AI Meeting Debrief */}
                <button
                  onClick={() => handleGenerateSummary(record)}
                  className="flex items-center gap-1.5 px-3 py-2 bg-gradient-to-r from-emerald-950/80 to-[#18181d] hover:from-emerald-900/80 hover:to-[#222228] text-emerald-300 border border-emerald-500/30 rounded-xl text-xs font-medium transition-colors shadow-xs"
                >
                  <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                  <span>AI Minutes</span>
                </button>

                {/* Redial Audio */}
                <button
                  onClick={() => onRedial(record.contactId, 'audio')}
                  className="p-2 bg-[#18181d] hover:bg-[#222228] text-zinc-200 border border-zinc-800 rounded-xl transition-colors shadow-xs"
                  title="Redial 1:1 Audio"
                >
                  <Phone className="w-4 h-4 text-teal-400" />
                </button>

                {/* Redial Video */}
                <button
                  onClick={() => onRedial(record.contactId, 'video')}
                  className="p-2 bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white rounded-xl border border-emerald-500/40 transition-colors shadow-xs"
                  title="Redial HD Video"
                >
                  <Video className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-16 bg-[#121216] border border-zinc-800 rounded-2xl shadow-md">
          <Clock className="w-10 h-10 text-zinc-600 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-zinc-100">No call records yet</h3>
          <p className="text-xs text-zinc-400 max-w-sm mx-auto mt-1">
            Initiate 1:1 audio or group video calls from the Contacts or Rooms tab. Calls will be recorded here with security metadata.
          </p>
        </div>
      )}

      {/* AI Meeting Summary Modal */}
      {selectedRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-xl animate-fade-in">
          <div className="w-full max-w-2xl bg-[#121216] border border-emerald-500/30 rounded-3xl p-6 shadow-2xl text-zinc-100 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-zinc-800">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl border border-emerald-500/30">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">AI Meeting Minutes & Executive Debrief</h2>
                  <p className="text-xs text-zinc-400">
                    Call with {selectedRecord.contactName} ({formatDuration(selectedRecord.duration)})
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedRecord(null)}
                className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-[#18181d]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {summaryLoading ? (
              <div className="py-16 text-center">
                <div className="w-10 h-10 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin mx-auto mb-4" />
                <h3 className="text-sm font-semibold text-white">Gemini Pro Reasoning in progress...</h3>
                <p className="text-xs text-zinc-400 mt-1 font-mono">
                  Synthesizing encrypted audio transcript, extracting decisions & action items...
                </p>
              </div>
            ) : generatedSummary ? (
              <div className="my-4 space-y-4 text-xs">
                {/* Title & Executive Summary */}
                <div className="p-4 bg-[#0c0c0e] rounded-2xl border border-zinc-800/90 shadow-inner">
                  <h3 className="text-sm font-bold text-emerald-300 mb-1">
                    {generatedSummary.title || 'Encrypted Session Debrief'}
                  </h3>
                  <p className="text-zinc-300 leading-relaxed">
                    {generatedSummary.executiveSummary}
                  </p>
                </div>

                {/* Key Decisions */}
                {generatedSummary.decisionsMade && generatedSummary.decisionsMade.length > 0 && (
                  <div className="p-4 bg-[#0c0c0e] rounded-2xl border border-zinc-800/90 shadow-inner">
                    <h4 className="font-bold text-white mb-2 flex items-center gap-1.5 text-xs">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Key Decisions Agreed
                    </h4>
                    <ul className="space-y-1 text-zinc-300 list-disc list-inside">
                      {generatedSummary.decisionsMade.map((d: string, i: number) => (
                        <li key={i}>{d}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Action Items */}
                {generatedSummary.actionItems && generatedSummary.actionItems.length > 0 && (
                  <div className="p-4 bg-[#0c0c0e] rounded-2xl border border-zinc-800/90 shadow-inner">
                    <h4 className="font-bold text-white mb-2 text-xs">Assigned Action Items</h4>
                    <div className="space-y-2">
                      {generatedSummary.actionItems.map((item: any, i: number) => (
                        <div key={i} className="flex items-center justify-between p-2.5 bg-[#18181d] rounded-xl border border-zinc-800">
                          <span className="text-zinc-200">{typeof item === 'string' ? item : item.task}</span>
                          {item.owner && (
                            <span className="px-2 py-0.5 bg-[#222228] text-zinc-300 rounded-md font-mono text-[10px]">
                              {item.owner}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Security Note */}
                {generatedSummary.securityAndComplianceNote && (
                  <div className="p-3 bg-emerald-950/40 border border-emerald-500/20 rounded-xl text-emerald-300 text-[11px] font-mono">
                    Zero-Knowledge Audit: {generatedSummary.securityAndComplianceNote}
                  </div>
                )}
              </div>
            ) : null}

            <div className="flex justify-end pt-3 border-t border-zinc-800">
              <button
                onClick={() => setSelectedRecord(null)}
                className="px-4 py-2 bg-[#18181d] hover:bg-[#222228] border border-zinc-800 text-white rounded-xl text-xs font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
