import { useState, useEffect, useCallback } from 'react';
import {
  getBusinesses, getDashboard, getQueue, getDemoDate,
  advanceDemoDate, getEvents, simulatePaid, setBusinessId
} from './api';

// ─── helpers ──────────────────────────────────────────────────────────────────
function fmtMoney(val) {
  const n = Number(val) || 0;
  return '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtTime(d) {
  if (!d) return '';
  return new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

function Spinner() {
  return (
    <div className="flex items-center justify-center py-8">
      <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
    </div>
  );
}

// ─── KPI card ─────────────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, color, icon }) {
  const colors = {
    blue: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', icon: 'text-blue-400' },
    red: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', icon: 'text-red-400' },
    green: { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-700', icon: 'text-green-400' },
    amber: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', icon: 'text-amber-400' },
  };
  const c = colors[color] || colors.blue;
  return (
    <div className={`flex-1 min-w-0 rounded-xl border ${c.bg} ${c.border} px-4 py-3 shadow-sm flex items-start gap-3`}>
      <span className={`text-2xl mt-0.5 ${c.icon}`}>{icon}</span>
      <div className="min-w-0">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide truncate">{label}</p>
        <p className={`text-xl font-bold ${c.text} leading-tight`}>{value}</p>
        {sub && <p className="text-xs text-amber-600 mt-0.5 truncate">{sub}</p>}
      </div>
    </div>
  );
}

// ─── Promise icons ─────────────────────────────────────────────────────────────
function PromiseIcons({ promises }) {
  if (!promises || promises.length === 0) return null;
  return (
    <div className="flex gap-1 mt-1">
      {promises.map((p, i) => {
        if (p.status === 'kept') return <span key={i} className="text-green-600 font-bold text-sm" title={`Kept ₹${p.promised_amount}`}>✓</span>;
        if (p.status === 'broken') return <span key={i} className="text-red-600 font-bold text-sm" title={`Broken ₹${p.promised_amount}`}>✗</span>;
        return <span key={i} className="text-gray-400 text-sm" title={`Open ₹${p.promised_amount}`}>○</span>;
      })}
    </div>
  );
}

// ─── Tone dot ─────────────────────────────────────────────────────────────────
function ToneDot({ tone }) {
  const map = {
    Friendly: 'bg-green-400',
    Firm: 'bg-amber-400',
    Final: 'bg-red-500',
  };
  return (
    <span className="flex items-center gap-1 text-xs text-gray-500">
      <span className={`w-2 h-2 rounded-full inline-block ${map[tone] || 'bg-gray-400'}`} />
      Tone: {tone}
    </span>
  );
}

// ─── Queue card badge ──────────────────────────────────────────────────────────
function PriorityBadge({ priority }) {
  const map = {
    'Quick Win': 'bg-green-100 text-green-700 border-green-300',
    'Follow Up': 'bg-amber-100 text-amber-700 border-amber-300',
    'Escalate': 'bg-red-100  text-red-700  border-red-300',
  };
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${map[priority] || 'bg-gray-100 text-gray-600 border-gray-300'}`}>
      {priority}
    </span>
  );
}

// ─── Status badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const map = {
    paid: 'bg-green-100 text-green-700',
    partial: 'bg-amber-100 text-amber-700',
    unpaid: 'bg-red-100   text-red-700',
  };
  return <span className={`px-2 py-0.5 rounded text-xs font-medium ${map[status] || 'bg-gray-100 text-gray-600'}`}>{status}</span>;
}

// ─── Actor badge ──────────────────────────────────────────────────────────────
function ActorBadge({ actor }) {
  const map = {
    ai: 'bg-purple-100 text-purple-700',
    owner: 'bg-indigo-100 text-indigo-700',
    system: 'bg-gray-100   text-gray-600',
  };
  return <span className={`px-1.5 py-0.5 rounded text-xs font-semibold ${map[actor] || 'bg-gray-100 text-gray-600'}`}>{actor}</span>;
}

// ═══════════════════════════════════════════════════════════════════════════════
export default function App() {
  const [businesses, setBusinesses] = useState([]);
  const [bizId, setBizId] = useState(1);
  const [dashboard, setDashboard] = useState(null);
  const [queue, setQueue] = useState([]);
  const [demoDate, setDemoDate] = useState('');
  const [events, setEvents] = useState([]);
  const [selected, setSelected] = useState(null); // queue item
  const [activeTab, setActiveTab] = useState('reply');
  const [lang, setLang] = useState('EN');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [simAmount, setSimAmount] = useState('');
  const [simLoading, setSimLoading] = useState(false);
  const [advLoading, setAdvLoading] = useState(false);

  // ── fetch everything ────────────────────────────────────────────────────────
  const refresh = useCallback(async () => {
    setError('');
    try {
      const [dash, q, dd, ev] = await Promise.all([
        getDashboard(), getQueue(), getDemoDate(), getEvents()
      ]);
      setDashboard(dash.data);
      setQueue(q.data);
      setDemoDate(dd.data?.date || dd.data || '');
      setEvents(ev.data?.slice(0, 5) || []);
    } catch (e) {
      setError('Could not load data. Is the backend running?');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    getBusinesses()
      .then(r => {
        const list = r.data || [];
        setBusinesses(list);
        if (list.length > 0 && !list.some(b => b.id === bizId)) {
          const firstId = list[0].id;
          setBizId(firstId);
          setBusinessId(firstId);
        }
      })
      .catch(() => { });
    refresh();
  }, [refresh]);

  // update selected card when queue refreshes
  useEffect(() => {
    if (selected) {
      const updated = queue.find(q => (q.customer_id || q.id) === (selected.customer_id || selected.id));
      if (updated) setSelected(updated);
    }
  }, [queue]); // eslint-disable-line

  // pre-fill sim amount
  useEffect(() => {
    if (selected) setSimAmount(String(Number(selected.remaining) || ''));
  }, [selected]);

  // ── business switch ─────────────────────────────────────────────────────────
  const handleBizChange = (id) => {
    const numId = Number(id);
    setBizId(numId);
    setBusinessId(numId);
    setSelected(null);
    setLoading(true);
    refresh();
  };

  // ── advance demo date ───────────────────────────────────────────────────────
  const handleAdvance = async (days) => {
    setAdvLoading(true);
    try {
      await advanceDemoDate(days);
      await refresh();
    } catch {
      setError('Failed to advance date');
    } finally {
      setAdvLoading(false);
    }
  };

  // ── simulate paid ───────────────────────────────────────────────────────────
  const handleSimPaid = async () => {
    if (!selected) return;
    const invId = selected.invoices?.[0]?.id || selected.invoice_id;
    if (!invId) return;
    setSimLoading(true);
    try {
      await simulatePaid(invId, Number(simAmount));
      await refresh();
    } catch (e) {
      setError('Payment simulation failed');
    } finally {
      setSimLoading(false);
    }
  };

  // ── derived KPIs ─────────────────────────────────────────────────────────────
  const kpi = dashboard || {};

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col text-sm font-sans">

      {/* ── TOP BAR ────────────────────────────────────────────────────────── */}
      <header className="bg-white border-b border-gray-200 px-4 py-2 flex items-center gap-4 flex-wrap shadow-sm">
        {/* Logo */}
        <div className="flex flex-col leading-tight min-w-fit">
          <span className="text-xl font-extrabold text-indigo-700 tracking-tight">Vaada</span>
          <span className="text-xs text-gray-400 italic">Others chase invoices. We remember promises.</span>
        </div>

        {/* Business switcher */}
        <div className="flex-1 flex justify-center">
          <select
            value={bizId}
            onChange={e => handleBizChange(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 min-w-[200px]"
          >
            {businesses.map(b => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
            {businesses.length === 0 && <option value={1}>Business 1</option>}
          </select>
        </div>

        {/* Right controls */}
        <div className="flex items-center gap-2 flex-wrap justify-end">
          {/* Language */}
          <div className="flex border border-gray-200 rounded-lg overflow-hidden text-xs font-semibold">
            {['EN', 'HI', 'KN'].map(l => (
              <button
                key={l}
                onClick={() => setLang(l)}
                className={`px-2.5 py-1 transition-colors ${lang === l ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
              >
                {l}
              </button>
            ))}
          </div>

          {/* Demo date */}
          <span className="text-xs text-gray-500 font-mono bg-gray-100 px-2 py-1 rounded">
            📅 {demoDate || '…'}
          </span>

          {/* Advance buttons */}
          <button
            onClick={() => handleAdvance(1)}
            disabled={advLoading}
            className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition-colors"
          >
            {advLoading ? '…' : '+1 Day'}
          </button>
          <button
            onClick={() => handleAdvance(7)}
            disabled={advLoading}
            className="px-2.5 py-1 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition-colors"
          >
            +7 Days
          </button>

          {/* Demo badge */}
          <span className="bg-yellow-200 text-yellow-800 text-xs font-bold px-2 py-0.5 rounded-full border border-yellow-300">
            Demo data
          </span>
        </div>
      </header>

      {/* ── ERROR ──────────────────────────────────────────────────────────── */}
      {error && (
        <div className="mx-4 mt-2 bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-lg text-xs">
          ⚠️ {error}
        </div>
      )}

      {/* ── KPI STRIP ──────────────────────────────────────────────────────── */}
      <div className="px-4 pt-3 pb-2 flex gap-3 flex-wrap">
        <KpiCard
          label="Outstanding"
          value={fmtMoney(kpi.outstanding)}
          icon="💰"
          color="blue"
        />
        <KpiCard
          label="Overdue"
          value={fmtMoney(kpi.overdue)}
          icon="🔴"
          color="red"
        />
        <KpiCard
          label="Collected"
          value={fmtMoney(kpi.collected)}
          icon="✅"
          color="green"
        />
        <KpiCard
          label="Promised This Week"
          value={fmtMoney(kpi.promised_this_week)}
          sub={(kpi.risky_promised || kpi.risky_promises) > 0 ? `⚠️ ${fmtMoney(kpi.risky_promised || kpi.risky_promises)} risky` : null}
          icon="🤝"
          color="amber"
        />
      </div>

      {/* ── MAIN CONTENT ───────────────────────────────────────────────────── */}
      <div className="flex-1 px-4 pb-2 flex gap-3 overflow-hidden min-h-0" style={{ minHeight: 0 }}>

        {/* LEFT – Chase Queue */}
        <div className="w-[45%] flex flex-col min-w-0">
          {/* header */}
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-bold text-gray-700 text-sm">Chase Queue</h2>
            <button
              disabled
              className="px-3 py-1 text-xs bg-gray-100 text-gray-400 border border-gray-200 rounded-lg cursor-not-allowed"
              title="Coming soon"
            >
              📎 Upload Invoice
            </button>
          </div>

          {/* cards */}
          <div className="flex-1 overflow-y-auto space-y-2 pr-1" style={{ scrollbarWidth: 'thin' }}>
            {loading && <Spinner />}
            {!loading && queue.length === 0 && (
              <div className="text-center py-12 text-gray-400">
                <div className="text-3xl mb-2">🎉</div>
                <p className="font-medium">All clear! No invoices to chase.</p>
              </div>
            )}
            {queue.map(item => {
              const itemId = item.customer_id || item.id || item.invoice_id;
              const isSelected = (selected?.customer_id || selected?.id || selected?.invoice_id) === itemId;
              const overdue = Number(item.days_overdue) || 0;
              return (
                <div
                  key={itemId}
                  onClick={() => setSelected(item)}
                  className={`rounded-xl border p-3 cursor-pointer transition-all shadow-sm hover:shadow-md ${isSelected
                      ? 'border-indigo-400 bg-indigo-50 ring-2 ring-indigo-300'
                      : 'border-gray-200 bg-white hover:border-indigo-200 hover:bg-indigo-50/30'
                    }`}
                >
                  {/* row 1: name + score + badge */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-gray-800 truncate">{item.name || item.customer_name}</span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-xs font-mono font-bold text-indigo-700 bg-indigo-100 px-1.5 py-0.5 rounded">
                        Score: {item.score}
                      </span>
                      <PriorityBadge priority={item.label || item.priority} />
                    </div>
                  </div>

                  {/* row 2: amount */}
                  <div className="mt-1">
                    <span className="text-lg font-extrabold text-gray-900">{fmtMoney(item.remaining)}</span>
                    <span className="ml-2 text-xs">
                      {overdue > 0
                        ? <span className="text-red-600 font-semibold">{overdue} days overdue</span>
                        : <span className="text-green-600 font-semibold">Due in {Math.abs(overdue)} days</span>
                      }
                    </span>
                  </div>

                  {/* row 3: chase value + tone */}
                  <div className="mt-1 flex items-center gap-3 flex-wrap">
                    <span className="text-xs font-medium text-gray-600">Chase value: {fmtMoney(item.chase_value ?? item.remaining)}</span>
                    <ToneDot tone={item.tone || 'Friendly'} />
                  </div>

                  {/* row 4: why */}
                  {(item.why_line || item.why) && (
                    <p className="mt-1 text-xs italic text-gray-500 truncate">{item.why_line || item.why}</p>
                  )}

                  {/* row 5: promises */}
                  <PromiseIcons promises={item.promises} />
                </div>
              );
            })}
          </div>
        </div>

        {/* RIGHT – Tabs */}
        <div className="flex-1 flex flex-col min-w-0 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          {/* Tab bar */}
          <div className="flex border-b border-gray-200 bg-gray-50">
            {[
              { id: 'reply', label: '💬 Reply Lab' },
              { id: 'assistant', label: '🤖 Assistant' },
              { id: 'dispatch', label: '📤 Dispatch' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors ${activeTab === tab.id
                    ? 'border-indigo-600 text-indigo-700 bg-white'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                  }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-y-auto p-4" style={{ scrollbarWidth: 'thin' }}>

            {/* ── REPLY LAB ── */}
            {activeTab === 'reply' && (
              <>
                {!selected ? (
                  <div className="flex flex-col items-center justify-center h-full text-gray-400 py-16">
                    <div className="text-4xl mb-3">👈</div>
                    <p className="font-medium">Select a customer from the queue</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Invoice details */}
                    <div>
                      <h3 className="font-bold text-gray-700 mb-2 text-sm">Invoice Details</h3>
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs border-collapse">
                          <thead>
                            <tr className="bg-gray-50">
                              {['Invoice #', 'Date', 'Due Date', 'Total', 'Paid', 'Remaining', 'Status'].map(h => (
                                <th key={h} className="border border-gray-200 px-2 py-1.5 text-left font-semibold text-gray-600">{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {(selected.invoices && selected.invoices.length > 0 ? selected.invoices : [selected]).map((inv, idx) => (
                              <tr key={inv.id || idx} className="hover:bg-gray-50">
                                <td className="border border-gray-200 px-2 py-1.5 font-mono">{inv.number || inv.invoice_number || '—'}</td>
                                <td className="border border-gray-200 px-2 py-1.5">{fmtDate(inv.date || inv.invoice_date)}</td>
                                <td className="border border-gray-200 px-2 py-1.5">{fmtDate(inv.due_date)}</td>
                                <td className="border border-gray-200 px-2 py-1.5 font-semibold">{fmtMoney(inv.total)}</td>
                                <td className="border border-gray-200 px-2 py-1.5 text-green-700">{fmtMoney(inv.amount_paid)}</td>
                                <td className="border border-gray-200 px-2 py-1.5 text-red-700 font-semibold">{fmtMoney(inv.remaining)}</td>
                                <td className="border border-gray-200 px-2 py-1.5"><StatusBadge status={inv.status} /></td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Promise history */}
                    <div>
                      <h3 className="font-bold text-gray-700 mb-2 text-sm">Promise History</h3>
                      {(!selected.promises || selected.promises.length === 0) ? (
                        <p className="text-xs text-gray-400 italic">No promises recorded.</p>
                      ) : (
                        <div className="space-y-1.5">
                          {selected.promises.map((p, i) => (
                            <div key={i} className="flex items-center gap-3 text-xs bg-gray-50 rounded-lg px-3 py-2 border border-gray-100">
                              <span className="font-semibold text-gray-700">{fmtMoney(p.promised_amount)}</span>
                              <span className="text-gray-400">by</span>
                              <span className="text-gray-600">{fmtDate(p.promised_date)}</span>
                              <span className="ml-auto">
                                {p.status === 'kept' && <span className="text-green-600 font-bold">✓ Kept</span>}
                                {p.status === 'broken' && <span className="text-red-600 font-bold">✗ Broken</span>}
                                {p.status === 'open' && <span className="text-gray-400">○ Open</span>}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Simulate Paid */}
                    <div className="bg-green-50 border border-green-200 rounded-xl p-3">
                      <h3 className="font-bold text-green-800 mb-2 text-sm">💵 Simulate Payment</h3>
                      <div className="flex gap-2">
                        <input
                          type="number"
                          value={simAmount}
                          onChange={e => setSimAmount(e.target.value)}
                          className="flex-1 border border-green-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-400 bg-white"
                          placeholder="Amount"
                          min={1}
                        />
                        <button
                          onClick={handleSimPaid}
                          disabled={simLoading || !simAmount}
                          className="px-4 py-1.5 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors"
                        >
                          {simLoading ? '…' : 'Simulate Paid'}
                        </button>
                      </div>
                    </div>

                    {/* AI reply textarea */}
                    <div>
                      <h3 className="font-bold text-gray-700 mb-2 text-sm flex items-center gap-1">
                        🔒 Customer Reply
                        <span className="text-xs font-normal text-gray-400 ml-1">(AI coming soon)</span>
                      </h3>
                      <textarea
                        disabled
                        rows={3}
                        placeholder="Customer reply (AI coming soon)…"
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-400 cursor-not-allowed resize-none"
                      />
                    </div>
                  </div>
                )}
              </>
            )}

            {/* ── ASSISTANT ── */}
            {activeTab === 'assistant' && (
              <div className="flex flex-col items-center justify-center h-full py-16 text-gray-400">
                <div className="text-5xl mb-4">🤖</div>
                <h3 className="text-lg font-semibold text-gray-500">AI Assistant</h3>
                <p className="text-sm mt-1">Coming Soon</p>
              </div>
            )}

            {/* ── DISPATCH ── */}
            {activeTab === 'dispatch' && (
              <div className="flex flex-col items-center justify-center h-full py-16 text-gray-400">
                <div className="text-5xl mb-4">📤</div>
                <h3 className="text-lg font-semibold text-gray-500">Dispatch</h3>
                <p className="text-sm mt-1">Coming Soon</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── BOTTOM STRIP – Action Log ──────────────────────────────────────── */}
      <div className="bg-white border-t border-gray-200 px-4 py-2 shadow-sm">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-xs font-bold text-gray-600 shrink-0">Action Log</span>
          {events.length === 0 ? (
            <span className="text-xs text-gray-400 italic">No events yet.</span>
          ) : (
            <div className="flex gap-2 overflow-x-auto pb-0.5" style={{ scrollbarWidth: 'thin' }}>
              {events.map((ev, i) => (
                <div
                  key={ev.id ?? i}
                  className="shrink-0 flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1"
                >
                  <span className="text-xs text-gray-400 font-mono">{fmtTime(ev.time)}</span>
                  <ActorBadge actor={ev.actor} />
                  <span className="text-xs text-gray-700 max-w-[180px] truncate">{ev.action}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
