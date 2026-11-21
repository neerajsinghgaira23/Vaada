import React, { useState, useRef, useEffect } from 'react';
import { 
  Mic, 
  MicOff, 
  Send, 
  Volume2, 
  VolumeX, 
  CheckCircle2, 
  XCircle, 
  ExternalLink, 
  DollarSign, 
  Copy, 
  Check, 
  Sparkles, 
  Bot, 
  User, 
  Loader2,
  RefreshCw
} from 'lucide-react';
import { sendVoiceTurn, sendVoiceText, simulatePaid } from '../api';
import { fmtMoney } from './Badges';

export default function VoiceAgentWidget({ onRefreshAll, compact = false }) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [languageCode, setLanguageCode] = useState('hi-IN');
  const [textInput, setTextInput] = useState('');
  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      role: 'assistant',
      text: 'Namaste! Main Vaada ka Sarvam Voice Agent hoon. Aap bol sakte hain: "Rahul Enterprises se 2500 ka payment link banao" ya "Kaun se customers pending hain?"',
      audio: '',
      action: null,
    }
  ]);
  const [sessionId] = useState(() => 'sess_' + Math.random().toString(36).substring(2, 9));
  const [linkCopied, setLinkCopied] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(true);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerRef = useRef(null);
  const audioPlayerRef = useRef(null);
  const chatScrollRef = useRef(null);

  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [messages, isProcessing]);

  // Audio Playback
  const playAudioBase64 = (b64) => {
    if (!b64 || !audioEnabled) return;
    try {
      if (audioPlayerRef.current) {
        audioPlayerRef.current.pause();
      }
      const audioUrl = `data:audio/wav;base64,${b64}`;
      const audio = new Audio(audioUrl);
      audioPlayerRef.current = audio;
      audio.play().catch((err) => console.log('Audio autoplay prevented:', err));
    } catch (e) {
      console.warn('Audio playback error', e);
    }
  };

  // Start Mic Recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      recorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        stream.getTracks().forEach((track) => track.stop());
        await handleAudioUpload(audioBlob);
      };

      recorder.start();
      setIsRecording(true);
      setRecordingSeconds(0);
      timerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.error('Microphone error:', err);
      alert('Microphone access denied or not available. You can use the text box below to interact!');
    }
  };

  // Stop Mic Recording
  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      clearInterval(timerRef.current);
    }
  };

  // Process Audio
  const handleAudioUpload = async (blob) => {
    setIsProcessing(true);
    const formData = new FormData();
    formData.append('audio', blob, 'user_speech.webm');
    formData.append('session_id', sessionId);
    formData.append('language_code', languageCode);

    try {
      const res = await sendVoiceTurn(formData);
      const data = res.data;
      appendTurn(data);
      if (data.audio) {
        playAudioBase64(data.audio);
      }
    } catch (err) {
      console.error('Voice turn failed', err);
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          role: 'assistant',
          text: 'Awaz sunne mein samasya aayi. Kripya dobara bolein ya text likhein.',
        },
      ]);
    } finally {
      setIsProcessing(false);
    }
  };

  // Process Text Command
  const handleTextSubmit = async (textToSend) => {
    const q = (textToSend || textInput).trim();
    if (!q || isProcessing) return;

    setTextInput('');
    setIsProcessing(true);

    // Optimistic user message
    setMessages((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        role: 'user',
        text: q,
      },
    ]);

    try {
      const res = await sendVoiceText(q, sessionId, languageCode);
      const data = res.data;
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          text: data.reply,
          audio: data.audio,
          action: data.action,
          planner: data.planner,
        },
      ]);
      if (data.audio) {
        playAudioBase64(data.audio);
      }
      if (data.action?.status === 'link_created' && onRefreshAll) {
        onRefreshAll();
      }
    } catch (err) {
      console.error('Voice text turn failed', err);
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          role: 'assistant',
          text: 'Request process karne mein samasya aayi.',
        },
      ]);
    } finally {
      setIsProcessing(false);
    }
  };

  const appendTurn = (data) => {
    if (data.transcript) {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          role: 'user',
          text: data.transcript,
        },
        {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          text: data.reply,
          audio: data.audio,
          action: data.action,
          planner: data.planner,
        },
      ]);
    } else {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          role: 'assistant',
          text: data.reply,
          audio: data.audio,
          action: data.action,
        },
      ]);
    }
    if (data.action?.status === 'link_created' && onRefreshAll) {
      onRefreshAll();
    }
  };

  const handleSimulatePayment = async (invoiceId, amount) => {
    setSimulating(true);
    try {
      await simulatePaid(invoiceId, amount);
      if (onRefreshAll) {
        await onRefreshAll();
      }
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          role: 'assistant',
          text: `Payment of ${fmtMoney(amount)} successfully confirmed and recorded!`,
        },
      ]);
    } catch (e) {
      console.error('Simulate payment failed', e);
    } finally {
      setSimulating(false);
    }
  };

  return (
    <div className="bg-gradient-to-br from-slate-900 via-slate-850 to-[#0e1f2f] text-white rounded-3xl p-5 border border-slate-700/60 shadow-xl overflow-hidden relative">
      {/* Decorative Glow */}
      <div className="absolute -top-16 -right-16 w-48 h-48 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-16 -left-16 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3 mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-teal-500/20 border border-teal-500/40 text-teal-400 flex items-center justify-center shadow-inner">
            <Bot size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-black text-sm text-white tracking-tight">Sarvam Voice Agent</h3>
              <span className="text-[10px] bg-teal-500/20 border border-teal-500/30 text-teal-300 font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                <Sparkles size={10} />
                Live AI
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Speak or type to create Cashfree payment links in Indian languages
            </p>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2">
          {/* Language Selector */}
          <select
            value={languageCode}
            onChange={(e) => setLanguageCode(e.target.value)}
            className="bg-slate-800 border border-slate-700 text-xs text-slate-200 rounded-lg px-2.5 py-1.5 outline-none font-medium hover:border-slate-600 transition-colors"
          >
            <option value="hi-IN">हिन्दी (Hindi)</option>
            <option value="en-IN">English</option>
            <option value="kn-IN">ಕನ್ನಡ (Kannada)</option>
            <option value="ta-IN">தமிழ் (Tamil)</option>
            <option value="te-IN">తెలుగు (Telugu)</option>
            <option value="mr-IN">मराठी (Marathi)</option>
            <option value="bn-IN">বাংলা (Bengali)</option>
            <option value="gu-IN">ગુજરાતી (Gujarati)</option>
          </select>

          {/* Sound Toggle */}
          <button
            onClick={() => setAudioEnabled(!audioEnabled)}
            title={audioEnabled ? 'Voice output on' : 'Voice output muted'}
            className="p-1.5 rounded-lg bg-slate-800 border border-slate-700 hover:bg-slate-700 text-slate-300 transition-colors"
          >
            {audioEnabled ? <Volume2 size={15} className="text-teal-400" /> : <VolumeX size={15} />}
          </button>
        </div>
      </div>

      {/* Chat Thread Container */}
      <div 
        ref={chatScrollRef}
        className="space-y-3.5 max-h-[320px] overflow-y-auto pr-2 mb-4 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent"
      >
        {messages.map((m) => (
          <div key={m.id} className="space-y-2">
            <div className={`flex items-start gap-2.5 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {m.role === 'assistant' && (
                <div className="w-6 h-6 rounded-lg bg-teal-600 text-white flex items-center justify-center shrink-0 text-xs font-bold mt-0.5">
                  V
                </div>
              )}
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-xs leading-relaxed ${
                  m.role === 'user'
                    ? 'bg-teal-600 text-white font-medium rounded-br-2xs'
                    : 'bg-slate-800/90 border border-slate-700/80 text-slate-200 rounded-bl-2xs'
                }`}
              >
                <div className="flex items-center justify-between gap-3 mb-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    {m.role === 'user' ? 'You' : 'Voice Agent'}
                  </span>
                  {m.audio && (
                    <button
                      onClick={() => playAudioBase64(m.audio)}
                      className="text-teal-400 hover:text-teal-300 flex items-center gap-1 text-[10px] font-bold"
                    >
                      <Volume2 size={12} />
                      Play Voice
                    </button>
                  )}
                </div>
                <p className="whitespace-pre-line">{m.text}</p>
              </div>
              {m.role === 'user' && (
                <div className="w-6 h-6 rounded-lg bg-slate-700 text-slate-300 flex items-center justify-center shrink-0 text-xs font-bold mt-0.5">
                  <User size={13} />
                </div>
              )}
            </div>

            {/* Action Cards (Confirmation or Result) */}
            {m.action && (
              <div className="ml-8 max-w-[85%]">
                {m.action.status === 'awaiting_confirmation' && (
                  <div className="bg-amber-950/40 border border-amber-500/40 rounded-xl p-3 text-xs space-y-2.5 backdrop-blur-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-amber-300 flex items-center gap-1.5">
                        <Sparkles size={13} className="text-amber-400" />
                        Confirmation Required
                      </span>
                      <span className="font-mono text-amber-400 font-black">{fmtMoney(m.action.amount)}</span>
                    </div>
                    <p className="text-slate-300">
                      Target: <strong>{m.action.merchant}</strong> (Cashfree Payment Link)
                    </p>
                    <div className="flex items-center gap-2 pt-1 border-t border-amber-500/20">
                      <button
                        onClick={() => handleTextSubmit('haan')}
                        className="flex-1 py-1.5 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-1 transition-colors"
                      >
                        <CheckCircle2 size={13} />
                        Haan (Confirm & Create)
                      </button>
                      <button
                        onClick={() => handleTextSubmit('cancel')}
                        className="py-1.5 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs flex items-center justify-center gap-1 transition-colors"
                      >
                        <XCircle size={13} />
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {m.action.status === 'link_created' && (
                  <div className="bg-emerald-950/40 border border-emerald-500/40 rounded-xl p-3 text-xs space-y-2.5 backdrop-blur-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-emerald-300 flex items-center gap-1.5">
                        <CheckCircle2 size={13} className="text-emerald-400" />
                        Cashfree Link Created!
                      </span>
                      <span className="font-mono text-emerald-400 font-black">{fmtMoney(m.action.amount)}</span>
                    </div>
                    <div className="flex items-center gap-2 bg-slate-900/80 p-2 rounded-lg border border-slate-700">
                      <input
                        type="text"
                        readOnly
                        value={m.action.link_url}
                        className="flex-1 bg-transparent text-[11px] font-mono text-slate-300 outline-none select-all truncate"
                      />
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(m.action.link_url);
                          setLinkCopied(true);
                          setTimeout(() => setLinkCopied(false), 2000);
                        }}
                        className="px-2 py-1 bg-slate-800 hover:bg-slate-700 rounded text-[10px] font-semibold text-slate-200 transition-colors shrink-0"
                      >
                        {linkCopied ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
                      </button>
                    </div>
                    <div className="flex items-center justify-between gap-2 pt-1">
                      <button
                        onClick={() => window.open(m.action.link_url, '_blank')}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs transition-colors"
                      >
                        <ExternalLink size={12} />
                        Open Link
                      </button>
                      {m.action.invoice_id && (
                        <button
                          onClick={() => handleSimulatePayment(m.action.invoice_id, m.action.amount)}
                          disabled={simulating}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-colors disabled:opacity-50"
                        >
                          <DollarSign size={12} />
                          {simulating ? 'Recording...' : 'Simulate Paid'}
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}

        {isProcessing && (
          <div className="flex items-center gap-2 text-xs text-teal-400 bg-slate-800/60 p-2.5 rounded-xl border border-slate-700/60 animate-pulse">
            <Loader2 size={14} className="animate-spin" />
            <span>Sarvam AI processing voice command...</span>
          </div>
        )}
      </div>

      {/* Suggested Quick Commands */}
      <div className="flex flex-wrap items-center gap-1.5 mb-3.5">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Try saying:</span>
        {[
          'Rahul Enterprises se 2500 ka payment link banao',
          'Kaun kaun se customers pending hain?',
          'Amit Stores ka kitna baaki hai?',
          'Haan',
        ].map((promptText) => (
          <button
            key={promptText}
            onClick={() => handleTextSubmit(promptText)}
            className="text-[10px] bg-slate-800/80 hover:bg-slate-700 border border-slate-700/60 text-slate-300 px-2 py-1 rounded-md transition-colors truncate max-w-[220px]"
          >
            {promptText}
          </button>
        ))}
      </div>

      {/* Voice & Text Input Bar */}
      <div className="flex items-center gap-2 bg-slate-800/90 border border-slate-700/80 rounded-2xl p-1.5 shadow-inner">
        {/* Big Mic Button */}
        <button
          onClick={isRecording ? stopRecording : startRecording}
          disabled={isProcessing}
          className={`h-11 px-4 rounded-xl font-bold text-xs flex items-center gap-2 transition-all shrink-0 ${
            isRecording
              ? 'bg-rose-600 hover:bg-rose-700 text-white animate-pulse shadow-lg shadow-rose-900/50'
              : 'bg-teal-600 hover:bg-teal-500 text-white shadow-md shadow-teal-900/40'
          }`}
        >
          {isRecording ? <MicOff size={16} /> : <Mic size={16} />}
          <span>{isRecording ? `Listening (${recordingSeconds}s)...` : 'Tap to Speak'}</span>
        </button>

        {/* Text Input */}
        <input
          type="text"
          value={textInput}
          onChange={(e) => setTextInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleTextSubmit()}
          placeholder="Or type a voice command in Hindi / English..."
          disabled={isRecording || isProcessing}
          className="flex-1 bg-transparent text-xs text-white placeholder-slate-400 px-2.5 outline-none font-medium"
        />

        {/* Send Button */}
        <button
          onClick={() => handleTextSubmit()}
          disabled={!textInput.trim() || isProcessing}
          className="w-9 h-9 rounded-xl bg-slate-700 hover:bg-teal-600 text-slate-300 hover:text-white flex items-center justify-center transition-colors shrink-0 disabled:opacity-40"
        >
          <Send size={15} />
        </button>
      </div>
    </div>
  );
}
