import React, { useState, useEffect, useCallback } from 'react';
import Sidebar from './components/Sidebar';
import TopBar from './components/TopBar';
import CustomerDetailModal from './components/CustomerDetailModal';
import InvoiceDetailModal from './components/InvoiceDetailModal';

import DashboardPage from './pages/DashboardPage';
import VoiceAgentPage from './pages/VoiceAgentPage';
import QueuePage from './pages/QueuePage';
import CustomersPage from './pages/CustomersPage';
import InvoicesPage from './pages/InvoicesPage';
import PromisesPage from './pages/PromisesPage';
import ReplyLabPage from './pages/ReplyLabPage';
import DispatchPage from './pages/DispatchPage';
import ActionLogPage from './pages/ActionLogPage';
import AnalyticsPage from './pages/AnalyticsPage';
import SettingsPage from './pages/SettingsPage';

import {
  getBusinesses,
  getDashboard,
  getQueue,
  getDemoDate,
  getEvents,
  getPromises,
  setBusinessId,
  getBusinessId,
  getHealth,
  advanceDemoDate,
} from './api';
import { useLanguage } from './context/LanguageContext';

import { AlertTriangle, WifiOff, RefreshCw } from 'lucide-react';

export default function App() {
  const { lang, setLang, t } = useLanguage();
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [businesses, setBusinesses] = useState([]);
  const [currentBizId, setCurrentBizId] = useState(getBusinessId);
  const [dashboard, setDashboard] = useState(() => {
    try {
      const s = localStorage.getItem('vaada_cached_dash');
      if (s) return JSON.parse(s);
    } catch (e) {}
    return null;
  });
  const [queue, setQueue] = useState(() => {
    try {
      const s = localStorage.getItem('vaada_cached_queue');
      if (s) return JSON.parse(s);
    } catch (e) {}
    return [];
  });
  const [events, setEvents] = useState(() => {
    try {
      const s = localStorage.getItem('vaada_cached_events');
      if (s) return JSON.parse(s);
    } catch (e) {}
    return [];
  });
  const [demoDate, setDemoDate] = useState(() => localStorage.getItem('vaada_cached_demo_date') || '');
  const [brokenPromises, setBrokenPromises] = useState([]);

  // Modals
  const [selectedCustomerId, setSelectedCustomerId] = useState(null);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState(null);

  // Layout & UI
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isBackendOffline, setIsBackendOffline] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // 1. Initial Load: Businesses
  useEffect(() => {
    getBusinesses()
      .then((res) => {
        const list = res.data || [];
        setBusinesses(list);
        if (list.length > 0) {
          const firstId = list[0].id;
          setCurrentBizId(firstId);
          setBusinessId(firstId);
        }
      })
      .catch((err) => {
        console.error('Failed to load businesses', err);
        setIsBackendOffline(true);
      });
  }, []);

  // 2. Refresh Core Data (Dashboard, Queue, Events, Demo Date, Promises)
  const refreshCore = useCallback(async () => {
    setErrorMsg('');
    try {
      const [dashRes, qRes, ddRes, evRes, promRes] = await Promise.all([
        getDashboard(),
        getQueue(),
        getDemoDate(),
        getEvents(),
        getPromises({ status: 'broken' }),
      ]);

      setDashboard(dashRes.data);
      setQueue(qRes.data || []);
      setDemoDate(ddRes.data?.date || '');
      setEvents(evRes.data || []);
      setBrokenPromises(promRes.data?.items || []);
      setIsBackendOffline(false);
      try {
        localStorage.setItem('vaada_cached_dash', JSON.stringify(dashRes.data));
        localStorage.setItem('vaada_cached_queue', JSON.stringify(qRes.data || []));
        localStorage.setItem('vaada_cached_events', JSON.stringify(evRes.data || []));
        localStorage.setItem('vaada_cached_demo_date', ddRes.data?.date || '');
      } catch (e) {}
    } catch (err) {
      console.error('Core refresh failed', err);
      setIsBackendOffline(true);
      setErrorMsg('Backend offline: Could not connect to FastAPI server at http://localhost:8000.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Refresh whenever business changes
  useEffect(() => {
    if (currentBizId) {
      setLoading(true);
      refreshCore();
    }
  }, [currentBizId, refreshCore]);

  // Handle Business Switch
  const handleBizChange = (newId) => {
    const id = Number(newId);
    setCurrentBizId(id);
    setBusinessId(id);
    // Reset any open modal
    setSelectedCustomerId(null);
    setSelectedInvoiceId(null);
  };

  // Handle Clock Advance
  const handleAdvanceDays = async (days) => {
    try {
      await advanceDemoDate(days);
      await refreshCore();
    } catch (err) {
      console.error('Advance days failed', err);
    }
  };

  const currentBusiness = businesses.find((b) => b.id === currentBizId) || businesses[0];

  return (
    <div className="flex h-screen bg-[#f8fafc] text-slate-800 font-sans overflow-hidden">
      {/* Left Sidebar */}
      <Sidebar
        currentPage={currentPage}
        onNavigate={(p) => setCurrentPage(p)}
        business={currentBusiness}
        isOpenMobile={mobileSidebarOpen}
        onCloseMobile={() => setMobileSidebarOpen(false)}
        brokenPromisesCount={brokenPromises.length}
      />

      {/* Main Viewport */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* Top Bar */}
        <TopBar
          businesses={businesses}
          currentBizId={currentBizId}
          onBizChange={handleBizChange}
          demoDate={demoDate}
          onDateChange={(d) => {
            setDemoDate(d);
            refreshCore();
          }}
          onOpenMobileSidebar={() => setMobileSidebarOpen(true)}
          lang={lang}
          onLangChange={setLang}
          brokenPromises={brokenPromises}
          onNavigate={(p) => setCurrentPage(p)}
          onSelectCustomer={(cId) => setSelectedCustomerId(cId)}
          onSelectInvoice={(invId) => setSelectedInvoiceId(invId)}
        />

        {/* Backend Offline Banner */}
        {isBackendOffline && (
          <div className="bg-rose-600 text-white px-4 py-2.5 text-xs font-bold flex items-center justify-between shadow-md z-20">
            <div className="flex items-center gap-2">
              <WifiOff size={16} />
              <span>
                Backend Offline: Unable to reach FastAPI backend on http://localhost:8000. Please start the backend service.
              </span>
            </div>
            <button
              onClick={refreshCore}
              className="px-2.5 py-1 bg-white/20 hover:bg-white/30 rounded-lg text-white font-semibold transition-colors flex items-center gap-1"
            >
              <RefreshCw size={12} />
              Retry Connection
            </button>
          </div>
        )}

        {/* Page Content Container */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {loading && !dashboard ? (
            <div className="flex flex-col items-center justify-center h-80 text-slate-400 text-xs">
              <div className="w-9 h-9 border-3 border-teal-200 border-t-teal-700 rounded-full animate-spin mb-3" />
              <p className="font-semibold text-slate-600">Connecting to Vaada engine...</p>
            </div>
          ) : (
            <>
              {currentPage === 'dashboard' && (
                <DashboardPage
                  dashboard={dashboard}
                  queue={queue}
                  events={events}
                  onNavigate={setCurrentPage}
                  onSelectCustomer={(id) => setSelectedCustomerId(id)}
                  onAdvanceDays={handleAdvanceDays}
                  onRefreshAll={refreshCore}
                />
              )}

              {currentPage === 'voice-agent' && (
                <VoiceAgentPage
                  onRefreshAll={refreshCore}
                  onNavigate={setCurrentPage}
                />
              )}

              {currentPage === 'queue' && (
                <QueuePage
                  queue={queue}
                  onSelectCustomer={(id) => setSelectedCustomerId(id)}
                />
              )}

              {currentPage === 'customers' && (
                <CustomersPage
                  currentBizId={currentBizId}
                  onSelectCustomer={(id) => setSelectedCustomerId(id)}
                />
              )}

              {currentPage === 'invoices' && (
                <InvoicesPage
                  currentBizId={currentBizId}
                  onSelectInvoice={(id) => setSelectedInvoiceId(id)}
                />
              )}

              {currentPage === 'promises' && (
                <PromisesPage
                  currentBizId={currentBizId}
                  onSelectCustomer={(id) => setSelectedCustomerId(id)}
                  onSelectInvoice={(id) => setSelectedInvoiceId(id)}
                />
              )}

              {currentPage === 'reply-lab' && (
                <ReplyLabPage
                  queue={queue}
                  onRefreshAll={refreshCore}
                />
              )}

              {currentPage === 'dispatch' && (
                <DispatchPage
                  queue={queue}
                  onRefreshAll={refreshCore}
                />
              )}

              {currentPage === 'events' && (
                <ActionLogPage />
              )}

              {currentPage === 'analytics' && (
                <AnalyticsPage />
              )}

              {currentPage === 'settings' && (
                <SettingsPage
                  onRefreshAll={refreshCore}
                />
              )}
            </>
          )}
        </main>
      </div>

      {/* Customer Detail Drawer/Modal */}
      {selectedCustomerId && (
        <CustomerDetailModal
          customerId={selectedCustomerId}
          onClose={() => setSelectedCustomerId(null)}
          onSelectInvoice={(invId) => {
            setSelectedCustomerId(null);
            setSelectedInvoiceId(invId);
          }}
        />
      )}

      {/* Invoice Detail Drawer/Modal */}
      {selectedInvoiceId && (
        <InvoiceDetailModal
          invoiceId={selectedInvoiceId}
          onClose={() => setSelectedInvoiceId(null)}
          onSelectCustomer={(cId) => {
            setSelectedInvoiceId(null);
            setSelectedCustomerId(cId);
          }}
        />
      )}
    </div>
  );
}
