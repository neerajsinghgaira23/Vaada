import React, { createContext, useContext, useState } from 'react';

export const translations = {
  EN: {
    // Navigation
    'nav.dashboard': 'Dashboard',
    'nav.voice-agent': 'Vaada AI',
    'nav.queue': 'Chase Queue',
    'nav.customers': 'Customers',
    'nav.invoices': 'Invoices',
    'nav.promises': 'Promises',
    'nav.reply-lab': 'Reply Lab',
    'nav.dispatch': 'Dispatch',
    'nav.events': 'Action Log',
    'nav.analytics': 'Analytics',
    'nav.settings': 'Settings',

    // Brand
    'brand.tagline': '“Others chase invoices. We remember promises.”',
    'brand.demo': 'Demo data',

    // TopBar
    'topbar.searchPlaceholder': 'Search customers or invoice #...',
    'topbar.advance1d': '+1d',
    'topbar.advance7d': '+7d',
    'topbar.notifications': 'Notifications',
    'topbar.brokenAlert': 'Broken Promises Detected',
    'topbar.noAlerts': 'No critical alerts at this time',
    'topbar.viewAll': 'View All Broken Promises',

    // Dashboard
    'dashboard.title': 'Merchant Financial Dashboard',
    'dashboard.subtitle': 'Live cashflow tracking, promise health, and smart collections.',
    'dashboard.totalOutstanding': 'Total Outstanding',
    'dashboard.totalOutstandingSub': 'Across all open invoices',
    'dashboard.overdueInvoices': 'Overdue Invoices',
    'dashboard.overdueSub': 'Needs immediate follow-up',
    'dashboard.collected': 'Collected',
    'dashboard.collectedSub': 'Total payments received',
    'dashboard.promisedThisWeek': 'Promised This Week',
    'dashboard.dueNext7': 'Due in the next 7 days',
    'dashboard.riskyAlert': 'from risky customers',
    'dashboard.agentTitle': 'Vaada AI',
    'dashboard.agentDesc': 'Natural Hindi, Kannada, and English voice assistant: instant recovery advice, customer balances, and 1-tap Cashfree payment link generation.',
    'dashboard.openAgent': 'Open Vaada AI →',
    'dashboard.topCustomers': 'Outstanding vs Paid by Customer',
    'dashboard.top5': 'Top 5 Customers',
    'dashboard.promiseHealth': 'Promise Health',
    'dashboard.kept': 'Kept',
    'dashboard.broken': 'Broken',
    'dashboard.open': 'Open',
    'dashboard.chaseQueueTitle': 'High Priority Chase Queue',
    'dashboard.viewQueue': 'View Full Queue',
    'dashboard.recentActivity': 'Recent Activity Log',
    'dashboard.viewAllLogs': 'View All Logs',

    // Voice Agent
    'agent.headerTitle': 'Vaada AI (Sarvam AI & Cashfree)',
    'agent.headerSubtitle': 'Ask AI anything in your own words — advice, balance, shop stats & automatic Cashfree payment link creation',
    'agent.liveBadge': 'Demo Merchant Flows Active',
    'agent.inputPlaceholder': 'As a merchant, ask AI to perform any action...',
    'agent.tapToSpeak': 'Tap to Speak',
    'agent.listening': 'Listening... speak whatever you want in your language...',
    'agent.resetDemo': 'Reset Demo',
    'agent.createLink': 'Create Payment Link',
    'agent.recoveryAdvice': 'Recovery Advice',
    'agent.shopSummary': 'Shop Financial Summary',
    'agent.draftReminder': 'Draft Firm Reminder',

    // Common
    'common.retry': 'Retry',
    'common.loading': 'Loading...',
    'common.save': 'Save',
    'common.cancel': 'Cancel',
    'common.confirm': 'Confirm',
    'common.back': 'Back',
    'common.paid': 'Paid',
    'common.unpaid': 'Unpaid',
    'common.partial': 'Partial',
    'common.followUp': 'Follow Up',
    'common.quickWin': 'Quick Win',
    'common.simulatePaid': 'Simulate Paid (Update KPIs)',
    'common.openLink': 'Open Link',
    'common.copyLink': 'Copy Link',
    'common.linkCopied': 'Copied!',
  },

  HI: {
    // Navigation
    'nav.dashboard': 'डैशबोर्ड',
    'nav.voice-agent': 'वादा AI',
    'nav.queue': 'तगादा कतार',
    'nav.customers': 'ग्राहक सूची',
    'nav.invoices': 'चालान (इन्वॉइस)',
    'nav.promises': 'वादे (प्रॉमिस)',
    'nav.reply-lab': 'रिप्लाई लैब',
    'nav.dispatch': 'डिस्पैच सेंटर',
    'nav.events': 'एक्शन लॉग',
    'nav.analytics': 'वित्तीय विश्लेषण',
    'nav.settings': 'सेटिंग्स',

    // Brand
    'brand.tagline': '“बाकी लोग बिल का पीछा करते हैं। हम वादे याद रखते हैं।”',
    'brand.demo': 'डेमो डेटा',

    // TopBar
    'topbar.searchPlaceholder': 'ग्राहक या इन्वॉइस नंबर खोजें...',
    'topbar.advance1d': '+1 दिन',
    'topbar.advance7d': '+7 दिन',
    'topbar.notifications': 'सूचनाएं',
    'topbar.brokenAlert': 'तोड़े गए वादे मिले',
    'topbar.noAlerts': 'इस समय कोई नया अलर्ट नहीं है',
    'topbar.viewAll': 'सभी तोड़े गए वादे देखें',

    // Dashboard
    'dashboard.title': 'व्यापारी वित्तीय डैशबोर्ड',
    'dashboard.subtitle': 'लाइव कैशफ्लो, वादों की स्थिति और स्मार्ट वसूली।',
    'dashboard.totalOutstanding': 'कुल बकाया',
    'dashboard.totalOutstandingSub': 'सभी खुले चालानों पर',
    'dashboard.overdueInvoices': 'समय सीमा पार (ओवरड्यू)',
    'dashboard.overdueSub': 'तुरंत संपर्क करने की आवश्यकता',
    'dashboard.collected': 'कुल वसूली',
    'dashboard.collectedSub': 'प्राप्त हुआ कुल भुगतान',
    'dashboard.promisedThisWeek': 'इस सप्ताह के वादे',
    'dashboard.dueNext7': 'अगले 7 दिनों में देय',
    'dashboard.riskyAlert': 'जोखिम भरे ग्राहकों से',
    'dashboard.agentTitle': 'वादा AI',
    'dashboard.agentDesc': 'प्राकृतिक हिंदी, कन्नड़ और अंग्रेजी आवाज सहायक: तुरंत वसूली सलाह, ग्राहक शेष और 1-क्लिक कैशफ्री पेमेंट लिंक।',
    'dashboard.openAgent': 'वादा AI खोलें →',
    'dashboard.topCustomers': 'ग्राहकवार बकाया और वसूली',
    'dashboard.top5': 'शीर्ष 5 ग्राहक',
    'dashboard.promiseHealth': 'वादों का स्वास्थ्य',
    'dashboard.kept': 'निभाया',
    'dashboard.broken': 'तोड़ा',
    'dashboard.open': 'बाकी',
    'dashboard.chaseQueueTitle': 'प्राथमिकता वसूली कतार',
    'dashboard.viewQueue': 'पूरी कतार देखें',
    'dashboard.recentActivity': 'हाल की गतिविधियां',
    'dashboard.viewAllLogs': 'सभी लॉग देखें',

    // Voice Agent
    'agent.headerTitle': 'वादा AI (सर्वम AI एवं कैशफ्री)',
    'agent.headerSubtitle': 'अपनी भाषा में कुछ भी पूछें — सलाह, बकाया राशि, दुकान का हिसाब और कैशफ्री पेमेंट लिंक',
    'agent.liveBadge': 'लाइव डेमो सक्रिय',
    'agent.inputPlaceholder': 'व्यापारी के रूप में, AI से कुछ भी करवाएं...',
    'agent.tapToSpeak': 'बोलने के लिए दबाएं',
    'agent.listening': 'सुन रहे हैं... अपनी भाषा में बोलें...',
    'agent.resetDemo': 'रीसेट डेमो',
    'agent.createLink': 'पेमेंट लिंक बनाएं',
    'agent.recoveryAdvice': 'वसूली सलाह',
    'agent.shopSummary': 'दुकान का पूरा हिसाब',
    'agent.draftReminder': 'कड़ा तगादा संदेश',

    // Common
    'common.retry': 'पुनः प्रयास करें',
    'common.loading': 'लोड हो रहा है...',
    'common.save': 'सहेजें',
    'common.cancel': 'रद्द करें',
    'common.confirm': 'पुष्टि करें',
    'common.back': 'पीछे',
    'common.paid': 'भुगतान हुआ',
    'common.unpaid': 'अदत्त',
    'common.partial': 'आंशिक',
    'common.followUp': 'तगादा करें',
    'common.quickWin': 'आसान वसूली',
    'common.simulatePaid': 'भुगतान दर्ज करें (सिम्युलेट)',
    'common.openLink': 'लिंक खोलें',
    'common.copyLink': 'लिंक कॉपी करें',
    'common.linkCopied': 'कॉपी हो गया!',
  },

  KN: {
    // Navigation
    'nav.dashboard': 'ಡ್ಯಾಶ್‌ಬೋರ್ಡ್',
    'nav.voice-agent': 'ವಾದಾ AI',
    'nav.queue': 'ಬಾಕಿ ವಸೂಲಿ ಕ್ಯೂ',
    'nav.customers': 'ಗ್ರಾಹಕರ ಪಟ್ಟಿ',
    'nav.invoices': 'ಇನ್‌ವಾಯ್ಸ್‌ಗಳು',
    'nav.promises': 'ಭರವಸೆಗಳು (ಪ್ರಾಮಿಸ್)',
    'nav.reply-lab': 'ಉತ್ತರ ಲ್ಯಾಬ್',
    'nav.dispatch': 'ರವಾನೆ ಕೇಂದ್ರ',
    'nav.events': 'ಆಕ್ಷನ್ ಲಾಗ್',
    'nav.analytics': 'ಹಣಕಾಸು ವಿಶ್ಲೇಷಣೆ',
    'nav.settings': 'ಸೆಟ್ಟಿಂಗ್‌ಗಳು',

    // Brand
    'brand.tagline': '“ಇತರರು ಇನ್‌ವಾಯ್ಸ್‌ಗಳನ್ನು ಬೆನ್ನಟ್ಟುತ್ತಾರೆ. ನಾವು ಭರವಸೆಗಳನ್ನು ನೆನಪಿಸಿಕೊಳ್ಳುತ್ತೇವೆ.”',
    'brand.demo': 'ಡೆಮೊ ಡೇಟಾ',

    // TopBar
    'topbar.searchPlaceholder': 'ಗ್ರಾಹಕರು ಅಥವಾ ಇನ್‌ವಾಯ್ಸ್ ಸಂಖ್ಯೆ ಹುಡುಕಿ...',
    'topbar.advance1d': '+1 ದಿನ',
    'topbar.advance7d': '+7 ದಿನ',
    'topbar.notifications': 'ಸೂಚನೆಗಳು',
    'topbar.brokenAlert': 'ಮುರಿದ ಭರವಸೆಗಳು ಪತ್ತೆಯಾಗಿವೆ',
    'topbar.noAlerts': 'ಯಾವುದೇ ಹೊಸ ಎಚ್ಚರಿಕೆಗಳಿಲ್ಲ',
    'topbar.viewAll': 'ಎಲ್ಲಾ ಮುರಿದ ಭರವಸೆಗಳನ್ನು ನೋಡಿ',

    // Dashboard
    'dashboard.title': 'ವ್ಯಾಪಾರಿ ಹಣಕಾಸು ಡ್ಯಾಶ್‌ಬೋರ್ಡ್',
    'dashboard.subtitle': 'ಲೈವ್ ನಗದು ಹರಿವು, ಭರವಸೆಗಳ ಆರೋಗ್ಯ ಮತ್ತು ಸ್ಮಾರ್ಟ್ ವಸೂಲಿ.',
    'dashboard.totalOutstanding': 'ಒಟ್ಟು ಬಾಕಿ ಮೊತ್ತ',
    'dashboard.totalOutstandingSub': 'ಎಲ್ಲಾ ಬಾಕಿ ಇನ್‌ವಾಯ್ಸ್‌ಗಳಲ್ಲಿ',
    'dashboard.overdueInvoices': 'ಗಡುವು ಮೀರಿದ ಬಾಕಿ',
    'dashboard.overdueSub': 'ತಕ್ಷಣವೇ ಫಾಲೋ-ಅಪ್ ಅಗತ್ಯವಿದೆ',
    'dashboard.collected': 'ವಸೂಲಾದ ಒಟ್ಟು ಮೊತ್ತ',
    'dashboard.collectedSub': 'ಸ್ವೀಕರಿಸಿದ ಒಟ್ಟು ಪಾವತಿಗಳು',
    'dashboard.promisedThisWeek': 'ಈ ವಾರದ ಭರವಸೆಗಳು',
    'dashboard.dueNext7': 'ಮುಂದಿನ 7 ದಿನಗಳಲ್ಲಿ ನೀಡಬೇಕಾದ್ದು',
    'dashboard.riskyAlert': 'ಅಪಾಯಕಾರಿ ಗ್ರಾಹಕರಿಂದ',
    'dashboard.agentTitle': 'ವಾದಾ AI',
    'dashboard.agentDesc': 'ಕನ್ನಡ, ಹಿಂದಿ ಮತ್ತು ಇಂಗ್ಲಿಷ್ ಧ್ವನಿ ಸಹಾಯಕ: ತ್ವರಿತ ವಸೂಲಿ ಸಲಹೆ, ಗ್ರಾಹಕರ ಬಾಕಿ ಮತ್ತು 1-ಕ್ಲಿಕ್ ಕ್ಯಾಶ್‌ಫ್ರೀ ಪಾವತಿ ಲಿಂಕ್.',
    'dashboard.openAgent': 'ವಾದಾ AI ತೆರೆಯಿರಿ →',
    'dashboard.topCustomers': 'ಗ್ರಾಹಕವಾರು ಬಾಕಿ ಮತ್ತು ಪಾವತಿ',
    'dashboard.top5': 'ಟಾಪ್ 5 ಗ್ರಾಹಕರು',
    'dashboard.promiseHealth': 'ಭರವಸೆಯ ಆರೋಗ್ಯ',
    'dashboard.kept': 'ಪೂರೈಸಲಾಗಿದೆ',
    'dashboard.broken': 'ಮುರಿದಿದೆ',
    'dashboard.open': 'ಬಾಕಿ ಇದೆ',
    'dashboard.chaseQueueTitle': 'ಅಗ್ರ ಆದ್ಯತೆಯ ವಸೂಲಿ ಕ್ಯೂ',
    'dashboard.viewQueue': 'ಸಂಪೂರ್ಣ ಕ್ಯೂ ವೀಕ್ಷಿಸಿ',
    'dashboard.recentActivity': 'ಇತ್ತೀಚಿನ ಚಟುವಟಿಕೆಗಳು',
    'dashboard.viewAllLogs': 'ಎಲ್ಲಾ ಲಾಗ್‌ಗಳನ್ನು ನೋಡಿ',

    // Voice Agent
    'agent.headerTitle': 'ವಾದಾ AI (ಸರ್ವಮ್ AI ಮತ್ತು ಕ್ಯಾಶ್‌ಫ್ರೀ)',
    'agent.headerSubtitle': 'ನಿಮ್ಮ ಸ್ವಂತ ಭಾಷೆಯಲ್ಲಿ AI ಅನ್ನು ಕೇಳಿ — ಸಲಹೆ, ಬಾಕಿ ಲೆಕ್ಕ, ಅಂಗಡಿ ಮಾಹಿತಿ & ಕ್ಯಾಶ್‌ಫ್ರೀ ಲಿಂಕ್',
    'agent.liveBadge': 'ಲೈವ್ ಡೆಮೊ ಸಕ್ರಿಯವಾಗಿದೆ',
    'agent.inputPlaceholder': 'ವ್ಯಾಪಾರಿಯಾಗಿ, AI ಗೆ ಯಾವುದೇ ಕೆಲಸ ಹೇಳಿ...',
    'agent.tapToSpeak': 'ಮಾತನಾಡಲು ಟ್ಯಾಪ್ ಮಾಡಿ',
    'agent.listening': 'ಕೇಳಿಸಿಕೊಳ್ಳುತ್ತಿದ್ದೇವೆ... ನಿಮ್ಮ ಭಾಷೆಯಲ್ಲಿ ಮಾತನಾಡಿ...',
    'agent.resetDemo': 'ಡೆಮೊ ಮರುಹೊಂದಿಸಿ',
    'agent.createLink': 'ಪಾವತಿ ಲಿಂಕ್ ರಚಿಸಿ',
    'agent.recoveryAdvice': 'ವಸೂಲಿ ಸಲಹೆ',
    'agent.shopSummary': 'ಅಂಗಡಿಯ ಒಟ್ಟು ಲೆಕ್ಕ',
    'agent.draftReminder': 'ದೃಢ ಸಂದೇಶ ರಚಿಸಿ',

    // Common
    'common.retry': 'ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ',
    'common.loading': 'ಲೋಡ್ ಆಗುತ್ತಿದೆ...',
    'common.save': 'ಉಳಿಸಿ',
    'common.cancel': 'ರದ್ದುಮಾಡಿ',
    'common.confirm': 'ಖಚಿತಪಡಿಸಿ',
    'common.back': 'ಹಿಂದಕ್ಕೆ',
    'common.paid': 'ಪಾವತಿಸಲಾಗಿದೆ',
    'common.unpaid': 'ಬಾಕಿ',
    'common.partial': 'ಭಾಗಶಃ',
    'common.followUp': 'ಫಾಲೋ-ಅಪ್',
    'common.quickWin': 'ಸುಲಭ ವಸೂಲಿ',
    'common.simulatePaid': 'ಪಾವತಿ ನಮೂದಿಸಿ',
    'common.openLink': 'ಲಿಂಕ್ ತೆರೆಯಿರಿ',
    'common.copyLink': 'ಲಿಂಕ್ ನಕಲಿಸಿ',
    'common.linkCopied': 'ನಕಲಿಸಲಾಗಿದೆ!',
  },
};

export const LanguageContext = createContext({
  lang: 'EN',
  setLang: () => {},
  t: (key) => key,
});

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState(() => {
    try {
      const saved = localStorage.getItem('vaada_lang');
      return ['EN', 'HI', 'KN'].includes(saved) ? saved : 'EN';
    } catch (e) {
      return 'EN';
    }
  });

  const setLang = (newLang) => {
    if (!['EN', 'HI', 'KN'].includes(newLang)) return;
    setLangState(newLang);
    try {
      localStorage.setItem('vaada_lang', newLang);
    } catch (e) {}
  };

  const t = (key, fallback = '') => {
    const dict = translations[lang] || translations.EN;
    return dict[key] || translations.EN[key] || fallback || key;
  };

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export const useLanguage = () => useContext(LanguageContext);
