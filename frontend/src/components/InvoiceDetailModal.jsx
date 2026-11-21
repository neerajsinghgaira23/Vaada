import React, { useEffect, useState } from 'react';
import { X, FileText, Calendar, DollarSign, Handshake, CreditCard, User } from 'lucide-react';
import { getInvoiceDetail } from '../api';
import { fmtMoney, fmtDate, StatusBadge } from './Badges';

export default function InvoiceDetailModal({ invoiceId, onClose, onSelectCustomer }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!invoiceId) return;
    setLoading(true);
    setError('');
    getInvoiceDetail(invoiceId)
      .then((res) => setData(res.data))
      .catch((err) => {
        console.error('Failed to load invoice detail', err);
        setError('Could not load invoice detail.');
      })
      .finally(() => setLoading(false));
  }, [invoiceId]);

  if (!invoiceId) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#0f766e] text-white flex items-center justify-center font-bold">
              <FileText size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800 font-mono">{data?.number || 'Invoice'}</h2>
              <p className="text-xs text-slate-400">ID #{invoiceId}</p>
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
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {loading && (
            <div className="py-16 text-center text-slate-400 text-sm">
              <div className="w-8 h-8 border-3 border-teal-200 border-t-teal-700 rounded-full animate-spin mx-auto mb-3" />
              Loading invoice...
            </div>
          )}

          {error && (
            <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-medium">
              {error}
            </div>
          )}

          {!loading && data && (
            <>
              {/* Customer Box */}
              <div 
                onClick={() => data.customer?.id && onSelectCustomer && onSelectCustomer(data.customer.id)}
                className="p-4 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer hover:bg-teal-50/50 hover:border-teal-200 transition-colors group flex items-center justify-between"
              >
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Customer</span>
                  <p className="text-sm font-bold text-slate-900 group-hover:text-teal-800">{data.customer?.name}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{data.customer?.phone}</p>
                </div>
                <User size={18} className="text-slate-400 group-hover:text-teal-700" />
              </div>

              {/* Invoice Numbers Strip */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <div className="p-3 bg-white border border-slate-200 rounded-xl">
                  <span className="text-slate-400">Invoice Date</span>
                  <p className="font-semibold text-slate-800 mt-0.5">{fmtDate(data.date)}</p>
                </div>
                <div className="p-3 bg-white border border-slate-200 rounded-xl">
                  <span className="text-slate-400">Due Date</span>
                  <p className="font-semibold text-slate-800 mt-0.5">{fmtDate(data.due_date)}</p>
                </div>
                <div className="p-3 bg-white border border-slate-200 rounded-xl">
                  <span className="text-slate-400">Total</span>
                  <p className="font-bold text-slate-900 mt-0.5">{fmtMoney(data.total)}</p>
                </div>
                <div className="p-3 bg-white border border-slate-200 rounded-xl">
                  <span className="text-slate-400">Remaining</span>
                  <p className="font-bold text-rose-600 mt-0.5">{fmtMoney(data.remaining)}</p>
                </div>
              </div>

              <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs">
                <span className="font-semibold text-slate-700">Status</span>
                <StatusBadge status={data.status} />
              </div>

              {/* Payments */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2 flex items-center gap-1.5">
                  <CreditCard size={14} className="text-teal-700" />
                  Payments for this Invoice ({data.payments?.length || 0})
                </h3>
                {data.payments?.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">No payments applied yet.</p>
                ) : (
                  <div className="space-y-1.5">
                    {data.payments.map((p) => (
                      <div
                        key={p.id}
                        className="flex items-center justify-between p-2.5 rounded-lg border border-slate-200 bg-white text-xs"
                      >
                        <span className="font-bold text-emerald-700">{fmtMoney(p.amount)}</span>
                        <span className="text-slate-400">{p.method?.toUpperCase()}</span>
                        <span className="text-slate-500 font-mono text-[11px]">{fmtDate(p.paid_at)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Linked Promises */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2 flex items-center gap-1.5">
                  <Handshake size={14} className="text-teal-700" />
                  Linked Customer Promises ({data.promises?.length || 0})
                </h3>
                {data.promises?.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">No promises linked to this invoice.</p>
                ) : (
                  <div className="space-y-1.5">
                    {data.promises.map((p) => (
                      <div
                        key={p.id}
                        className="flex items-center justify-between p-2.5 rounded-lg border border-slate-200 bg-slate-50 text-xs"
                      >
                        <span className="font-bold text-slate-800">{fmtMoney(p.promised_amount)}</span>
                        <span className="text-slate-500">Promised by {fmtDate(p.promised_date)}</span>
                        <StatusBadge status={p.status} />
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
