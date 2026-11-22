import React from 'react';
import { Bot } from 'lucide-react';
import VoiceAgentWidget from '../components/VoiceAgentWidget';

export default function VoiceAgentPage({ onRefreshAll, onNavigate }) {
  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Page Header */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center border border-teal-200 font-bold">
              <Bot size={22} />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                Merchant AI Voice Agent
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-teal-100 text-teal-800 border border-teal-200">
                  Sarvam AI + Cashfree
                </span>
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                Speak or type naturally in Hindi, Hinglish, or English. The assistant understands your shop finances and creates live payment links.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Interactive Voice Agent Component */}
      <VoiceAgentWidget onRefreshAll={onRefreshAll} />
    </div>
  );
}
