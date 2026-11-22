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
import { useLanguage } from '../context/LanguageContext';

export const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'voice-agent', label: 'Vaada AI', icon: Sparkles },
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
  const { t } = useLanguage();
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
        className={`fixed md:static inset-y-0 left-0 z-50 w-64 bg-[#0a1826] border-r border-slate-800/70 text-slate-200 flex flex-col justify-between shrink-0 shadow-2xl transition-transform duration-200 ease-in-out ${
          isOpenMobile ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        {/* Top: Brand & Tagline */}
        <div>
          <div className="p-5 border-b border-slate-800/80 flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-teal-600 to-emerald-400 flex items-center justify-center font-black text-white text-lg tracking-wider shadow-md shadow-teal-500/20 ring-1 ring-white/20">
                  V
                </div>
                <h1 className="text-2xl font-black text-white tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-300 bg-clip-text text-transparent">Vaada</h1>
              </div>
              <p className="text-[11px] text-slate-400 mt-2 leading-snug font-medium italic">
                {t('brand.tagline')}
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
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-150 relative group cursor-pointer ${
                    isActive
                      ? 'bg-gradient-to-r from-teal-600 to-[#0d5e57] text-white shadow-md shadow-teal-950/50'
                      : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
                  }`}
                >
                  {isActive && (
                    <span className="absolute left-0 top-2 bottom-2 w-1 bg-teal-300 rounded-r-full" />
                  )}
                  <Icon
                    size={17}
                    className={`shrink-0 transition-transform group-hover:scale-110 duration-150 ${
                      isActive ? 'text-white' : 'text-slate-400 group-hover:text-teal-300'
                    }`}
                  />
                  <span className="flex-1 text-left truncate">{t(`nav.${item.id}`) || item.label}</span>
                  {item.id === 'voice-agent' && (
                    <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 animate-pulse">
                      LIVE
                    </span>
                  )}
                  {item.id === 'promises' && brokenPromisesCount > 0 && (
                    <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-500 text-white shadow-xs">
                      {brokenPromisesCount}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Bottom Profile & Business Info */}
        <div className="p-3 border-t border-slate-800/80 bg-[#07121d]/80">
          <div className="bg-[#0c1c2b] border border-slate-800/90 rounded-xl p-2.5 flex items-center gap-2.5 shadow-inner">
            <div className="relative">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-slate-700 to-slate-600 border border-slate-500/40 flex items-center justify-center text-teal-300 font-bold text-xs uppercase shadow-xs">
                {(business?.owner_name || 'Owner')[0]}
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-[#0c1c2b]" />
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
      </aside>
    </>
  );
}
