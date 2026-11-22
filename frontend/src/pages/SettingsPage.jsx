import React, { useState, useEffect } from 'react';
import { 
  Settings, 
  Sliders, 
  RotateCcw, 
  CheckCircle2, 
  AlertCircle, 
  Calendar, 
  Building2, 
  Activity,
  Save,
  ShieldCheck
} from 'lucide-react';
import { getSettings, updateSettings, resetDemo, advanceDemoDate, getHealth } from '../api';
import { fmtDate } from '../components/Badges';

export default function SettingsPage({ onRefreshAll }) {
  const [data, setData] = useState(null);
  const [health, setHealth] = useState(null);
  const [minUpfront, setMinUpfront] = useState(50);
  const [maxDays, setMaxDays] = useState(14);
  const [discount, setDiscount] = useState(0);
  const [lang, setLang] = useState('en');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const loadData = () => {
    setLoading(true);
    Promise.all([getSettings(), getHealth()])
      .then(([settingsRes, healthRes]) => {
        const s = settingsRes.data;
        setData(s);
        setHealth(healthRes.data);
        if (s.rules) {
          setMinUpfront(s.rules.min_upfront_percent);
          setMaxDays(s.rules.max_days_later);
          setDiscount(s.rules.discount_allowed_percent);
        }
        if (s.default_language) {
          setLang(s.default_language);
        }
      })
      .catch((err) => {
        console.error('Failed to load settings', err);
        setErrorMsg('Failed to load settings from backend.');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSaveRules = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSuccessMsg('');
    setErrorMsg('');

    // Client-side validations
    const upfrontNum = parseFloat(minUpfront);
    const daysNum = parseInt(maxDays, 10);
    const discNum = parseFloat(discount);

    if (isNaN(upfrontNum) || upfrontNum < 0 || upfrontNum > 100) {
      setErrorMsg('Min upfront percent must be between 0 and 100.');
      setSaving(false);
      return;
    }
    if (isNaN(daysNum) || daysNum < 0 || daysNum > 60) {
      setErrorMsg('Max days later must be between 0 and 60.');
      setSaving(false);
      return;
    }
    if (isNaN(discNum) || discNum < 0 || discNum > 100) {
      setErrorMsg('Discount percent must be between 0 and 100.');
      setSaving(false);
      return;
    }

    try {
      await updateSettings({
        min_upfront_percent: upfrontNum,
        max_days_later: daysNum,
        discount_allowed_percent: discNum,
        default_language: lang,
      });
      setSuccessMsg('Business rules updated and persisted to PostgreSQL!');
      if (onRefreshAll) onRefreshAll();
    } catch (err) {
      console.error('Save settings failed', err);
      setErrorMsg(err.response?.data?.detail || 'Failed to save rules to backend.');
    } finally {
      setSaving(false);
    }
  };

  const handleResetDemoData = async () => {
    if (!window.confirm('This deletes all changes. Continue?')) return;
    setResetting(true);
    setSuccessMsg('');
    setErrorMsg('');
    try {
      await resetDemo();
      setSuccessMsg('Demo data has been cleanly reseeded and demo date reset.');
      loadData();
      if (onRefreshAll) onRefreshAll();
    } catch (err) {
      console.error('Reset failed', err);
      setErrorMsg('Failed to reset demo data.');
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <h2 className="text-xl font-black text-slate-800 tracking-tight">System &amp; Business Settings</h2>
        <p className="text-xs text-slate-500 mt-1 font-medium">
          Configure collection rules, test clock controls, and verify backend connectivity.
        </p>
      </div>

      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
          {successMsg}
        </div>
      )}

      {errorMsg && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl text-xs font-semibold flex items-center gap-2">
          <AlertCircle size={16} className="text-rose-600 shrink-0" />
          {errorMsg}
        </div>
      )}

      {/* 1. General Profile */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
          <Building2 size={18} className="text-teal-700" />
          <h3 className="text-sm font-bold text-slate-800">Business Profile</h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div>
            <label className="text-slate-400 font-semibold">Business Name</label>
            <p className="font-bold text-slate-900 mt-1 text-sm">{data?.name || '—'}</p>
          </div>
          <div>
            <label className="text-slate-400 font-semibold">Owner Name</label>
            <p className="font-bold text-slate-900 mt-1 text-sm">{data?.owner_name || '—'}</p>
          </div>
          <div>
            <label className="text-slate-400 font-semibold">Phone</label>
            <p className="font-mono font-semibold text-slate-800 mt-1">{data?.phone || '—'}</p>
          </div>
          <div>
            <label className="text-slate-400 font-semibold">Default Language</label>
            <p className="font-bold uppercase text-slate-800 mt-1">{data?.default_language || 'EN'}</p>
          </div>
        </div>
      </div>

      {/* 2. Collection Rules (Editable and Persisted to DB) */}
      <form onSubmit={handleSaveRules} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-5">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Sliders size={18} className="text-teal-700" />
            <h3 className="text-sm font-bold text-slate-800">Collection &amp; Promise Rules</h3>
          </div>
          <span className="text-[10px] font-bold text-teal-800 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
            Saved in PostgreSQL
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div>
            <label className="block text-slate-700 font-bold mb-1">
              Minimum Upfront %
            </label>
            <div className="relative">
              <input
                type="number"
                min="0"
                max="100"
                step="1"
                value={minUpfront}
                onChange={(e) => setMinUpfront(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0f766e]"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 font-bold text-slate-400">%</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">Default: 50% upfront required</p>
          </div>

          <div>
            <label className="block text-slate-700 font-bold mb-1">
              Max Days for Balance
            </label>
            <div className="relative">
              <input
                type="number"
                min="0"
                max="60"
                value={maxDays}
                onChange={(e) => setMaxDays(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0f766e]"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 font-bold text-slate-400">days</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">Max credit window (0-60)</p>
          </div>

          <div>
            <label className="block text-slate-700 font-bold mb-1">
              Discount Allowed %
            </label>
            <div className="relative">
              <input
                type="number"
                min="0"
                max="100"
                step="0.5"
                value={discount}
                onChange={(e) => setDiscount(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0f766e]"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 font-bold text-slate-400">%</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">Early settlement discount</p>
          </div>
        </div>

        <div className="pt-2 flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#0f766e] hover:bg-[#115e59] text-white font-bold text-xs transition-colors shadow-xs disabled:opacity-50"
          >
            {saving ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Save size={15} />
            )}
            Save Business Rules
          </button>
        </div>
      </form>

      {/* 3. Demo Clock & Reseed Controls */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
          <Calendar size={18} className="text-teal-700" />
          <h3 className="text-sm font-bold text-slate-800">Demo Clock &amp; Data Control</h3>
        </div>

        <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs">
          <div>
            <span className="text-slate-400 font-medium">Active Virtual Demo Date</span>
            <p className="font-mono font-black text-slate-900 text-base mt-0.5">
              {fmtDate(data?.demo_date)} ({data?.demo_date})
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleResetDemoData}
              disabled={resetting}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 font-bold text-xs transition-colors disabled:opacity-50"
            >
              <RotateCcw size={14} className={resetting ? 'animate-spin' : ''} />
              Reset Demo Data
            </button>
          </div>
        </div>
      </div>

      {/* 4. Environment & Connectivity */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
          <Activity size={18} className="text-teal-700" />
          <h3 className="text-sm font-bold text-slate-800">Environment &amp; Security Health</h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
            <span className="text-slate-400">Mode</span>
            <p className="font-bold text-amber-700 mt-1 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              Demo Sandboxed
            </p>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
            <span className="text-slate-400">Backend API</span>
            <p className="font-bold text-emerald-700 mt-1 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              Online ({health?.status || 'ok'})
            </p>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
            <span className="text-slate-400">Database Engine</span>
            <p className="font-bold text-slate-800 mt-1 font-mono">
              PostgreSQL 16 (asyncpg)
            </p>
          </div>
        </div>

        <p className="text-[11px] text-slate-400 italic pt-1">
          🔒 Zero secrets or API keys are exposed to the browser client.
        </p>
      </div>
    </div>
  );
}
