import React from 'react';
import { 
  PhoneIncoming, PhoneOutgoing, PhoneMissed, Video, Phone, ShieldCheck, 
  Trash2, Clock, Calendar
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
}) => {
  const formatDuration = (sec: number) => {
    if (sec < 60) return `${sec}s`;
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}m ${s}s`;
  };

  return (
    <div id="call-history-view" className="w-full max-w-4xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight">Call History</h1>
          <p className="text-xs text-zinc-400">
            Encrypted call records and duration logs
          </p>
        </div>

        <div className="flex items-center gap-2">
          {callRecords.length > 0 && (
            <button
              id="clear-all-call-history-btn"
              onClick={onClearHistory}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-[#18181d] hover:bg-red-950/60 text-zinc-300 hover:text-red-300 border border-zinc-800 hover:border-red-500/30 rounded-xl text-xs font-semibold transition-all shadow-xs cursor-pointer active:scale-98"
            >
              <Trash2 className="w-4 h-4 text-red-400" />
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
                <div className="relative shrink-0">
                  <img
                    src={record.contactAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(record.contactName)}&background=059669&color=ffffff&bold=true`}
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
                        <ShieldCheck className="w-3 h-3" /> Encrypted
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
                {/* Redial Audio */}
                <button
                  onClick={() => onRedial(record.contactId, 'audio')}
                  className="p-2.5 bg-[#18181d] hover:bg-[#222228] text-zinc-200 border border-zinc-800 rounded-xl transition-colors shadow-xs flex items-center gap-1.5 text-xs font-semibold cursor-pointer"
                  title="Redial Audio"
                >
                  <Phone className="w-4 h-4 text-emerald-400" />
                  <span>Call Audio</span>
                </button>

                {/* Redial Video */}
                <button
                  onClick={() => onRedial(record.contactId, 'video')}
                  className="p-2.5 bg-teal-950/60 hover:bg-teal-600 text-teal-300 hover:text-white rounded-xl border border-teal-500/30 transition-colors shadow-xs flex items-center gap-1.5 text-xs font-semibold cursor-pointer"
                  title="Redial HD Video"
                >
                  <Video className="w-4 h-4" />
                  <span>Video</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-16 bg-[#121216] border border-zinc-800 rounded-2xl shadow-md">
          <Clock className="w-10 h-10 text-zinc-600 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-zinc-100">No call history</h3>
          <p className="text-xs text-zinc-400 max-w-sm mx-auto mt-1">
            Calls with your contacts will appear here.
          </p>
        </div>
      )}
    </div>
  );
};
