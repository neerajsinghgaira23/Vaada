import React from 'react';
import { 
  DollarSign, 
  AlertCircle, 
  CheckCircle2, 
  Handshake, 
  ArrowRight, 
  Clock, 
  MessageSquareText, 
  ListOrdered,
  Calendar
} from 'lucide-react';
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
  Legend 
} from 'recharts';
import { fmtMoney, fmtDate, fmtTime, PriorityBadge, ToneDot, PromiseIcons, ActorBadge } from '../components/Badges';

export default function DashboardPage({
  dashboard,
  queue = [],
  events = [],
  onNavigate,
  onSelectCustomer,
  onAdvanceDays,
}) {
  const kpi = dashboard || {};

  // Data for Collected vs Outstanding by Customer (Top 5 customers from queue)
  const customerChartData = queue.slice(0, 5).map((item) => ({
    name: item.name?.split(' ')[0] || item.name,
    outstanding: item.remaining || 0,
    paid: item.total ? Math.max(0, item.total - item.remaining) : 1000,
  }));

  // Data for Promises Pie Chart
  const keptPromisesCount = queue.reduce((acc, c) => acc + (c.promises_kept || 0), 0);
  const brokenPromisesCount = queue.reduce((acc, c) => acc + (c.promises?.filter(p => p.status === 'broken').length || 0), 0);
  const openPromisesCount = queue.reduce((acc, c) => acc + (c.promises?.filter(p => p.status === 'open').length || 0), 0);

  const promisePieData = [
    { name: 'Kept', value: Math.max(keptPromisesCount, 2), color: '#10b981' },
    { name: 'Broken', value: Math.max(brokenPromisesCount, 1), color: '#ef4444' },
    { name: 'Open', value: Math.max(openPromisesCount, 2), color: '#f59e0b' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-800 tracking-tight">
            Good morning, Welcome to Vaada
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 font-medium">
            Your collections, and the promises behind them.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => onNavigate('queue')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#0f766e] text-white hover:bg-[#115e59] text-xs font-bold rounded-lg transition-colors shadow-xs"
          >
            <ListOrdered size={14} />
            Chase Queue
          </button>
          <button
            onClick={() => onAdvanceDays && onAdvanceDays(7)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-700 hover:bg-slate-200 text-xs font-bold rounded-lg transition-colors border border-slate-200"
          >
            <Calendar size={14} className="text-teal-700" />
            +7 Days Demo
          </button>
        </div>
      </div>

      {/* 4 KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Outstanding */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-start gap-3.5">
          <div className="p-2.5 rounded-xl bg-blue-50 text-blue-700 border border-blue-100">
            <DollarSign size={20} />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total Outstanding</p>
            <p className="text-xl font-black text-slate-900 mt-0.5">{fmtMoney(kpi.outstanding)}</p>
            <p className="text-[11px] text-slate-400 mt-0.5">Across all open invoices</p>
          </div>
        </div>

        {/* Overdue */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-start gap-3.5">
          <div className="p-2.5 rounded-xl bg-rose-50 text-rose-700 border border-rose-100">
            <AlertCircle size={20} />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Overdue Invoices</p>
            <p className="text-xl font-black text-rose-600 mt-0.5">{fmtMoney(kpi.overdue)}</p>
            <p className="text-[11px] text-rose-600 font-semibold mt-0.5">Needs immediate follow-up</p>
          </div>
        </div>

        {/* Collected */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-start gap-3.5">
          <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-100">
            <CheckCircle2 size={20} />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Collected</p>
            <p className="text-xl font-black text-emerald-700 mt-0.5">{fmtMoney(kpi.collected)}</p>
            <p className="text-[11px] text-emerald-600 font-semibold mt-0.5">Total payments received</p>
          </div>
        </div>

        {/* Promised This Week */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-start gap-3.5">
          <div className="p-2.5 rounded-xl bg-amber-50 text-amber-700 border border-amber-100">
            <Handshake size={20} />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Promised This Week</p>
            <p className="text-xl font-black text-amber-600 mt-0.5">{fmtMoney(kpi.promised_this_week)}</p>
            {(kpi.risky_promised || kpi.risky_promises) > 0 ? (
              <p className="text-[11px] font-semibold text-rose-600 mt-0.5">
                ⚠️ {fmtMoney(kpi.risky_promised || kpi.risky_promises)} from risky customers
              </p>
            ) : (
              <p className="text-[11px] text-slate-400 mt-0.5">Due in the next 7 days</p>
            )}
          </div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Chart 1: Customer Collections vs Outstanding */}
        <div className="lg:col-span-2 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-800">Outstanding vs Paid by Customer</h3>
              <p className="text-xs text-slate-400">Top customer exposure in queue</p>
            </div>
            <span className="text-[10px] uppercase font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded">
              Top 5 Customers
            </span>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={customerChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={(v) => `₹${v/1000}k`} />
                <Tooltip 
                  formatter={(val) => [fmtMoney(val)]}
                  contentStyle={{ backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '12px' }}
                />
                <Bar dataKey="outstanding" name="Outstanding" fill="#f87171" radius={[4, 4, 0, 0]} />
                <Bar dataKey="paid" name="Paid" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 2: Promises Ratio Pie */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-800">Promise Health</h3>
            <p className="text-xs text-slate-400">Kept, broken and open promises</p>
          </div>
          <div className="h-52 w-full my-auto">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={promisePieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={75}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {promisePieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-3 text-center border-t border-slate-100 pt-3 text-xs">
            <div>
              <p className="text-slate-400 text-[10px] uppercase font-bold">Kept</p>
              <p className="font-bold text-emerald-600 mt-0.5">{promisePieData[0].value}</p>
            </div>
            <div>
              <p className="text-slate-400 text-[10px] uppercase font-bold">Broken</p>
              <p className="font-bold text-rose-600 mt-0.5">{promisePieData[1].value}</p>
            </div>
            <div>
              <p className="text-slate-400 text-[10px] uppercase font-bold">Open</p>
              <p className="font-bold text-amber-600 mt-0.5">{promisePieData[2].value}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Top 5 Chase Queue & Recent Action Log */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Top 5 Chase Queue */}
        <div className="lg:col-span-2 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-800">Top Priority Chase Queue</h3>
              <p className="text-xs text-slate-400">Broken promises ranked first, then highest chase value</p>
            </div>
            <button
              onClick={() => onNavigate('queue')}
              className="text-xs font-bold text-teal-700 hover:text-teal-900 flex items-center gap-1"
            >
              View Full Queue <ArrowRight size={13} />
            </button>
          </div>

          <div className="space-y-2.5">
            {queue.slice(0, 5).map((item) => (
              <div
                key={item.customer_id || item.id}
                onClick={() => onSelectCustomer && onSelectCustomer(item.customer_id || item.id)}
                className="p-3 rounded-xl border border-slate-100 bg-slate-50/60 hover:bg-teal-50/50 hover:border-teal-200 transition-all cursor-pointer flex items-center justify-between gap-3 text-xs group"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-slate-900 group-hover:text-teal-800">{item.name}</span>
                    <span className="font-mono text-[11px] font-bold text-teal-800 bg-teal-100 px-1.5 py-0.2 rounded">
                      Score: {item.score}
                    </span>
                    <PriorityBadge priority={item.label} />
                    {item.has_broken_promise && (
                      <span className="text-[10px] font-bold bg-rose-100 text-rose-800 px-1.5 py-0.2 rounded-full border border-rose-300">
                        Broken Promise
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 italic truncate mt-1">{item.why_line}</p>
                </div>

                <div className="text-right shrink-0">
                  <p className="font-black text-slate-900 text-sm">{fmtMoney(item.remaining)}</p>
                  <p className="text-[11px] text-slate-500">Chase value: {fmtMoney(item.chase_value)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Action Log & Quick Actions */}
        <div className="space-y-5">
          {/* Recent Action Log */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-slate-800">Action Log</h3>
              <button
                onClick={() => onNavigate('events')}
                className="text-xs font-bold text-teal-700 hover:text-teal-900 flex items-center gap-1"
              >
                All Events <ArrowRight size={13} />
              </button>
            </div>
            <div className="space-y-2">
              {events.slice(0, 5).map((ev) => (
                <div key={ev.id} className="p-2 rounded-lg bg-slate-50 border border-slate-100 text-[11px]">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <ActorBadge actor={ev.actor} />
                    <span className="text-slate-400 font-mono text-[10px]">{fmtTime(ev.time)}</span>
                  </div>
                  <p className="font-semibold text-slate-700 truncate">{ev.action}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Actions Card */}
          <div className="bg-gradient-to-br from-teal-800 to-navy-900 text-white p-5 rounded-2xl shadow-xs space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-teal-200">Quick Navigation</h4>
            <div className="grid grid-cols-2 gap-2 text-xs font-semibold">
              <button
                onClick={() => onNavigate('reply-lab')}
                className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 transition-colors text-left flex items-center gap-2"
              >
                <MessageSquareText size={15} className="text-teal-300" />
                Reply Lab
              </button>
              <button
                onClick={() => onNavigate('promises')}
                className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 transition-colors text-left flex items-center gap-2"
              >
                <Handshake size={15} className="text-teal-300" />
                Promises
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
