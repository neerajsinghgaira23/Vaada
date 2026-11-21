import React from 'react';
import { 
  LayoutDashboard, 
  ListOrdered, 
  Users, 
  FileText, 
  Handshake, 
  MessageSquareText, 
  Send, 
  ScrollText, 
  BarChart3, 
  Settings, 
  X,
  Sparkles,
  Building2,
  UserCheck
} from 'lucide-react';
import { DemoDataBadge } from './Badges';

export const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'queue', label: 'Chase Queue', icon: ListOrdered },
  { id: 'customers', label: 'Customers', icon: Users },
  { id: 'invoices', label: 'Invoices', icon: FileText },
  { id: 'promises', label: 'Promises', icon: Handshake },
  { id: 'reply-lab', label: 'Reply Lab', icon: MessageSquareText },
  { id: 'dispatch', label: 'Dispatch', icon: Send },
  { id: 'events', label: 'Action Log', icon: ScrollText },
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
  { id: 'settings', label: 'Settings', icon: Settings },
];

export default function Sidebar({
  currentPage,
  onNavigate,
  business,
  isOpenMobile,
  onCloseMobile,
  brokenPromisesCount = 0,
}) {
  return (
    <>
      {/* Mobile backdrop */}
      {isOpenMobile && (
        <div 
          className="fixed inset-0 bg-slate-900/60 z-40 md:hidden backdrop-blur-xs transition-opacity"
          onClick={onCloseMobile}
        />
      )}

      {/* Sidebar container */}
      <aside
        className={`fixed md:static inset-y-0 left-0 z-50 w-64 bg-[#0e1f2f] text-slate-200 flex flex-col justify-between shrink-0 shadow-xl transition-transform duration-200 ease-in-out ${
          isOpenMobile ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        {/* Top: Brand & Tagline */}
        <div>
          <div className="p-5 border-b border-slate-800/80 flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-[#0f766e] flex items-center justify-center font-black text-white text-lg tracking-wider shadow-md">
                  V
                </div>
                <h1 className="text-2xl font-black text-white tracking-tight">Vaada</h1>
              </div>
              <p className="text-[11px] text-slate-400 mt-1.5 leading-snug font-medium italic">
                “Others chase invoices. We remember promises.”
              </p>
            </div>
            <button
              onClick={onCloseMobile}
              className="md:hidden text-slate-400 hover:text-white p-1 rounded-lg"
              aria-label="Close sidebar"
            >
              <X size={20} />
            </button>
          </div>

          {/* Navigation Links */}
          <nav className="p-3 space-y-1">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = currentPage === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    onNavigate(item.id);
                    onCloseMobile();
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-all group ${
                    isActive
                      ? 'bg-[#0f766e] text-white shadow-sm'
                      : 'text-slate-300 hover:bg-[#142a3e] hover:text-white'
                  }`}
                >
                  <Icon
                    size={18}
                    className={`shrink-0 transition-transform group-hover:scale-105 ${
                      isActive ? 'text-white' : 'text-slate-400 group-hover:text-teal-300'
                    }`}
                  />
                  <span className="flex-1 text-left truncate">{item.label}</span>
                  {item.id === 'promises' && brokenPromisesCount > 0 && (
                    <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-rose-500 text-white">
                      {brokenPromisesCount}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Bottom Profile & Business Info */}
        <div className="p-4 border-t border-slate-800/80 bg-[#091520]/70 space-y-3">
          <div className="flex items-center justify-between">
            <DemoDataBadge />
            <span className="text-[10px] text-slate-400 font-mono">v1.2 Demo</span>
          </div>

          <div className="pt-1">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-slate-700 border border-slate-600 flex items-center justify-center text-teal-300 font-bold text-xs uppercase shadow-xs">
                {(business?.owner_name || 'Owner')[0]}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-white truncate leading-tight">
                  {business?.owner_name || 'Sunil Kumar'}
                </p>
                <p className="text-[11px] text-slate-400 truncate flex items-center gap-1 mt-0.5">
                  <Building2 size={11} className="shrink-0 text-slate-500" />
                  <span className="truncate">{business?.name || 'Sunil Cloth House'}</span>
                </p>
              </div>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
