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
  Radio,
  RotateCcw,
  Zap,
  PlayCircle
} from 'lucide-react';
import { sendVoiceTurn, sendVoiceText, simulatePaid } from '../api';
import { fmtMoney } from './Badges';
import { useLanguage } from '../context/LanguageContext';

const INITIAL_DEMO_CONVERSATION = [
  {
    id: 'demo-1',
    role: 'user',
    text: 'Sunil Cloth House ka aaj ka poora hisaab aur overdue kitna hai?',
  },
  {
    id: 'demo-2',
    role: 'assistant',
    text: 'Namaste Sunil ji! Aapke shop ka kul outstanding ₹37,500 hai, jisme se ₹23,000 overdue ho chuka hai. Ab tak kul ₹12,000 recover ho chuka hai.',
  },
  {
    id: 'demo-3',
    role: 'user',
    text: 'Kisko pehle call karna chahiye recovery ke liye?',
  },
  {
    id: 'demo-4',
    role: 'assistant',
    text: 'Aapko sabse pehle Farooq Traders ko call karna chahiye kyunki pichle hafte unhone ₹3,000 ka vaada toda tha. Uske baad Rahul Enterprises ko contact karein jo Quick Win hain (Score 78) aur jaldi payment clear kar denge.',
  },
  {
    id: 'demo-5',
    role: 'user',
    text: 'Theek hai, Rahul Enterprises se ₹2500 ka payment link bana do.',
  },
  {
    id: 'demo-6',
    role: 'assistant',
    text: 'Rahul Enterprises ke liye ₹2,500 ka Cashfree payment link banayein? Kripya confirm karein.',
    action: {
      type: 'pending',
      status: 'awaiting_confirmation',
      merchant: 'Rahul Enterprises',
      amount: 2500,
      direction: 'collect',
    },
  },
  {
    id: 'demo-7',
    role: 'user',
    text: 'Haan, bhej do.',
  },
  {
    id: 'demo-8',
    role: 'assistant',
    text: 'Badhai ho! Rahul Enterprises ke liye ₹2,500 ka Cashfree payment link ban gaya hai. Link customer ke saath share karne ke liye taiyaar hai.',
    action: {
      type: 'collect',
      status: 'link_created',
      merchant: 'Rahul Enterprises',
      amount: 2500,
      invoice_id: 1,
      link_url: 'https://sandbox.cashfree.com/pg/links/vda_rahul_demo_2500',
      reference: 'cf_link_rahul_2500',
    },
  },
];

