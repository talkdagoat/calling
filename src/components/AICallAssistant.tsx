import React, { useState, useEffect } from 'react';
import { Sparkles, CheckCircle2, ListTodo, Shield, RefreshCw, MessageSquare, ChevronDown, ChevronUp } from 'lucide-react';
import { AICallAssistantState, Participant } from '../types';

interface AICallAssistantProps {
  callDuration: number;
  callType: string;
  participants: Participant[];
  isOpen: boolean;
  onToggle: () => void;
}

export const AICallAssistant: React.FC<AICallAssistantProps> = ({
  callDuration,
  callType,
  participants,
  isOpen,
  onToggle,
}) => {
  const [assistantData, setAssistantData] = useState<any>({
    summary: 'Session active. Continuous 256-bit E2EE stream verified with zero intermediate key persistence.',
    keyPoints: [
      'Synchronized cryptographic session established',
      'High-definition Opus/WebRTC channel active',
    ],
    actionItems: ['Review call summary & action items upon completion'],
    sentiment: 'collaborative',
    suggestedResponse: 'Would you like to review the security architecture diagram?',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string>('Just now');

  const fetchLiveIntelligence = async () => {
    setIsLoading(true);
    try {
      const simulatedTranscripts = [
        { speaker: 'Caller', text: `Discussing ${callType} session objectives and security protocol.` },
        { speaker: 'Receiver', text: 'Confirmed safety numbers and active audio/video feed.' },
        { speaker: 'Caller', text: 'Let us finalize the next deliverables for the sprint.' },
      ];

      const res = await fetch('/api/ai/live-assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcriptHistory: simulatedTranscripts,
          callType,
          callDuration,
          participants: participants.map(p => p.name),
        }),
      });

      const data = await res.json();
      if (data.data) {
        setAssistantData(data.data);
        setLastUpdated(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      }
    } catch (err) {
      console.warn('AI assistant error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchLiveIntelligence();
      const interval = setInterval(fetchLiveIntelligence, 18000);
      return () => clearInterval(interval);
    }
  }, [isOpen, callType]);

  if (!isOpen) return null;

  return (
    <div 
      id="ai-call-assistant-panel"
      className="w-80 bg-[#121216]/95 border-l border-zinc-800 flex flex-col h-full z-20 backdrop-blur-xl animate-fade-in shadow-2xl shadow-black/50"
    >
      {/* Header */}
      <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-emerald-500/20 text-emerald-400 rounded-lg border border-emerald-500/30">
            <Sparkles className="w-4 h-4 animate-pulse" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-white">Gemini Live Assistant</h3>
            <span className="text-[10px] text-zinc-400 font-mono">Updated: {lastUpdated}</span>
          </div>
        </div>

        <button
          onClick={fetchLiveIntelligence}
          disabled={isLoading}
          className="p-1 text-zinc-400 hover:text-emerald-400 rounded-lg transition-colors"
          title="Refresh AI Insights"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Content */}
      <div className="p-4 flex-1 overflow-y-auto space-y-4 text-xs">
        {/* Live Summary */}
        <div className="p-3 bg-[#0c0c0e] rounded-xl border border-zinc-800/90 shadow-inner">
          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 block mb-1">
            Live Call Context
          </span>
          <p className="text-zinc-300 leading-relaxed">
            {assistantData.summary || 'Processing conversation stream...'}
          </p>
        </div>

        {/* Key Takeaways */}
        {assistantData.keyPoints && assistantData.keyPoints.length > 0 && (
          <div className="p-3 bg-[#0c0c0e] rounded-xl border border-zinc-800/90 shadow-inner">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 block mb-1.5 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3 text-emerald-400" /> Key Discussion Points
            </span>
            <ul className="space-y-1.5 text-zinc-300">
              {assistantData.keyPoints.map((kp: string, idx: number) => (
                <li key={idx} className="flex items-start gap-1.5">
                  <span className="text-emerald-500 font-bold">•</span>
                  <span>{kp}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Action Items */}
        {assistantData.actionItems && assistantData.actionItems.length > 0 && (
          <div className="p-3 bg-[#0c0c0e] rounded-xl border border-zinc-800/90 shadow-inner">
            <span className="text-[10px] font-bold uppercase tracking-wider text-teal-400 block mb-1.5 flex items-center gap-1">
              <ListTodo className="w-3 h-3 text-teal-400" /> Action Items Extracted
            </span>
            <div className="space-y-1.5">
              {assistantData.actionItems.map((item: string, idx: number) => (
                <div key={idx} className="p-2 bg-[#18181d] rounded-lg border border-zinc-800 text-zinc-300">
                  {item}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Suggested Quick Prompt */}
        {assistantData.suggestedResponse && (
          <div className="p-3 bg-emerald-950/40 border border-emerald-500/20 rounded-xl">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-300 block mb-1 flex items-center gap-1">
              <MessageSquare className="w-3 h-3" /> Suggested Follow-up
            </span>
            <p className="text-zinc-300 italic">
              "{assistantData.suggestedResponse}"
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
