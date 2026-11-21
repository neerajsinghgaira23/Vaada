import React, { useState, useEffect } from 'react';
import { ScrollText, RefreshCw, Filter, Clock } from 'lucide-react';
import { getEvents } from '../api';
import { fmtTime, fmtDate, ActorBadge } from '../components/Badges';

export default function ActionLogPage() {
  const [events, setEvents] = useState([]);
  const [actorFilter, setActorFilter] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadEvents = () => {
    setLoading(true);
    getEvents()
      .then((res) => setEvents(res.data || []))
      .catch((err) => {
        console.error('Failed to load events', err);
        setError('Could not load action log.');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadEvents();
  }, []);

  const filteredEvents = events.filter((ev) => {
    if (actorFilter === 'ALL') return true;
    return ev.actor?.toLowerCase() === actorFilter.toLowerCase();
  });

  return (
    <div className="space-y-5">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-xl font-black text-slate-800 tracking-tight">Audit &amp; Action Log</h2>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            Immutable timeline of system triggers, promise updates, and owner simulations.
          </p>
        </div>
        <button
          onClick={loadEvents}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-bold transition-colors shadow-xs"
        >
          <RefreshCw size={13} className={loading ? 'animate-spin text-teal-700' : ''} />
          Refresh Log
        </button>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <span className="font-bold text-slate-400 text-[10px] uppercase tracking-wider">Actor Filter:</span>
          {['ALL', 'system', 'owner', 'customer', 'ai'].map((act) => (
            <button
              key={act}
              onClick={() => setActorFilter(act)}
              className={`px-3 py-1 rounded-lg font-bold capitalize transition-colors ${
                actorFilter === act
                  ? 'bg-slate-800 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {act}
            </button>
          ))}
        </div>
        <span className="text-xs text-slate-400 font-medium">
          Showing {filteredEvents.length} event(s)
        </span>
      </div>

      {/* Events Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {loading && (
          <div className="py-20 text-center text-slate-400 text-xs font-medium">
            <div className="w-8 h-8 border-3 border-teal-200 border-t-teal-700 rounded-full animate-spin mx-auto mb-3" />
            Loading log entries...
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
                  <th className="p-4">Timestamp</th>
                  <th className="p-4">Actor</th>
                  <th className="p-4">Action</th>
                  <th className="p-4">Event Details &amp; Payload</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredEvents.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-8 text-center text-slate-400">
                      No events recorded for this filter.
                    </td>
                  </tr>
                ) : (
                  filteredEvents.map((ev) => (
                    <tr key={ev.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="p-4 font-mono text-slate-500 whitespace-nowrap text-[11px]">
                        <div>{fmtDate(ev.time)}</div>
                        <div className="text-slate-400">{fmtTime(ev.time)}</div>
                      </td>
                      <td className="p-4">
                        <ActorBadge actor={ev.actor} />
                      </td>
                      <td className="p-4 font-bold text-slate-800">
                        {ev.action}
                      </td>
                      <td className="p-4">
                        {ev.details ? (
                          <pre className="text-[11px] font-mono text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-100 max-w-xl overflow-x-auto">
                            {JSON.stringify(ev.details, null, 2)}
                          </pre>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
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
