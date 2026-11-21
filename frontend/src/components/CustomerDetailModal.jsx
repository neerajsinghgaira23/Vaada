import React, { useEffect, useState } from 'react';
import { X, User, Phone, Mail, Globe, Check, AlertCircle, FileText, Handshake, CreditCard } from 'lucide-react';
import { getCustomerDetail } from '../api';
import { fmtMoney, fmtDate, PriorityBadge, StatusBadge, ToneDot } from './Badges';

export default function CustomerDetailModal({ customerId, onClose, onSelectInvoice }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!customerId) return;
    setLoading(true);
    setError('');
    getCustomerDetail(customerId)
      .then((res) => setData(res.data))
      .catch((err) => {
        console.error('Failed to load customer detail', err);
        setError('Could not load customer detail.');
      })
      .finally(() => setLoading(false));
  }, [customerId]);

  if (!customerId) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#0f766e] text-white flex items-center justify-center font-bold text-lg">
              {data?.customer?.name?.[0] || 'C'}
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800">{data?.customer?.name || 'Customer Details'}</h2>
              <p className="text-xs text-slate-400">ID #{customerId}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/50 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {loading && (
            <div className="py-16 text-center text-slate-400 text-sm">
              <div className="w-8 h-8 border-3 border-teal-200 border-t-teal-700 rounded-full animate-spin mx-auto mb-3" />
              Loading customer record...
            </div>
          )}

          {error && (
            <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-medium">
              {error}
            </div>
          )}

          {!loading && data && (
            <>
              {/* Profile Bar */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs">
                <div>
                  <span className="text-slate-400 font-medium">Phone</span>
                  <p className="font-semibold text-slate-800 mt-0.5">{data.customer.phone || '—'}</p>
                </div>
                <div>
                  <span className="text-slate-400 font-medium">Email</span>
                  <p className="font-semibold text-slate-800 mt-0.5 truncate">{data.customer.email || '—'}</p>
                </div>
                <div>
                  <span className="text-slate-400 font-medium">Language</span>
                  <p className="font-semibold text-slate-800 mt-0.5 uppercase">{data.customer.preferred_language || 'EN'}</p>
                </div>
                <div>
                  <span className="text-slate-400 font-medium">Outstanding</span>
                  <p className="font-bold text-rose-600 mt-0.5 text-sm">{fmtMoney(data.total_outstanding)}</p>
                </div>
              </div>

              {/* Score & Rules Breakdown */}
              <div className="p-5 border border-slate-200 rounded-xl bg-gradient-to-br from-white to-slate-50 shadow-xs space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-black text-slate-900 font-mono">
                      {data.score}
                    </span>
                    <span className="text-xs text-slate-400">/ 100</span>
                    <PriorityBadge priority={data.label} />
                  </div>
                  <ToneDot tone={data.tone} />
                </div>

                {data.why_line && (
                  <p className="text-xs text-slate-600 font-medium bg-slate-100/70 p-2.5 rounded-lg border border-slate-200 italic">
                    {data.why_line}
                  </p>
                )}

                {/* Mathematical breakdown */}
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                    Score Calculation Rules (Pure Python)
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    <div className="flex items-center justify-between p-2 rounded-lg bg-white border border-slate-100">
                      <span className="text-slate-600">Base Start Score</span>
                      <span className="font-mono font-bold text-slate-700">+{data.score_breakdown.base}</span>
                    </div>
                    <div className="flex items-center justify-between p-2 rounded-lg bg-white border border-slate-100">
                      <span className="text-slate-600">Partial Payment History</span>
                      <span className={`font-mono font-bold ${data.score_breakdown.partial_payment_bonus > 0 ? 'text-emerald-600' : 'text-slate-400'}`}>
                        +{data.score_breakdown.partial_payment_bonus}
                      </span>
                    </div>
                    <div className="flex items-center justify-between p-2 rounded-lg bg-white border border-slate-100">
                      <span className="text-slate-600">Promises Kept Ratio</span>
                      <span className={`font-mono font-bold ${data.score_breakdown.promises_bonus > 0 ? 'text-emerald-600' : 'text-slate-400'}`}>
                        +{data.score_breakdown.promises_bonus}
                      </span>
                    </div>
                    <div className="flex items-center justify-between p-2 rounded-lg bg-white border border-slate-100">
                      <span className="text-slate-600">Replied in Last 3 Days</span>
                      <span className={`font-mono font-bold ${data.score_breakdown.recent_reply_bonus > 0 ? 'text-emerald-600' : 'text-slate-400'}`}>
                        +{data.score_breakdown.recent_reply_bonus}
                      </span>
                    </div>
                    <div className="flex items-center justify-between p-2 rounded-lg bg-white border border-slate-100">
                      <span className="text-slate-600">Overdue Days Penalty (&gt;7d)</span>
                      <span className={`font-mono font-bold ${data.score_breakdown.overdue_penalty < 0 ? 'text-rose-600' : 'text-slate-400'}`}>
                        {data.score_breakdown.overdue_penalty}
                      </span>
                    </div>
                    <div className="flex items-center justify-between p-2 rounded-lg bg-white border border-slate-100">
                      <span className="text-slate-600">Unreplied Reminders Penalty</span>
                      <span className={`font-mono font-bold ${data.score_breakdown.ignored_reminders_penalty < 0 ? 'text-rose-600' : 'text-slate-400'}`}>
                        {data.score_breakdown.ignored_reminders_penalty}
                      </span>
                    </div>
                    <div className="flex items-center justify-between p-2 rounded-lg bg-white border border-slate-100">
                      <span className="text-slate-600">Broken Promise Penalty</span>
                      <span className={`font-mono font-bold ${data.score_breakdown.broken_promise_penalty < 0 ? 'text-rose-600' : 'text-slate-400'}`}>
                        {data.score_breakdown.broken_promise_penalty}
                      </span>
                    </div>
                    <div className="flex items-center justify-between p-2 rounded-lg bg-teal-50 border border-teal-100">
                      <span className="font-bold text-teal-900">Total Clamped Score</span>
                      <span className="font-mono font-black text-teal-800">{data.score}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Invoices List */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2 flex items-center gap-1.5">
                  <FileText size={14} className="text-teal-700" />
                  Invoices ({data.invoices?.length || 0})
                </h3>
                {data.invoices?.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">No invoices found.</p>
                ) : (
                  <div className="overflow-x-auto border border-slate-200 rounded-xl">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                        <tr>
                          <th className="p-3">Invoice #</th>
                          <th className="p-3">Date</th>
                          <th className="p-3">Due Date</th>
                          <th className="p-3">Total</th>
                          <th className="p-3">Paid</th>
                          <th className="p-3">Remaining</th>
                          <th className="p-3">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {data.invoices.map((inv) => (
                          <tr
                            key={inv.id}
                            onClick={() => onSelectInvoice && onSelectInvoice(inv.id)}
                            className="hover:bg-slate-50/80 cursor-pointer transition-colors"
                          >
                            <td className="p-3 font-mono font-bold text-teal-700">{inv.number}</td>
                            <td className="p-3 text-slate-600">{fmtDate(inv.date)}</td>
                            <td className="p-3 text-slate-600">
                              {fmtDate(inv.due_date)}
                              {inv.days_overdue > 0 && (
                                <span className="ml-1 text-[11px] text-rose-600 font-semibold">
                                  ({inv.days_overdue}d late)
                                </span>
                              )}
                            </td>
                            <td className="p-3 font-bold text-slate-800">{fmtMoney(inv.total)}</td>
                            <td className="p-3 text-emerald-700 font-semibold">{fmtMoney(inv.amount_paid)}</td>
                            <td className="p-3 text-rose-600 font-bold">{fmtMoney(inv.remaining)}</td>
                            <td className="p-3">
                              <StatusBadge status={inv.status} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Promises History */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2 flex items-center gap-1.5">
                  <Handshake size={14} className="text-teal-700" />
                  Promise History ({data.promises?.length || 0})
                </h3>
                {data.promises?.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">No promises recorded.</p>
                ) : (
                  <div className="space-y-2">
                    {data.promises.map((p) => (
                      <div
                        key={p.id}
                        className="flex items-center justify-between p-3 rounded-xl border border-slate-200 bg-slate-50/60 text-xs"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-800">{fmtMoney(p.promised_amount)}</span>
                            <span className="text-slate-400">• Promised date: {fmtDate(p.promised_date)}</span>
                          </div>
                          <p className="text-[11px] text-slate-400 mt-0.5">Source: {p.source}</p>
                        </div>
                        <StatusBadge status={p.status} />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Payment History */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2 flex items-center gap-1.5">
                  <CreditCard size={14} className="text-teal-700" />
                  Payments Received ({data.payments?.length || 0})
                </h3>
                {data.payments?.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">No payments recorded yet.</p>
                ) : (
                  <div className="space-y-1.5">
                    {data.payments.map((pay) => (
                      <div
                        key={pay.id}
                        className="flex items-center justify-between p-2.5 rounded-xl border border-slate-200 bg-white text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-emerald-700">{fmtMoney(pay.amount)}</span>
                          <span className="text-slate-400">• {pay.method?.toUpperCase()}</span>
                        </div>
                        <span className="text-slate-500 font-mono text-[11px]">{fmtDate(pay.paid_at)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
