import React from 'react';

export function fmtMoney(val) {
  const n = Number(val) || 0;
  return '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

export function fmtDate(d) {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return d;
  }
}

export function fmtTime(d) {
  if (!d) return '';
  try {
    return new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

// Strictly 3 badge colors: Green, Amber, Red
export function PriorityBadge({ priority }) {
  const p = (priority || '').toLowerCase();
  if (p.includes('quick win') || p === 'quick win') {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300">
        Quick Win
      </span>
    );
  }
  if (p.includes('escalate') || p === 'escalate') {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 border border-rose-300">
        Escalate
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-300">
      Follow Up
    </span>
  );
}

export function StatusBadge({ status }) {
  const s = (status || '').toLowerCase();
  if (s === 'paid' || s === 'kept') {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
        {s === 'paid' ? 'Paid' : 'Kept'}
      </span>
    );
  }
  if (s === 'broken' || s === 'overdue') {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-rose-100 text-rose-800 border border-rose-200">
        {s === 'broken' ? 'Broken' : 'Overdue'}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
      {s === 'partial' ? 'Partial' : s === 'open' ? 'Open' : 'Unpaid'}
    </span>
  );
}

export function ToneDot({ tone }) {
  const map = {
    Friendly: { color: 'bg-emerald-500', text: 'text-emerald-700' },
    Firm: { color: 'bg-amber-500', text: 'text-amber-700' },
    Final: { color: 'bg-rose-600', text: 'text-rose-700' },
  };
  const t = map[tone] || map.Friendly;
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-slate-600 font-medium">
      <span className={`w-2 h-2 rounded-full ${t.color}`} />
      Tone: {tone || 'Friendly'}
    </span>
  );
}

export function PromiseIcons({ promises }) {
  if (!promises || promises.length === 0) return null;
  return (
    <div className="flex items-center gap-1">
      {promises.map((p, i) => {
        if (p.status === 'kept') {
          return (
            <span key={i} className="text-emerald-600 font-extrabold text-xs" title={`Kept ₹${p.promised_amount}`}>
              ✓
            </span>
          );
        }
        if (p.status === 'broken') {
          return (
            <span key={i} className="text-rose-600 font-extrabold text-xs" title={`Broken ₹${p.promised_amount}`}>
              ✗
            </span>
          );
        }
        return (
          <span key={i} className="text-slate-400 text-xs" title={`Open ₹${p.promised_amount}`}>
            ○
          </span>
        );
      })}
    </div>
  );
}

export function ActorBadge({ actor }) {
  const a = (actor || '').toLowerCase();
  if (a === 'ai') {
    return <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-purple-100 text-purple-700 border border-purple-200">AI</span>;
  }
  if (a === 'owner') {
    return <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-teal-100 text-teal-800 border border-teal-200">Owner</span>;
  }
  if (a === 'customer') {
    return <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-blue-100 text-blue-700 border border-blue-200">Customer</span>;
  }
  return <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-600 border border-slate-200">System</span>;
}

export function DemoDataBadge() {
  return (
    <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-900 border border-amber-300 text-[11px] font-bold px-2 py-0.5 rounded-full shadow-xs">
      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
      Demo data
    </span>
  );
}
