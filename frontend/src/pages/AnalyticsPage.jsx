import React, { useState, useEffect } from 'react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell, 
  LineChart, 
  Line 
} from 'recharts';
import { BarChart3, TrendingUp, Calendar, AlertTriangle } from 'lucide-react';
import { getAnalytics } from '../api';
import { fmtMoney, PriorityBadge } from '../components/Badges';

export default function AnalyticsPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const loadAnalytics = () => {
    setLoading(true);
    getAnalytics({ from_date: fromDate || undefined, to_date: toDate || undefined })
      .then((res) => setData(res.data))
      .catch((err) => {
        console.error('Failed to load analytics', err);
        setError('Could not load analytics data.');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadAnalytics();
  }, [fromDate, toDate]);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-xl font-black text-slate-800 tracking-tight">Recovery &amp; Promise Analytics</h2>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            Aggregated exposure, aging breakdown, and collections trajectory.
          </p>
        </div>
        {/* Date Filter */}
        <div className="flex items-center gap-2 text-xs">
          <Calendar size={14} className="text-slate-400" />
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="border border-slate-200 rounded-lg px-2 py-1 bg-slate-50 text-slate-700"
          />
          <span className="text-slate-400">to</span>
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="border border-slate-200 rounded-lg px-2 py-1 bg-slate-50 text-slate-700"
          />
        </div>
      </div>

      {loading && (
        <div className="bg-white p-24 rounded-2xl border border-slate-200 text-center text-slate-400 text-xs">
          <div className="w-8 h-8 border-3 border-teal-200 border-t-teal-700 rounded-full animate-spin mx-auto mb-3" />
          Calculating metrics across active invoices...
        </div>
      )}

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs">
          {error}
        </div>
      )}

      {!loading && data && (
        <div className="space-y-6">
          {/* Row 1: Overdue Aging Buckets & Promises Status */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Overdue Aging */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
              <div>
                <h3 className="text-sm font-bold text-slate-800">Overdue Invoices by Aging Bucket</h3>
                <p className="text-xs text-slate-400">Delinquency distribution across standard buckets</p>
              </div>

              <div className="h-60 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.overdue_buckets} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <XAxis dataKey="bucket" tick={{ fontSize: 11, fill: '#64748b' }} />
                    <YAxis tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={(v) => `₹${v/1000}k`} />
                    <Tooltip 
                      formatter={(val) => [fmtMoney(val), 'Amount']}
                      contentStyle={{ backgroundColor: '#fff', borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: '12px' }}
                    />
                    <Bar dataKey="amount" name="Amount" fill="#0f766e" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100 text-center text-xs">
                {data.overdue_buckets.map((b) => (
                  <div key={b.bucket} className="p-2 rounded-lg bg-slate-50">
                    <p className="text-slate-400 text-[10px] uppercase font-bold">{b.bucket}</p>
                    <p className="font-bold text-slate-800 mt-0.5">{fmtMoney(b.amount)}</p>
                    <p className="text-[10px] text-slate-400">({b.count} invoices)</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Promises Status Pie */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
              <div>
                <h3 className="text-sm font-bold text-slate-800">Promise Outcomes</h3>
                <p className="text-xs text-slate-400">Kept vs Broken vs Open commitments</p>
              </div>

              <div className="h-60 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={data.promises_breakdown}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={80}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {data.promises_breakdown.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: '#fff', borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: '12px' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100 text-center text-xs">
                {data.promises_breakdown.map((item) => (
                  <div key={item.name} className="p-2 rounded-lg bg-slate-50">
                    <p className="text-slate-400 text-[10px] uppercase font-bold">{item.name}</p>
                    <p className="font-bold text-slate-900 mt-0.5" style={{ color: item.fill }}>
                      {item.value}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Row 2: Score Distribution & Top 5 Chase Values */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Score Distribution */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
              <div>
                <h3 className="text-sm font-bold text-slate-800">Priority Label Distribution</h3>
                <p className="text-xs text-slate-400">Customer breakdown by action bucket</p>
              </div>

              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.score_distribution} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748b' }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748b' }} />
                    <Tooltip contentStyle={{ backgroundColor: '#fff', borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: '12px' }} />
                    <Bar dataKey="count" name="Customers" radius={[6, 6, 0, 0]}>
                      {data.score_distribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Top 5 Chase Values */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
              <div>
                <h3 className="text-sm font-bold text-slate-800">Top 5 Expected Chase Values</h3>
                <p className="text-xs text-slate-400">Formula: remaining amount × (score / 100)</p>
              </div>

              <div className="space-y-2 pt-1">
                {data.top_chase_values?.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">No customers with open balance.</p>
                ) : (
                  data.top_chase_values.map((c, i) => (
                    <div
                      key={c.name}
                      className="p-3 rounded-xl border border-slate-100 bg-slate-50/70 flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-600 font-bold text-[10px] flex items-center justify-center">
                          {i + 1}
                        </span>
                        <div>
                          <p className="font-bold text-slate-800">{c.name}</p>
                          <p className="text-[11px] text-slate-400">Score: {c.score} • Total due: {fmtMoney(c.remaining)}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-black text-teal-800 text-sm font-mono">{fmtMoney(c.chase_value)}</p>
                        <span className="text-[10px] text-slate-400 uppercase font-semibold">Chase Value</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
