import React, { useState, useEffect } from 'react';
import { Search, UserPlus, Users, ArrowRight } from 'lucide-react';
import { getCustomers } from '../api';
import { fmtMoney, PriorityBadge, ToneDot } from '../components/Badges';

export default function CustomersPage({ onSelectCustomer, currentBizId }) {
  const [customers, setCustomers] = useState(() => {
    try {
      const saved = localStorage.getItem('vaada_cached_customers');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return [];
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const loadData = () => {
    setLoading(true);
    getCustomers()
      .then((res) => {
        const list = res.data || [];
        setCustomers(list);
        setError('');
        try {
          localStorage.setItem('vaada_cached_customers', JSON.stringify(list));
        } catch (e) {}
      })
      .catch((err) => {
        console.error('Failed to load customers', err);
        setError('Could not load customers list.');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, [currentBizId]);

  const filtered = customers.filter((c) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return c.name?.toLowerCase().includes(q) || c.phone?.includes(q) || c.preferred_language?.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-xl font-black text-slate-800 tracking-tight">Customer Directory</h2>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            Customer promise history, score ratings, and outstanding balances.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search customers..."
              className="pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0f766e] focus:bg-white w-56"
            />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {loading && (
          <div className="py-20 text-center text-slate-400 text-xs font-medium">
            <div className="w-8 h-8 border-3 border-teal-200 border-t-teal-700 rounded-full animate-spin mx-auto mb-3" />
            Loading customer list...
          </div>
        )}

        {error && (
          <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center justify-between">
            <span>{error}</span>
            <button
              onClick={loadData}
              className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg transition-colors cursor-pointer"
            >
              Retry
            </button>
          </div>
        )}

        {!loading && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200 uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="p-4">Customer</th>
                  <th className="p-4">Phone</th>
                  <th className="p-4">Language</th>
                  <th className="p-4">Outstanding</th>
                  <th className="p-4">Total Paid</th>
                  <th className="p-4">Promises Kept / Made</th>
                  <th className="p-4">Score</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-slate-400">
                      No customers found.
                    </td>
                  </tr>
                ) : (
                  filtered.map((c) => (
                    <tr
                      key={c.id}
                      onClick={() => onSelectCustomer && onSelectCustomer(c.id)}
                      className="hover:bg-teal-50/40 cursor-pointer transition-colors group"
                    >
                      <td className="p-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-lg bg-slate-100 text-teal-800 font-bold flex items-center justify-center text-xs">
                            {c.name?.[0] || 'C'}
                          </div>
                          <div>
                            <p className="font-bold text-slate-900 group-hover:text-teal-800 transition-colors">
                              {c.name}
                            </p>
                            <p className="text-[11px] text-slate-400">{c.invoices_count || 0} invoice(s)</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-4 font-mono text-slate-600">{c.phone || '—'}</td>
                      <td className="p-4">
                        <span className="uppercase text-[10px] font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
                          {c.preferred_language || 'EN'}
                        </span>
                      </td>
                      <td className="p-4 font-bold text-rose-600 text-sm">
                        {fmtMoney(c.total_outstanding)}
                      </td>
                      <td className="p-4 font-semibold text-emerald-700">
                        {fmtMoney(c.total_paid)}
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-1.5 font-semibold text-slate-700">
                          <span>{c.promises_kept} / {c.promises_made}</span>
                          {c.has_broken_promise && (
                            <span className="text-[10px] font-bold text-rose-600 bg-rose-50 px-1 rounded">
                              Broken
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-4">
                        <span className="font-mono font-black text-slate-900 bg-slate-100 px-2 py-0.5 rounded text-xs">
                          {c.score}
                        </span>
                      </td>
                      <td className="p-4">
                        <PriorityBadge priority={c.label} />
                      </td>
                      <td className="p-4 text-right">
                        <span className="text-xs font-bold text-teal-700 group-hover:underline inline-flex items-center gap-1">
                          View <ArrowRight size={12} />
                        </span>
                      </td>
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
