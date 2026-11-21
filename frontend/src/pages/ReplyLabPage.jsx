import React, { useState, useEffect } from 'react';
import { 
  MessageSquareText, 
  Mic, 
  Lock, 
  CheckCircle2, 
  CreditCard, 
  Send,
  Building,
  User,
  AlertCircle
} from 'lucide-react';
import { simulatePaid } from '../api';
import { fmtMoney, fmtDate, PriorityBadge, StatusBadge, ToneDot } from '../components/Badges';

export default function ReplyLabPage({
  queue = [],
  selectedCustomer,
  onSelectCustomer,
  onRefreshAll,
}) {
  const [selectedItem, setSelectedItem] = useState(null);
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Keep selected item in sync
  useEffect(() => {
    if (queue.length === 0) return;
    if (selectedCustomer) {
      const found = queue.find(
        (c) => (c.customer_id || c.id) === (selectedCustomer.id || selectedCustomer)
      );
      if (found) {
        setSelectedItem(found);
        setAmount(String(found.remaining || ''));
        return;
      }
    }
    // Default to first customer in queue
    if (!selectedItem && queue.length > 0) {
      setSelectedItem(queue[0]);
      setAmount(String(queue[0].remaining || ''));
    }
  }, [queue, selectedCustomer]);

  const handleSimulate = async () => {
    if (!selectedItem) return;
    const invId = selectedItem.invoices?.[0]?.id || selectedItem.invoice_id;
    if (!invId) {
      setErrorMsg('No open invoice found for this customer.');
      return;
    }
    const numAmount = parseFloat(amount);
    if (!numAmount || numAmount <= 0) {
      setErrorMsg('Please enter a positive payment amount.');
      return;
    }

    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const res = await simulatePaid(invId, numAmount);
      setSuccessMsg(`Success! Payment of ${fmtMoney(numAmount)} recorded in single DB transaction.`);
      if (onRefreshAll) onRefreshAll();
    } catch (err) {
      console.error('Simulate payment failed', err);
      setErrorMsg('Failed to simulate payment.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Top Header */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <h2 className="text-xl font-black text-slate-800 tracking-tight">Reply Lab</h2>
        <p className="text-xs text-slate-500 mt-1 font-medium">
          Simulate incoming payments and customer response analysis in an isolated environment.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left Column: Customer Picker from Queue */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Select Customer to Test
          </span>

          <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
            {queue.map((item) => {
              const itemId = item.customer_id || item.id;
              const isSelected = (selectedItem?.customer_id || selectedItem?.id) === itemId;
              return (
                <div
                  key={itemId}
                  onClick={() => {
                    setSelectedItem(item);
                    setAmount(String(item.remaining || ''));
                    setSuccessMsg('');
                    setErrorMsg('');
                  }}
                  className={`p-3 rounded-xl border text-xs cursor-pointer transition-all ${
                    isSelected
                      ? 'border-teal-500 bg-teal-50/70 shadow-xs'
                      : 'border-slate-100 bg-slate-50/50 hover:bg-slate-100'
                  }`}
                >
                  <div className="flex items-center justify-between font-bold text-slate-800">
                    <span>{item.name}</span>
                    <span className="text-teal-800 font-mono">{fmtMoney(item.remaining)}</span>
                  </div>
                  <div className="flex items-center justify-between mt-1 text-[11px] text-slate-500">
                    <span>Score: {item.score}</span>
                    <PriorityBadge priority={item.label} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right 2 Columns: Customer Context & Simulate Paid */}
        <div className="lg:col-span-2 space-y-5">
          {selectedItem ? (
            <>
              {/* Selected Customer Header Banner */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">{selectedItem.name}</h3>
                    <p className="text-xs text-slate-500 mt-0.5">Phone: {selectedItem.phone}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-teal-800 bg-teal-100 px-2 py-0.5 rounded">
                      Score: {selectedItem.score}
                    </span>
                    <PriorityBadge priority={selectedItem.label} />
                    <ToneDot tone={selectedItem.tone} />
                  </div>
                </div>

                <p className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-100 italic">
                  {selectedItem.why_line}
                </p>

                {/* Open Invoice Info */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-100 text-xs">
                  <div>
                    <span className="text-slate-400">Invoice #</span>
                    <p className="font-bold text-slate-800 font-mono mt-0.5">
                      {selectedItem.invoices?.[0]?.number || selectedItem.invoice_number || 'SCH-001'}
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-400">Total</span>
                    <p className="font-bold text-slate-800 mt-0.5">
                      {fmtMoney(selectedItem.invoices?.[0]?.total || selectedItem.total || selectedItem.remaining)}
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-400">Already Paid</span>
                    <p className="font-bold text-emerald-700 mt-0.5">
                      {fmtMoney(selectedItem.invoices?.[0]?.amount_paid || selectedItem.amount_paid || 0)}
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-400">Remaining</span>
                    <p className="font-black text-rose-600 text-sm mt-0.5">
                      {fmtMoney(selectedItem.remaining)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Working Payment Simulator Card */}
              <div className="bg-emerald-50/70 border border-emerald-200 p-5 rounded-2xl shadow-xs space-y-4">
                <div className="flex items-center gap-2 text-emerald-950">
                  <CreditCard size={18} className="text-emerald-700" />
                  <h4 className="font-bold text-sm">Simulate Payment (One-Click Transaction)</h4>
                </div>
                <p className="text-xs text-emerald-800">
                  Instantly records payment in the database, updates invoice status, clears active promises, and creates an Action Log entry without third-party gateways.
                </p>

                {successMsg && (
                  <div className="p-3 bg-emerald-100 border border-emerald-300 text-emerald-900 rounded-xl text-xs font-semibold flex items-center gap-2">
                    <CheckCircle2 size={16} className="text-emerald-700" />
                    {successMsg}
                  </div>
                )}

                {errorMsg && (
                  <div className="p-3 bg-rose-100 border border-rose-300 text-rose-900 rounded-xl text-xs font-semibold flex items-center gap-2">
                    <AlertCircle size={16} className="text-rose-700" />
                    {errorMsg}
                  </div>
                )}

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-slate-400">₹</span>
                    <input
                      type="number"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="Amount to pay"
                      className="w-full pl-8 pr-3 py-2 bg-white border border-emerald-300 rounded-xl text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-xs"
                    />
                  </div>
                  <button
                    onClick={handleSimulate}
                    disabled={loading || !amount}
                    className="px-5 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs rounded-xl transition-colors shadow-xs disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <CheckCircle2 size={16} />
                    )}
                    Simulate Paid
                  </button>
                </div>
              </div>

              {/* AI Features Placeholder (Disabled as per spec) */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-xs uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                    <Lock size={13} className="text-slate-400" />
                    Customer Reply Lab
                  </h4>
                  <span className="text-[10px] font-bold text-purple-700 bg-purple-50 border border-purple-200 px-2 py-0.5 rounded-full">
                    AI Coming Soon
                  </span>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">
                      Customer reply text (AI Coming soon)
                    </label>
                    <textarea
                      disabled
                      rows={3}
                      placeholder="e.g. 'I will transfer ₹3,000 this Friday through UPI.' (AI parsing disabled in demo)"
                      className="w-full p-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-400 text-xs resize-none cursor-not-allowed"
                    />
                  </div>

                  <button
                    disabled
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-400 text-xs font-semibold cursor-not-allowed"
                  >
                    <Mic size={14} />
                    Record voice note (Coming soon)
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="bg-white p-16 rounded-2xl border border-slate-200 text-center text-slate-400">
              <User size={32} className="mx-auto mb-2 text-slate-300" />
              <p className="font-bold text-slate-700">Select a customer from the left to test</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