export default function VoiceAgentWidget({ onRefreshAll, compact = false }) {
  const { lang, t } = useLanguage();
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [liveTranscript, setLiveTranscript] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [languageCode, setLanguageCode] = useState(() => {
    if (lang === 'HI') return 'hi-IN';
    if (lang === 'KN') return 'kn-IN';
    return 'en-IN';
  });
  const [textInput, setTextInput] = useState('');

  // Sync with global language toggle (EN / HI / KN)
  useEffect(() => {
    if (lang === 'HI') setLanguageCode('hi-IN');
    else if (lang === 'KN') setLanguageCode('kn-IN');
    else if (lang === 'EN') setLanguageCode('en-IN');
  }, [lang]);

  // Persist conversation across page refreshes and tab switches
  const [messages, setMessages] = useState(() => {
    try {
      const saved = localStorage.getItem('vaada_voice_agent_history');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) { }
    return INITIAL_DEMO_CONVERSATION;
  });

  const [sessionId] = useState(() => {
    try {
      const saved = localStorage.getItem('vaada_voice_agent_session');
      if (saved) return saved;
      const newId = 'sess_' + Math.random().toString(36).substring(2, 9);
      localStorage.setItem('vaada_voice_agent_session', newId);
      return newId;
    } catch (e) {
      return 'sess_default';
    }
  });

  const [linkCopied, setLinkCopied] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(true);

  // Sync messages to localStorage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem('vaada_voice_agent_history', JSON.stringify(messages));
    } catch (e) { }
  }, [messages]);

  const handleResetChat = () => {
    setMessages(INITIAL_DEMO_CONVERSATION);
    try {
      localStorage.setItem('vaada_voice_agent_history', JSON.stringify(INITIAL_DEMO_CONVERSATION));
    } catch (e) { }
  };

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recognitionRef = useRef(null);
  const timerRef = useRef(null);
  const audioPlayerRef = useRef(null);
  const chatScrollRef = useRef(null);
  const finalTranscriptRef = useRef('');

  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [messages, isProcessing, liveTranscript]);

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
      audio.play().catch((err) => console.log('Audio autoplay notice:', err));
    } catch (e) {
      console.warn('Audio playback error', e);
    }
  };

  // Start Mic Recording & Live Speech Recognition
  const startRecording = async () => {
    try {
      setLiveTranscript('');
      finalTranscriptRef.current = '';

      // 1. Browser Live Speech Recognition (stream words as spoken)
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognition) {
        try {
          const recognition = new SpeechRecognition();
          recognition.continuous = true;
          recognition.interimResults = true;
          recognition.lang = languageCode === 'hi-IN' ? 'hi-IN' : languageCode === 'en-IN' ? 'en-IN' : languageCode;

          recognition.onresult = (event) => {
            let interim = '';
            for (let i = event.resultIndex; i < event.results.length; i++) {
              const transcriptPiece = event.results[i][0].transcript;
              interim += transcriptPiece;
            }
            if (interim.trim()) {
              setLiveTranscript(interim);
              finalTranscriptRef.current = interim;
              setTextInput(interim);
            }
          };

          recognition.onerror = (e) => {
            console.warn('SpeechRecognition interim event:', e.error);
          };

          recognition.start();
          recognitionRef.current = recognition;
        } catch (e) {
          console.warn('Speech recognition init error:', e);
        }
      }

      // 2. MediaRecorder for high-fidelity audio bytes
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

        const capturedText = finalTranscriptRef.current.trim();
        if (capturedText) {
          await handleTextSubmit(capturedText);
        } else {
          await handleAudioUpload(audioBlob);
        }
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
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) { }
    }
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      clearInterval(timerRef.current);
    }
  };

  // Process Audio Upload
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
      setLiveTranscript('');
    }
  };

  // Process Text Command
  const handleTextSubmit = async (textToSend) => {
    const q = (textToSend || textInput).trim();
    if (!q || isProcessing) return;

    setTextInput('');
    setLiveTranscript('');
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

  const handleResetDemo = () => {
    setMessages(INITIAL_DEMO_CONVERSATION);
    try {
      localStorage.setItem('vaada_voice_agent_history', JSON.stringify(INITIAL_DEMO_CONVERSATION));
    } catch (e) { }
  };

  return (
    <div className="bg-white text-slate-800 rounded-3xl p-5 sm:p-6 border border-slate-200 shadow-md overflow-hidden relative">
      {/* Decorative Background Glows */}
      <div className="absolute -top-16 -right-16 w-48 h-48 bg-teal-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-16 -left-16 w-48 h-48 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3 mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-teal-50 border border-teal-200 text-teal-700 flex items-center justify-center shadow-xs">
            <Bot size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-black text-sm text-slate-900 tracking-tight">{t('agent.headerTitle')}</h3>
              <span className="text-[10px] bg-emerald-50 border border-emerald-200 text-emerald-800 font-bold px-2 py-0.5 rounded-full flex items-center gap-1 shadow-2xs">
                <Sparkles size={10} />
                {t('agent.liveBadge')}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {t('agent.headerSubtitle')}
            </p>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2">
          {/* Reset to Demo Story */}
          <button
            onClick={handleResetDemo}
            title="Reset to Demo Conversation"
            className="px-2.5 py-1.5 rounded-lg bg-slate-100 border border-slate-200 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors flex items-center gap-1 cursor-pointer"
          >
            <RotateCcw size={13} />
            {t('agent.resetDemo')}
          </button>

          {/* Language Selector */}
          <select
            value={languageCode}
            onChange={(e) => setLanguageCode(e.target.value)}
            className="bg-slate-50 border border-slate-200 text-xs text-slate-700 rounded-lg px-2.5 py-1.5 outline-none font-medium hover:border-slate-300 transition-colors cursor-pointer"
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
            className="p-1.5 rounded-lg bg-slate-100 border border-slate-200 hover:bg-slate-200 text-slate-600 transition-colors cursor-pointer"
          >
            {audioEnabled ? <Volume2 size={15} className="text-teal-700" /> : <VolumeX size={15} />}
          </button>
        </div>
      </div>

      {/* One-Click Demo Action Scenarios Strip */}
      <div className="mb-4 bg-slate-50/80 border border-slate-200 rounded-2xl p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-bold text-teal-800 uppercase tracking-wider flex items-center gap-1">
            <Zap size={13} className="text-teal-700" />
            Merchant Voice Action Scenarios (Click to test live):
          </span>
          <span className="text-[10px] text-slate-500 font-medium">Understands natural voice</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
          {[
            {
              title: '1. Create Payment Link',
              prompt: 'Rahul Enterprises se 2500 rupaye ka payment link bana do',
              subtitle: 'Executes Cashfree /pg/links',
              badge: 'Cashfree Action',
              color: 'border-teal-200 bg-white hover:bg-teal-50/50 text-slate-700 hover:border-teal-300',
              badgeColor: 'bg-teal-50 text-teal-700 border border-teal-200',
            },
            {
              title: '2. Recovery Advice',
              prompt: 'Kisko pehle call karna chahiye recovery ke liye?',
              subtitle: 'Analyzes broken promises & urgency',
              badge: 'Smart Strategy',
              color: 'border-amber-200 bg-white hover:bg-amber-50/50 text-slate-700 hover:border-amber-300',
              badgeColor: 'bg-amber-50 text-amber-700 border border-amber-200',
            },
            {
              title: '3. Shop Financial Summary',
              prompt: 'Sunil Cloth House ka aaj ka poora hisaab batao',
              subtitle: 'Reads live outstanding & overdue',
              badge: 'Live Numbers',
              color: 'border-blue-200 bg-white hover:bg-blue-50/50 text-slate-700 hover:border-blue-300',
              badgeColor: 'bg-blue-50 text-blue-700 border border-blue-200',
            },
            {
              title: '4. Draft Firm Reminder',
              prompt: 'Amit Stores ke liye firm reminder draft karo',
              subtitle: 'Generates tone-calibrated text',
              badge: 'Reminder Copy',
              color: 'border-rose-200 bg-white hover:bg-rose-50/50 text-slate-700 hover:border-rose-300',
              badgeColor: 'bg-rose-50 text-rose-700 border border-rose-200',
            },
          ].map((item, idx) => (
            <button
              key={idx}
              onClick={() => handleTextSubmit(item.prompt)}
              className={`text-left p-2.5 rounded-xl border ${item.color} shadow-2xs transition-all group flex flex-col justify-between cursor-pointer`}
            >
              <div>
                <div className="flex items-center justify-between text-[10px] font-bold mb-1">
                  <span className="text-slate-900 group-hover:text-teal-700 transition-colors">{item.title}</span>
                  <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider ${item.badgeColor}`}>{item.badge}</span>
                </div>
                <p className="text-[11px] font-medium text-slate-600 line-clamp-1 italic">
                  "{item.prompt}"
                </p>
              </div>
              <span className="text-[9px] text-slate-400 mt-1 block">
                {item.subtitle}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Live Speech Recognition Banner (Shows text as you speak) */}
      {isRecording && (
        <div className="bg-teal-50 border border-teal-200 rounded-2xl p-3.5 mb-3.5 shadow-sm flex items-start gap-3 animate-fadeIn">
          <div className="w-7 h-7 rounded-lg bg-rose-600 text-white flex items-center justify-center shrink-0 mt-0.5 animate-pulse">
            <Radio size={15} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-teal-800 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                Live Speech Detected ({recordingSeconds}s)
              </span>
              <span className="text-[10px] text-slate-500">Stop speaking to send</span>
            </div>
            <p className="text-sm font-semibold text-slate-900 tracking-wide leading-relaxed">
              {liveTranscript || 'Listening... speak whatever you want in your language...'}
            </p>
          </div>
        </div>
      )}

      {/* Chat Thread Container */}
      <div
        ref={chatScrollRef}
        className="space-y-3.5 max-h-[360px] overflow-y-auto p-3.5 bg-slate-50/70 border border-slate-200/80 rounded-2xl mb-4 scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-transparent"
      >
        {messages.map((m) => (
          <div key={m.id} className="space-y-2">
            <div className={`flex items-start gap-2.5 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {m.role === 'assistant' && (
                <div className="w-7 h-7 rounded-xl bg-teal-700 text-white flex items-center justify-center shrink-0 text-xs font-black shadow-xs mt-0.5">
                  V
                </div>
              )}
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-xs leading-relaxed shadow-xs ${m.role === 'user'
                    ? 'bg-teal-700 text-white font-medium rounded-br-2xs'
                    : 'bg-white border border-slate-200 text-slate-800 rounded-bl-2xs'
                  }`}
              >
                <div className="flex items-center justify-between gap-3 mb-1">
                  <span className={`text-[10px] font-bold uppercase tracking-wider ${m.role === 'user' ? 'text-teal-200' : 'text-slate-400'}`}>
                    {m.role === 'user' ? 'Sunil (Merchant)' : 'Vaada AI Agent'}
                  </span>
                  {m.audio && (
                    <button
                      onClick={() => playAudioBase64(m.audio)}
                      className={`${m.role === 'user' ? 'text-teal-100 hover:text-white' : 'text-teal-700 hover:text-teal-800'} flex items-center gap-1 text-[10px] font-bold cursor-pointer`}
                    >
                      <Volume2 size={12} />
                      Play Voice
                    </button>
                  )}
                </div>
                <p className="whitespace-pre-line">{m.text}</p>
              </div>
              {m.role === 'user' && (
                <div className="w-7 h-7 rounded-xl bg-slate-200 text-slate-700 flex items-center justify-center shrink-0 text-xs font-bold shadow-xs mt-0.5">
                  <User size={14} />
                </div>
              )}
            </div>

            {/* Action Cards (Confirmation or Result) */}
            {m.action && (
              <div className="ml-9 max-w-[85%]">
                {m.action.status === 'awaiting_confirmation' && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs space-y-2.5 shadow-xs text-slate-800">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-amber-900 flex items-center gap-1.5">
                        <Sparkles size={13} className="text-amber-600" />
                        Confirmation Gate (Human in the Loop)
                      </span>
                      <span className="font-mono text-amber-900 font-black">{fmtMoney(m.action.amount)}</span>
                    </div>
                    <p className="text-slate-700">
                      Action: Create Cashfree Payment Link for <strong className="text-slate-900">{m.action.merchant}</strong>
                    </p>
                    <div className="flex items-center gap-2 pt-1 border-t border-amber-200/80">
                      <button
                        onClick={() => handleTextSubmit('haan')}
                        className="flex-1 py-1.5 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-1 transition-colors shadow-xs cursor-pointer"
                      >
                        <CheckCircle2 size={13} />
                        Haan (Confirm & Create Link)
                      </button>
                      <button
                        onClick={() => handleTextSubmit('cancel')}
                        className="py-1.5 px-3 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 font-bold text-xs flex items-center justify-center gap-1 transition-colors cursor-pointer"
                      >
                        <XCircle size={13} />
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {m.action.status === 'link_created' && (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-xs space-y-2.5 shadow-xs text-slate-800">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-emerald-900 flex items-center gap-1.5">
                        <CheckCircle2 size={13} className="text-emerald-600" />
                        Cashfree Link Created Successfully!
                      </span>
                      <span className="font-mono text-emerald-900 font-black">{fmtMoney(m.action.amount)}</span>
                    </div>
                    <div className="flex items-center gap-2 bg-white p-2 rounded-lg border border-slate-200">
                      <input
                        type="text"
                        readOnly
                        value={m.action.link_url}
                        className="flex-1 bg-transparent text-[11px] font-mono text-slate-700 outline-none select-all truncate"
                      />
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(m.action.link_url);
                          setLinkCopied(true);
                          setTimeout(() => setLinkCopied(false), 2000);
                        }}
                        className="px-2 py-1 bg-slate-100 hover:bg-slate-200 rounded text-[10px] font-semibold text-slate-700 transition-colors shrink-0 cursor-pointer"
                      >
                        {linkCopied ? <Check size={11} className="text-emerald-600" /> : <Copy size={11} />}
                      </button>
                    </div>
                    <div className="flex items-center justify-between gap-2 pt-1">
                      <button
                        onClick={() => window.open(m.action.link_url, '_blank')}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-teal-700 hover:bg-teal-800 text-white font-bold text-xs transition-colors shadow-2xs cursor-pointer"
                      >
                        <ExternalLink size={12} />
                        Open Link
                      </button>
                      <button
                        onClick={() => handleSimulatePayment(m.action.invoice_id || 1, m.action.amount)}
                        disabled={simulating}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-colors shadow-2xs disabled:opacity-50 cursor-pointer"
                      >
                        <DollarSign size={12} />
                        {simulating ? 'Recording...' : 'Simulate Paid (Update KPIs)'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}

        {isProcessing && (
          <div className="flex items-center gap-2 text-xs text-teal-800 bg-teal-50 p-2.5 rounded-xl border border-teal-200 animate-pulse">
            <Loader2 size={14} className="animate-spin text-teal-700" />
            <span>Sarvam AI processing merchant command...</span>
          </div>
        )}
      </div>

      {/* Voice & Text Input Bar */}
      <div className="flex items-center gap-2 bg-slate-100 border border-slate-200 rounded-2xl p-1.5 shadow-inner">
        {/* Big Mic Button */}
        <button
          onClick={isRecording ? stopRecording : startRecording}
          disabled={isProcessing}
          className={`h-11 px-4 rounded-xl font-bold text-xs flex items-center gap-2 transition-all shrink-0 cursor-pointer ${isRecording
              ? 'bg-rose-600 hover:bg-rose-700 text-white animate-pulse shadow-md'
              : 'bg-teal-700 hover:bg-teal-800 text-white shadow-xs'
            }`}
        >
          {isRecording ? <MicOff size={16} /> : <Mic size={16} />}
          <span>{isRecording ? `Stop & Send (${recordingSeconds}s)` : t('agent.tapToSpeak')}</span>
        </button>

        {/* Text Input */}
        <input
          type="text"
          value={textInput}
          onChange={(e) => setTextInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleTextSubmit()}
          placeholder={t('agent.inputPlaceholder')}
          disabled={isRecording || isProcessing}
          className="flex-1 bg-transparent text-xs text-slate-800 placeholder-slate-400 px-2.5 outline-none font-medium"
        />

        {/* Send Button */}
        <button
          onClick={() => handleTextSubmit()}
          disabled={!textInput.trim() || isProcessing}
          className="w-9 h-9 rounded-xl bg-teal-700 hover:bg-teal-800 text-white flex items-center justify-center transition-colors shrink-0 disabled:opacity-40 cursor-pointer shadow-xs"
        >
          <Send size={15} />
        </button>
      </div>
    </div>
  );
}
