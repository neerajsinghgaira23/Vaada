import React, { useState, useEffect } from 'react';
import { FileText, Filter, UploadCloud, ChevronLeft, ChevronRight, AlertCircle } from 'lucide-react';
import { getInvoices } from '../api';
import { fmtMoney, fmtDate, StatusBadge } from '../components/Badges';

export default function InvoicesPage({ onSelectInvoice, currentBizId }) {
  const [invoices, setInvoices] = useState(() => {
    try {
      const saved = localStorage.getItem('vaada_cached_invoices');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return [];
  });
  const [totalCount, setTotalCount] = useState(() => {
    try {
      return parseInt(localStorage.getItem('vaada_cached_invoices_count') || '0', 10);
    } catch (e) {
      return 0;
    }
  });
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const loadInvoices = () => {
    setLoading(true);
    const params = {
      page,
      limit: 10,
      status: statusFilter !== 'ALL' ? statusFilter.toLowerCase() : undefined,
      overdue: overdueOnly ? 'true' : undefined,
    };
    getInvoices(params)
      .then((res) => {
        const items = res.data.items || [];
        setInvoices(items);
        setTotalCount(res.data.total || 0);
        setPages(res.data.pages || 1);
        setError('');
        try {
          localStorage.setItem('vaada_cached_invoices', JSON.stringify(items));
          localStorage.setItem('vaada_cached_invoices_count', String(res.data.total || items.length));
        } catch (e) {}
      })
      .catch((err) => {
        console.error('Failed to load invoices', err);
        if (!localStorage.getItem('vaada_cached_invoices')) {
          setError('Could not load invoices.');
        }
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadInvoices();
  }, [page, statusFilter, overdueOnly, currentBizId]);

  return (
    <div className="space-y-5">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-xl font-black text-slate-800 tracking-tight">Invoice Ledger</h2>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            Track unpaid balances, aging overdue days, and linked payment promises.
          </p>
        </div>
        <button
          disabled
          className="inline-flex items-center gap-2 px-3 py-2 bg-slate-100 text-slate-400 border border-slate-200 rounded-xl text-xs font-bold cursor-not-allowed shadow-2xs"
          title="Coming soon"
        >
          <UploadCloud size={16} />
          Upload Invoice (Coming soon)
        </button>
      </div>

      {/* Filter Strip */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs">
        {/* Status filters */}
        <div className="flex items-center gap-2">
          <span className="font-bold text-slate-400 text-[10px] uppercase tracking-wider">Status:</span>
          {['ALL', 'unpaid', 'partial', 'paid'].map((st) => (
            <button
              key={st}
              onClick={() => {
                setStatusFilter(st);
                setPage(1);
              }}
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

        {/* Overdue Checkbox */}
        <label className="flex items-center gap-2 cursor-pointer font-bold text-rose-700 bg-rose-50 border border-rose-200 px-3 py-1 rounded-lg hover:bg-rose-100 transition-colors">
          <input
            type="checkbox"
            checked={overdueOnly}
            onChange={(e) => {
              setOverdueOnly(e.target.checked);
              setPage(1);
            }}
            className="rounded text-rose-600 focus:ring-rose-500"
          />
          Overdue Invoices Only
        </label>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {loading && (
          <div className="py-20 text-center text-slate-400 text-xs font-medium">
            <div className="w-8 h-8 border-3 border-teal-200 border-t-teal-700 rounded-full animate-spin mx-auto mb-3" />
            Loading invoices...
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
                  <th className="p-4">Invoice #</th>
                  <th className="p-4">Customer</th>
                  <th className="p-4">Invoice Date</th>
                  <th className="p-4">Due Date</th>
                  <th className="p-4">Total</th>
                  <th className="p-4">Paid</th>
                  <th className="p-4">Remaining</th>
                  <th className="p-4">Days Overdue</th>
                  <th className="p-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {invoices.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-slate-400">
                      No invoices found matching current criteria.
                    </td>
                  </tr>
                ) : (
                  invoices.map((inv) => (
                    <tr
                      key={inv.id}
                      onClick={() => onSelectInvoice && onSelectInvoice(inv.id)}
                      className="hover:bg-teal-50/40 cursor-pointer transition-colors group"
                    >
                      <td className="p-4 font-mono font-bold text-teal-700 group-hover:underline">
                        {inv.number}
                      </td>
                      <td className="p-4 font-bold text-slate-800">{inv.customer_name}</td>
                      <td className="p-4 text-slate-600">{fmtDate(inv.date)}</td>
                      <td className="p-4 text-slate-600">{fmtDate(inv.due_date)}</td>
                      <td className="p-4 font-bold text-slate-900">{fmtMoney(inv.total)}</td>
                      <td className="p-4 text-emerald-700 font-semibold">{fmtMoney(inv.amount_paid)}</td>
                      <td className="p-4 text-rose-600 font-bold text-sm">{fmtMoney(inv.remaining)}</td>
                      <td className="p-4">
                        {inv.days_overdue > 0 ? (
                          <span className="font-bold text-rose-600 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-full text-[11px]">
                            {inv.days_overdue} days late
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="p-4">
                        <StatusBadge status={inv.status} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        <div className="p-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <span>
            Showing page <strong className="text-slate-800">{page}</strong> of <strong className="text-slate-800">{pages}</strong> ({totalCount} total)
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={() => setPage((p) => Math.min(pages, p + 1))}
              disabled={page >= pages}
              className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
