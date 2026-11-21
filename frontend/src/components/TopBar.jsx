import React, { useState, useEffect, useRef } from 'react';
import { 
  Search, 
  Menu, 
  Calendar, 
  Bell, 
  ChevronDown, 
  User, 
  AlertTriangle,
  ArrowRight,
  RefreshCw,
  Building,
  CheckCircle2
} from 'lucide-react';
import { searchAll, advanceDemoDate } from '../api';
import { fmtDate, fmtMoney } from './Badges';

export default function TopBar({
  businesses = [],
  currentBizId,
  onBizChange,
  demoDate,
  onDateChange,
  onOpenMobileSidebar,
  lang,
  onLangChange,
  brokenPromises = [],
  onNavigate,
  onSelectCustomer,
  onSelectInvoice,
}) {
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [isAdvancing, setIsAdvancing] = useState(false);

  const searchRef = useRef(null);
  const notifRef = useRef(null);
  const profileRef = useRef(null);

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setShowSearchDropdown(false);
      }
      if (notifRef.current && !notifRef.current.contains(event.target)) {
        setShowNotifications(false);
      }
      if (profileRef.current && !profileRef.current.contains(event.target)) {
        setShowProfileMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Live search debounce
  useEffect(() => {
    if (!query.trim()) {
      setSearchResults(null);
      setIsSearching(false);
      return;
    }
    setIsSearching(true);
    const timer = setTimeout(async () => {
      try {
        const res = await searchAll(query);
        setSearchResults(res.data);
        setShowSearchDropdown(true);
      } catch (err) {
        console.error('Search failed', err);
      } finally {
        setIsSearching(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);

  // Handle Demo Date Advance
  const handleAdvance = async (days) => {
    setIsAdvancing(true);
    try {
      const res = await advanceDemoDate(days);
      if (res.data?.date) {
        onDateChange(res.data.date);
      }
    } catch (err) {
      console.error('Date advance failed', err);
    } finally {
      setIsAdvancing(false);
    }
  };

  const currentBiz = businesses.find(b => b.id === currentBizId) || businesses[0];

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30 px-4 py-2.5 flex items-center justify-between gap-3 shadow-xs">
      {/* Left: Mobile Toggle & Search Bar */}
      <div className="flex items-center gap-3 flex-1 max-w-lg">
        <button
          onClick={onOpenMobileSidebar}
          className="md:hidden text-slate-600 hover:text-slate-900 p-1.5 rounded-lg hover:bg-slate-100"
          aria-label="Open navigation"
        >
          <Menu size={20} />
        </button>

        {/* Search Input */}
        <div ref={searchRef} className="relative flex-1">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => query.trim() && setShowSearchDropdown(true)}
              placeholder="Search customers or invoice #..."
              className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-xs sm:text-sm rounded-lg pl-9 pr-3 py-1.5 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0f766e] focus:border-transparent transition-all"
            />
            {isSearching && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">...</span>
            )}
          </div>

          {/* Search Results Dropdown */}
          {showSearchDropdown && searchResults && (
            <div className="absolute left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden max-h-80 overflow-y-auto">
              {searchResults.customers?.length === 0 && searchResults.invoices?.length === 0 ? (
                <div className="p-4 text-center text-xs text-slate-400">
                  No matching customers or invoices found.
                </div>
              ) : (
                <div className="p-2 space-y-2">
                  {searchResults.customers?.length > 0 && (
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-2 py-1">Customers</p>
                      {searchResults.customers.map((c) => (
                        <button
                          key={c.id}
                          onClick={() => {
                            setShowSearchDropdown(false);
                            setQuery('');
                            onSelectCustomer(c.id);
                          }}
                          className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-50 flex items-center justify-between text-xs"
                        >
                          <div>
                            <p className="font-semibold text-slate-800">{c.name}</p>
                            <p className="text-slate-400 text-[11px]">{c.phone}</p>
                          </div>
                          <ArrowRight size={14} className="text-slate-300" />
                        </button>
                      ))}
                    </div>
                  )}

                  {searchResults.invoices?.length > 0 && (
                    <div className="border-t border-slate-100 pt-2">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-2 py-1">Invoices</p>
                      {searchResults.invoices.map((inv) => (
                        <button
                          key={inv.id}
                          onClick={() => {
                            setShowSearchDropdown(false);
                            setQuery('');
                            onSelectInvoice(inv.id);
                          }}
                          className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-50 flex items-center justify-between text-xs"
                        >
                          <div>
                            <p className="font-semibold text-slate-800 font-mono">{inv.number}</p>
                            <p className="text-slate-500 text-[11px]">{fmtMoney(inv.total)} • <span className="capitalize">{inv.status}</span></p>
                          </div>
                          <ArrowRight size={14} className="text-slate-300" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Right Controls: Business Switcher, Clock, Lang, Notifs, Profile */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        {/* Business Switcher Dropdown */}
        <div className="relative">
          <select
            value={currentBizId}
            onChange={(e) => onBizChange(Number(e.target.value))}
            className="appearance-none bg-slate-50 border border-slate-200 text-slate-800 font-semibold text-xs sm:text-sm rounded-lg pl-3 pr-8 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#0f766e] cursor-pointer hover:bg-slate-100 transition-colors shadow-2xs"
          >
            {businesses.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
          <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400" />
        </div>

        {/* Demo Clock fast-forward controls */}
        <div className="hidden lg:flex items-center bg-slate-50 border border-slate-200 rounded-lg p-0.5 shadow-2xs">
          <div className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono font-medium text-slate-700">
            <Calendar size={13} className="text-teal-600" />
            <span>{fmtDate(demoDate)}</span>
          </div>
          <button
            onClick={() => handleAdvance(1)}
            disabled={isAdvancing}
            title="Fast forward demo date by 1 day"
            className="px-2 py-1 text-xs font-bold bg-white text-slate-700 hover:bg-teal-50 hover:text-teal-700 border-l border-slate-200 rounded-l-none rounded-r-none transition-colors disabled:opacity-50"
          >
            +1d
          </button>
          <button
            onClick={() => handleAdvance(7)}
            disabled={isAdvancing}
            title="Fast forward demo date by 7 days"
            className="px-2.5 py-1 text-xs font-bold bg-[#0f766e] text-white hover:bg-[#115e59] rounded-r-md transition-colors disabled:opacity-50"
          >
            +7d
          </button>
        </div>

        {/* Language Toggle (EN / HI / KN visual only) */}
        <div className="hidden sm:flex border border-slate-200 rounded-lg overflow-hidden text-xs font-bold shadow-2xs">
          {['EN', 'HI', 'KN'].map((l) => (
            <button
              key={l}
              onClick={() => onLangChange(l)}
              className={`px-2 py-1 transition-colors ${
                lang === l ? 'bg-[#0f766e] text-white' : 'bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              {l}
            </button>
          ))}
        </div>

        {/* Notifications Bell */}
        <div ref={notifRef} className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative p-2 text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition-colors"
            aria-label="View notifications"
          >
            <Bell size={18} />
            {brokenPromises.length > 0 && (
              <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-rose-500 rounded-full ring-2 ring-white animate-pulse" />
            )}
          </button>

          {/* Notifications Dropdown */}
          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 bg-white border border-slate-200 rounded-xl shadow-xl z-50 p-3 overflow-hidden">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-2">
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wide">Notifications</span>
                <span className="text-[11px] font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full">
                  {brokenPromises.length} Broken Promises
                </span>
              </div>
              {brokenPromises.length === 0 ? (
                <div className="py-6 text-center text-xs text-slate-400 flex flex-col items-center gap-1">
                  <CheckCircle2 size={24} className="text-emerald-500" />
                  <p className="font-medium text-slate-600">All promises on track!</p>
                  <p className="text-[11px]">No broken promises recorded.</p>
                </div>
              ) : (
                <div className="space-y-1.5 max-h-64 overflow-y-auto">
                  {brokenPromises.map((p) => (
                    <div
                      key={p.id}
                      onClick={() => {
                        setShowNotifications(false);
                        onNavigate('promises');
                      }}
                      className="p-2 rounded-lg bg-rose-50/60 border border-rose-100 text-xs hover:bg-rose-100/60 cursor-pointer transition-colors"
                    >
                      <div className="flex items-center justify-between font-semibold text-rose-900">
                        <span>{p.customer_name || 'Customer'}</span>
                        <span>{fmtMoney(p.promised_amount)}</span>
                      </div>
                      <p className="text-[11px] text-rose-700 mt-0.5">
                        Promised date {fmtDate(p.promised_date)} passed without payment.
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Environment Badge */}
        <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
          Demo
        </span>

        {/* Profile Avatar / Menu */}
        <div ref={profileRef} className="relative">
          <button
            onClick={() => setShowProfileMenu(!showProfileMenu)}
            className="flex items-center gap-1.5 p-1 text-slate-700 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <div className="w-7 h-7 rounded-full bg-[#0f766e] text-white flex items-center justify-center font-bold text-xs uppercase shadow-xs">
              {(currentBiz?.owner_name || 'U')[0]}
            </div>
          </button>

          {showProfileMenu && (
            <div className="absolute right-0 mt-2 w-52 bg-white border border-slate-200 rounded-xl shadow-xl z-50 p-2 text-xs">
              <div className="px-3 py-2 border-b border-slate-100">
                <p className="font-bold text-slate-800">{currentBiz?.owner_name || 'Owner'}</p>
                <p className="text-[11px] text-slate-400">{currentBiz?.phone || 'Phone'}</p>
              </div>
              <div className="py-1">
                <button
                  onClick={() => {
                    setShowProfileMenu(false);
                    onNavigate('settings');
                  }}
                  className="w-full text-left px-3 py-1.5 rounded-md hover:bg-slate-50 font-medium text-slate-700"
                >
                  Settings & Rules
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
