import React, { useState } from 'react';
import { 
  Send, 
  MessageSquare, 
  Mail, 
  Smartphone, 
  Link2, 
  ShieldAlert, 
  Copy, 
  Check, 
  ExternalLink, 
  QrCode, 
  CheckCircle2, 
  Loader2,
  DollarSign
} from 'lucide-react';
import { fmtMoney, ToneDot, PriorityBadge } from '../components/Badges';
import { createPaymentLink, simulatePaid } from '../api';

export default function DispatchPage({ queue = [], onRefreshAll }) {
  const [selectedCustomerId, setSelectedCustomerId] = useState(queue[0]?.customer_id || queue[0]?.id || null);
  const [channel, setChannel] = useState('whatsapp');
  const [copied, setCopied] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  // Cashfree payment link states per customer
  const [linkDataByCustomer, setLinkDataByCustomer] = useState({});
  const [creatingLink, setCreatingLink] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  const selected = queue.find((c) => (c.customer_id || c.id) === selectedCustomerId) || queue[0];
  const activeLinkData = selected ? linkDataByCustomer[selected.customer_id || selected.id] : null;

  const buildTemplateMessage = (c, ch, linkUrl) => {
    if (!c) return '';
    const name = c.name || 'Customer';
    const amount = fmtMoney(c.remaining);
    const tone = c.tone || 'Friendly';
    const overdue = c.days_overdue || 0;
    const linkSuffix = linkUrl ? `\n\nPay securely here: ${linkUrl}` : '';

    if (tone === 'Final') {
      if (ch === 'whatsapp' || ch === 'sms') {
        return `URGENT: Dear ${name}, your balance of ${amount} is critically overdue (${overdue} days). Multiple payment promises were defaulted. Please settle immediately via the official link below to avoid formal escalation.${linkSuffix}`;
      }
      return `Dear ${name},\n\nThis is a final notice regarding your overdue account. An outstanding balance of ${amount} remains unpaid despite multiple reminders and missed promise deadlines.\n\nPlease clear this balance today.${linkSuffix}\n\nRegards,\nSunil Cloth House Collections`;
    }

    if (tone === 'Firm') {
      if (ch === 'whatsapp' || ch === 'sms') {
        return `Hello ${name}, reminder from Sunil Cloth House: your pending invoice of ${amount} is ${overdue} days overdue. Please process payment today or confirm your updated payment timeline.${linkSuffix}`;
      }
      return `Dear ${name},\n\nWe are following up on your pending balance of ${amount}, which is now ${overdue} days overdue.\n\nPlease arrange for the transfer at your earliest convenience or let us know if you need assistance.${linkSuffix}\n\nThank you,\nSunil Cloth House`;
    }

    // Friendly tone
    if (ch === 'whatsapp' || ch === 'sms') {
      return `Namaste ${name}! Gentle reminder from Sunil Cloth House regarding your balance of ${amount}. You can view invoice details or pay securely whenever convenient. Thank you!${linkSuffix}`;
    }
    return `Namaste ${name},\n\nHope you are doing well. This is a friendly reminder regarding your invoice balance of ${amount}.${linkSuffix}\n\nThank you for your valued business!\nSunil Cloth House`;
  };

  const currentMessage = buildTemplateMessage(selected, channel, activeLinkData?.link_url);

  const handleCopyMessage = () => {
    navigator.clipboard.writeText(currentMessage);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyLink = (url) => {
    navigator.clipboard.writeText(url);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  };

  const handleCreateLink = async () => {
    if (!selected) return;
    setCreatingLink(true);
    setErrorMsg('');
    try {
      const invId = selected.invoice_id || selected.invoices?.[0]?.id;
      if (!invId) {
        throw new Error('No invoice found for this customer');
      }
      const res = await createPaymentLink(invId, selected.remaining, null);
      const cId = selected.customer_id || selected.id;
      setLinkDataByCustomer(prev => ({
        ...prev,
        [cId]: res.data
      }));
    } catch (err) {
      console.error('Failed to create payment link', err);
      setErrorMsg(err.response?.data?.detail || err.message || 'Failed to create link');
    } finally {
      setCreatingLink(false);
    }
  };

  const handleSimulatePaid = async () => {
    if (!selected) return;
    setSimulating(true);
    setErrorMsg('');
    try {
      const invId = selected.invoice_id || selected.invoices?.[0]?.id;
      const amountToPay = activeLinkData?.amount || selected.remaining;
      const res = await simulatePaid(invId, amountToPay);
      setPaymentSuccess(`Successfully recorded payment of ₹${amountToPay}! Invoice status: ${res.data.status}`);
      if (onRefreshAll) {
        await onRefreshAll();
      }
      setTimeout(() => setPaymentSuccess(null), 5000);
    } catch (err) {
      console.error('Simulate paid failed', err);
      setErrorMsg(err.response?.data?.detail || err.message || 'Payment simulation failed');
    } finally {
      setSimulating(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Top Header */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-800 tracking-tight">Dispatch Center</h2>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            Cashfree Sandbox Payment Links & Tone-Calibrated Message Previews.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs bg-teal-50 border border-teal-200 text-teal-800 px-3 py-1 rounded-full font-bold">
            Cashfree API v2023-08-01 (Sandbox)
          </span>
        </div>
      </div>

      {/* Preview Notice Banner */}
      <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl flex items-start gap-3 text-xs text-amber-900 font-medium">
        <ShieldAlert size={18} className="text-amber-600 shrink-0 mt-0.5" />
        <div>
          <p className="font-bold">WhatsApp, SMS and Email are PREVIEW only</p>
          <p className="text-amber-800 mt-0.5">
            No real messages are transmitted to customers. Nothing is sent without the owner explicitly approving. All payment links are generated on the Cashfree Sandbox environment.
          </p>
        </div>
      </div>

      {paymentSuccess && (
        <div className="bg-emerald-50 border border-emerald-300 p-4 rounded-2xl flex items-center gap-3 text-xs text-emerald-900 font-bold animate-fadeIn">
          <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
          <span>{paymentSuccess}</span>
        </div>
      )}

      {errorMsg && (
        <div className="bg-rose-50 border border-rose-300 p-4 rounded-2xl text-xs text-rose-800 font-bold">
          {errorMsg}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Customer Selector */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Select Customer
          </span>

          <div className="space-y-2 max-h-[520px] overflow-y-auto pr-1">
            {queue.map((c) => {
              const cId = c.customer_id || c.id;
              const isSelected = selectedCustomerId === cId;
              const hasLink = !!linkDataByCustomer[cId];
              return (
                <div
                  key={cId}
                  onClick={() => setSelectedCustomerId(cId)}
                  className={`p-3 rounded-xl border text-xs cursor-pointer transition-all ${
                    isSelected
                      ? 'border-teal-500 bg-teal-50/70 shadow-xs'
                      : 'border-slate-100 bg-slate-50/50 hover:bg-slate-100'
                  }`}
                >
                  <div className="flex items-center justify-between font-bold text-slate-800">
                    <span className="truncate">{c.name}</span>
                    <span className="text-teal-800 font-mono ml-2 shrink-0">{fmtMoney(c.remaining)}</span>
                  </div>
                  <div className="flex items-center justify-between mt-1 text-[11px] text-slate-500">
                    <ToneDot tone={c.tone} />
                    <div className="flex items-center gap-1.5">
                      {hasLink && (
                        <span className="text-[10px] bg-teal-100 text-teal-800 font-bold px-1.5 py-0.5 rounded">
                          Link Ready
                        </span>
                      )}
                      <PriorityBadge priority={c.label} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Dispatch Controls & Preview Box */}
        <div className="lg:col-span-2 space-y-4">
          {/* Customer Snapshot */}
          {selected && (
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-teal-100 text-teal-800 font-black flex items-center justify-center text-sm">
                  {selected.name?.[0] || 'C'}
                </div>
                <div>
                  <p className="font-bold text-slate-900">{selected.name}</p>
                  <p className="text-slate-400 font-mono text-[11px]">{selected.phone}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <ToneDot tone={selected.tone} />
                <span className="font-black text-rose-600 text-sm">{fmtMoney(selected.remaining)} due</span>
              </div>
            </div>
          )}

          {/* Cashfree Payment Link Action Bar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <Link2 size={15} className="text-teal-700" />
                Cashfree Payment Link
              </span>
              {activeLinkData && (
                <span className="text-[11px] font-mono text-slate-400">
                  ID: {activeLinkData.cashfree_link_id}
                </span>
              )}
            </div>

            {!activeLinkData ? (
              <div className="flex items-center justify-between p-3 bg-slate-50 border border-dashed border-slate-300 rounded-xl">
                <p className="text-xs text-slate-500">
                  No payment link active yet for this invoice amount ({fmtMoney(selected?.remaining)}).
                </p>
                <button
                  onClick={handleCreateLink}
                  disabled={creatingLink}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold transition-all shadow-xs disabled:opacity-50"
                >
                  {creatingLink ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      Creating Link...
                    </>
                  ) : (
                    <>
                      <Link2 size={14} />
                      Create Payment Link
                    </>
                  )}
                </button>
              </div>
            ) : (
              <div className="space-y-3 bg-teal-50/50 border border-teal-200 rounded-xl p-3.5">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={activeLinkData.link_url || ''}
                    className="flex-1 bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-mono text-slate-700 outline-none select-all"
                  />
                  <button
                    onClick={() => handleCopyLink(activeLinkData.link_url)}
                    className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg text-xs font-semibold text-slate-700 transition-colors flex items-center gap-1"
                  >
                    {linkCopied ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
                    {linkCopied ? 'Copied' : 'Copy'}
                  </button>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-teal-100">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => window.open(activeLinkData.link_url, '_blank')}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold transition-colors shadow-2xs"
                    >
                      <ExternalLink size={13} />
                      Open Link
                    </button>
                    {activeLinkData.qr_code && (
                      <span className="inline-flex items-center gap-1 text-[11px] text-teal-800 bg-teal-100 px-2.5 py-1 rounded-lg font-semibold">
                        <QrCode size={13} />
                        QR Available
                      </span>
                    )}
                  </div>

                  <button
                    onClick={handleSimulatePaid}
                    disabled={simulating}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-2xs disabled:opacity-50"
                  >
                    {simulating ? (
                      <>
                        <Loader2 size={13} className="animate-spin" />
                        Simulating...
                      </>
                    ) : (
                      <>
                        <DollarSign size={13} />
                        Simulate Paid
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Channel Tabs */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex border-b border-slate-200 gap-2">
              {[
                { id: 'whatsapp', label: 'WhatsApp (Preview)', icon: Smartphone },
                { id: 'sms', label: 'SMS (Preview)', icon: MessageSquare },
                { id: 'email', label: 'Email (Preview)', icon: Mail },
              ].map((tab) => {
                const Icon = tab.icon;
                const active = channel === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setChannel(tab.id)}
                    className={`pb-2 px-3 text-xs font-bold border-b-2 flex items-center gap-1.5 transition-colors ${
                      active
                        ? 'border-teal-700 text-teal-900'
                        : 'border-transparent text-slate-400 hover:text-slate-600'
                    }`}
                  >
                    <Icon size={14} />
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {/* Message Preview Screen */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3 font-sans">
              <div className="flex items-center justify-between text-[11px] text-slate-400 border-b border-slate-200 pb-2">
                <span className="capitalize">{channel} Reminder Message</span>
                <span>Calibrated Tone: <strong>{selected?.tone || 'Friendly'}</strong></span>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-4 text-xs text-slate-800 whitespace-pre-line leading-relaxed shadow-xs min-h-[90px]">
                {currentMessage}
              </div>

              <div className="flex items-center justify-between pt-1">
                <button
                  onClick={handleCopyMessage}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-white text-xs font-semibold transition-colors"
                >
                  {copied ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
                  {copied ? 'Copied to clipboard' : 'Copy Preview'}
                </button>

                <span className="text-[11px] text-slate-400 italic">
                  Preview mode — nothing is sent
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
