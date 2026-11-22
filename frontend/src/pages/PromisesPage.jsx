import React, { useState, useEffect } from 'react';
import { Handshake, CheckCircle2, AlertTriangle, Clock, ArrowRight } from 'lucide-react';
import { getPromises } from '../api';
import { fmtMoney, fmtDate, StatusBadge } from '../components/Badges';

export default function PromisesPage({ onSelectCustomer, onSelectInvoice, currentBizId }) {
  const [data, setData] = useState(() => {
    try {
      const saved = localStorage.getItem('vaada_cached_promises');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return { items: [], summary: {} };
  });
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const loadPromises = () => {
    setLoading(true);
    const params = statusFilter !== 'ALL' ? { status: statusFilter.toLowerCase() } : {};
    getPromises(params)
      .then((res) => {
        const payload = res.data || { items: [], summary: {} };
        setData(payload);
        setError('');
        try {
          localStorage.setItem('vaada_cached_promises', JSON.stringify(payload));
        } catch (e) {}
      })
      .catch((err) => {
        console.error('Failed to load promises', err);
        if (!localStorage.getItem('vaada_cached_promises')) {
          setError('Could not load promises.');
        }
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadPromises();
  }, [statusFilter, currentBizId]);

  const summary = data.summary || {};

  return (
    <div className="space-y-5">
      {/* Top Header */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <h2 className="text-xl font-black text-slate-800 tracking-tight">Promise Register</h2>
        <p className="text-xs text-slate-500 mt-1 font-medium">
          “Others chase invoices. We remember promises.” Automatically verified with 1 day grace.
        </p>
      </div>

      {/* Summary KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-100">
            <CheckCircle2 size={18} />
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Kept Promises</span>
            <p className="text-xl font-black text-emerald-700">{summary.kept || 0}</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-rose-50 text-rose-700 border border-rose-100">
            <AlertTriangle size={18} />
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Broken Promises</span>
            <p className="text-xl font-black text-rose-600">{summary.broken || 0}</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-amber-50 text-amber-700 border border-amber-100">
            <Clock size={18} />
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Open Promises</span>
            <p className="text-xl font-black text-amber-600">{summary.open || 0}</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-teal-50 text-teal-800 border border-teal-100">
            <Handshake size={18} />
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Resolution Kept Rate</span>
            <p className="text-xl font-black text-teal-800">{summary.kept_rate || 0}%</p>
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <span className="font-bold text-slate-400 text-[10px] uppercase tracking-wider">Filter:</span>
          {['ALL', 'open', 'kept', 'broken'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1 rounded-lg font-bold capitalize transition-colors ${
                statusFilter === st
                  ? 'bg-slate-800 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
        <span className="text-xs text-slate-400 font-medium">
          Total: {data.items?.length || 0} promise(s)
        </span>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {loading && (
          <div className="py-20 text-center text-slate-400 text-xs font-medium">
            <div className="w-8 h-8 border-3 border-teal-200 border-t-teal-700 rounded-full animate-spin mx-auto mb-3" />
            Loading promises...
          </div>
        )}

        {error && (
          <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 text-xs">
            {error}
          </div>
        )}

        {!loading && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200 uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="p-4">Customer</th>
                  <th className="p-4">Invoice #</th>
                  <th className="p-4">Promised Amount</th>
                  <th className="p-4">Promised Date</th>
                  <th className="p-4">Status</th>
                  <th className="p-4">Source</th>
                  <th className="p-4">Created Date</th>
                  <th className="p-4">Resolved Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.items?.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-slate-400">
                      No promises found.
                    </td>
                  </tr>
                ) : (
                  data.items?.map((p) => (
                    <tr key={p.id} className="hover:bg-teal-50/30 transition-colors">
                      <td className="p-4">
                        <button
                          onClick={() => onSelectCustomer && onSelectCustomer(p.customer_id)}
                          className="font-bold text-slate-900 hover:text-teal-700 hover:underline text-left"
                        >
                          {p.customer_name}
                        </button>
                      </td>
                      <td className="p-4">
                        <button
                          onClick={() => onSelectInvoice && onSelectInvoice(p.invoice_id)}
                          className="font-mono font-semibold text-teal-700 hover:underline"
                        >
                          {p.invoice_number}
                        </button>
                      </td>
                      <td className="p-4 font-bold text-slate-900 text-sm">
                        {fmtMoney(p.promised_amount)}
                      </td>
                      <td className="p-4">
                        <span className="font-semibold text-slate-700">{fmtDate(p.promised_date)}</span>
                        {p.is_past_due && (
                          <span className="ml-1 text-[10px] font-bold text-rose-600 bg-rose-50 px-1 py-0.5 rounded">
                            Past Due
                          </span>
                        )}
                      </td>
                      <td className="p-4">
                        <StatusBadge status={p.status} />
                      </td>
                      <td className="p-4 capitalize text-slate-500">{p.source || 'text'}</td>
                      <td className="p-4 text-slate-500">{fmtDate(p.created_at)}</td>
                      <td className="p-4 text-slate-500">{fmtDate(p.resolved_at)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
