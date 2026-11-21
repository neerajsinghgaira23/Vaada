import React, { useState, useMemo } from 'react';
import { 
  Filter, 
  ArrowUpDown, 
  AlertTriangle, 
  UploadCloud, 
  Search,
  CheckCircle2,
  Clock
} from 'lucide-react';
import { fmtMoney, PriorityBadge, ToneDot, PromiseIcons } from '../components/Badges';

export default function QueuePage({ queue = [], onSelectCustomer }) {
  const [filterLabel, setFilterLabel] = useState('ALL');
  const [filterTone, setFilterTone] = useState('ALL');
  const [brokenOnly, setBrokenOnly] = useState(false);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('rank'); // 'rank', 'amount', 'overdue'

  const filteredQueue = useMemo(() => {
    return queue
      .filter((item) => {
        if (filterLabel !== 'ALL' && item.label?.toLowerCase() !== filterLabel.toLowerCase()) {
          return false;
        }
        if (filterTone !== 'ALL' && item.tone?.toLowerCase() !== filterTone.toLowerCase()) {
          return false;
        }
        if (brokenOnly && !item.has_broken_promise) {
          return false;
        }
        if (search.trim()) {
          const q = search.toLowerCase();
          return item.name?.toLowerCase().includes(q) || item.why_line?.toLowerCase().includes(q);
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'amount') return b.remaining - a.remaining;
        if (sortBy === 'overdue') return b.days_overdue - a.days_overdue;
        // Default rank: broken promise first, then chase value desc
        return (b.has_broken_promise ? 1 : 0) - (a.has_broken_promise ? 1 : 0) || b.chase_value - a.chase_value;
      });
  }, [queue, filterLabel, filterTone, brokenOnly, search, sortBy]);

  return (
    <div className="space-y-5">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-xl font-black text-slate-800 tracking-tight">Chase Queue</h2>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            Ranked by promise reliability and recovery value. Broken promises appear first.
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

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter by customer name or reason..."
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0f766e] focus:bg-white transition-all"
            />
          </div>

          {/* Sort Selector */}
          <div className="flex items-center gap-2 text-xs">
            <ArrowUpDown size={14} className="text-slate-400" />
            <span className="font-semibold text-slate-600">Sort by:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0f766e]"
            >
              <option value="rank">Smart Rank (Broken + Value)</option>
              <option value="amount">Amount (High to Low)</option>
              <option value="overdue">Days Overdue (High to Low)</option>
            </select>
          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 text-xs">
          <span className="font-bold text-slate-400 text-[10px] uppercase tracking-wider mr-1">Label:</span>
          {['ALL', 'Quick Win', 'Follow Up', 'Escalate'].map((lbl) => (
            <button
              key={lbl}
              onClick={() => setFilterLabel(lbl)}
              className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                filterLabel === lbl
                  ? 'bg-slate-800 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {lbl}
            </button>
          ))}

          <span className="font-bold text-slate-400 text-[10px] uppercase tracking-wider ml-3 mr-1">Tone:</span>
          {['ALL', 'Friendly', 'Firm', 'Final'].map((t) => (
            <button
              key={t}
              onClick={() => setFilterTone(t)}
              className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                filterTone === t
                  ? 'bg-slate-800 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {t}
            </button>
          ))}

          <label className="ml-auto flex items-center gap-1.5 cursor-pointer font-bold text-rose-700 bg-rose-50 border border-rose-200 px-3 py-1 rounded-lg hover:bg-rose-100 transition-colors">
            <input
              type="checkbox"
              checked={brokenOnly}
              onChange={(e) => setBrokenOnly(e.target.checked)}
              className="rounded text-rose-600 focus:ring-rose-500"
            />
            Broken Promises Only
          </label>
        </div>
      </div>

      {/* Queue Cards List */}
      <div className="space-y-3">
        {filteredQueue.length === 0 ? (
          <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center text-slate-400">
            <CheckCircle2 size={36} className="text-teal-600 mx-auto mb-2" />
            <p className="font-bold text-slate-700">No customers found matching these filters.</p>
            <p className="text-xs text-slate-400 mt-1">Try resetting the search or filter options.</p>
          </div>
        ) : (
          filteredQueue.map((item, index) => {
            const overdue = Number(item.days_overdue) || 0;
            return (
              <div
                key={item.customer_id || item.id}
                onClick={() => onSelectCustomer && onSelectCustomer(item.customer_id || item.id)}
                className="bg-white p-5 rounded-2xl border border-slate-200 hover:border-teal-400 hover:shadow-md transition-all cursor-pointer group space-y-3"
              >
                {/* Header row: Rank, Name, Score, Priority Badge, Broken Flag */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-500 font-mono font-bold text-xs flex items-center justify-center">
                      #{index + 1}
                    </span>
                    <h3 className="text-base font-bold text-slate-900 group-hover:text-teal-800 transition-colors">
                      {item.name}
                    </h3>
                    <span className="font-mono text-xs font-bold text-teal-800 bg-teal-50 px-2 py-0.5 rounded-md border border-teal-200">
                      Score: {item.score}
                    </span>
                    <PriorityBadge priority={item.label} />
                  </div>

                  <div className="flex items-center gap-3">
                    {item.has_broken_promise && (
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2.5 py-0.5 rounded-full animate-pulse">
                        <AlertTriangle size={12} />
                        Broken Promise
                      </span>
                    )}
                    <ToneDot tone={item.tone} />
                  </div>
                </div>

                {/* Amount and Overdue information */}
                <div className="flex flex-wrap items-baseline justify-between gap-2 pt-1 border-t border-slate-100">
                  <div className="flex items-baseline gap-3">
                    <span className="text-2xl font-black text-slate-900">
                      {fmtMoney(item.remaining)}
                    </span>
                    <span className="text-xs font-semibold">
                      {overdue > 0 ? (
                        <span className="text-rose-600 font-bold">{overdue} days overdue</span>
                      ) : (
                        <span className="text-emerald-600 font-bold">Due in {Math.abs(overdue)} days</span>
                      )}
                    </span>
                  </div>

                  <div className="text-xs font-semibold text-slate-600">
                    Chase value: <span className="font-bold text-teal-700 font-mono text-sm">{fmtMoney(item.chase_value)}</span>
                  </div>
                </div>

                {/* Why line */}
                <p className="text-xs text-slate-600 italic bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                  {item.why_line}
                </p>

                {/* Promises icons and invoices summary */}
                <div className="flex items-center justify-between text-xs pt-1 text-slate-500">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-semibold text-slate-400">Promises:</span>
                    <PromiseIcons promises={item.promises} />
                    <span className="text-[11px] text-slate-400">
                      ({item.promises_kept || 0} kept of {item.promises_made || 0} made)
                    </span>
                  </div>
                  <span className="text-[11px] text-teal-700 font-semibold group-hover:underline">
                    View customer record &rarr;
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
