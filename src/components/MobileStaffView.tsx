'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Calendar, IndianRupee, Package, ShieldCheck,
  CheckCircle2, XCircle, Clock, Bell, LogOut, Search,
} from 'lucide-react';
import {
  applyLeaveAction,
  applyAdvanceAction,
  respondGuarantorAction,
  createStoreRequestAction,
  markNotificationsReadAction,
} from '@/app/actions/hr-actions';
import { logoutAction } from '@/app/actions/auth-actions';

type Employee = {
  id: string;
  full_name: string;
  emp_code: string;
  department: string;
  isLocked: boolean;
};

export default function MobileStaffView({
  currentUser,
  allEmployees,
  myLeaves,
  myAdvances,
  myStoreRequests,
  guarantorRequests,
  notifications,
}: {
  currentUser: { id: string; full_name: string; emp_code: string; annual_leave_quota: number; leaves_used: number; role: string };
  allEmployees: Employee[];
  myLeaves: any[];
  myAdvances: any[];
  myStoreRequests: any[];
  guarantorRequests: any[];
  notifications: any[];
}) {
  const [activeTab, setActiveTab] = useState<'home' | 'leave' | 'advance' | 'store' | 'alerts'>('home');
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<any>(null);

  useEffect(() => {
    const handleBeforeInstall = (e: any) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
  }, []);
  const router = useRouter();

  const audioCtxRef = useRef<AudioContext | null>(null);

  // 1. Mobile WebKit & Android Gesture Unlock (Audio + Voice + Notification Permission)
  useEffect(() => {
    const unlockBoth = () => {
      try {
        // Mobile Notification permission ask on first user screen tap
        if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
          Notification.requestPermission();
        }

        // AudioContext unlock
        const AudioClass = window.AudioContext || (window as any).webkitAudioContext;
        if (!audioCtxRef.current && AudioClass) audioCtxRef.current = new AudioClass();
        if (audioCtxRef.current?.state === 'suspended') audioCtxRef.current.resume();

        // SpeechSynthesis Priming for Mobile
        if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
          const primer = new SpeechSynthesisUtterance(' ');
          primer.volume = 0.01;
          window.speechSynthesis.speak(primer);
        }
      } catch {}
    };

    window.addEventListener('touchstart', unlockBoth, { once: true });
    window.addEventListener('click', unlockBoth, { once: true });
    return () => {
      window.removeEventListener('touchstart', unlockBoth);
      window.removeEventListener('click', unlockBoth);
    };
  }, []);

  // 2. iPhone-Certified Sound & Voice Alert
  const playVoiceNotification = (messageText: string) => {
    try {
      // 1. Loud Chime (Tun)
      const AudioClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioClass) {
        if (!audioCtxRef.current) audioCtxRef.current = new AudioClass();
        const ctx = audioCtxRef.current;
        if (ctx.state === 'suspended') ctx.resume();

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        osc.frequency.setValueAtTime(1174.66, ctx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.9, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
        osc.start();
        osc.stop(ctx.currentTime + 0.35);
      }

      // 2. Siri/iOS Voice (en-IN works on 100% of iPhones)
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.resume(); // Fixes iOS paused queue lockup

        const utterance = new SpeechSynthesisUtterance(messageText);
        utterance.volume = 1.0;
        utterance.rate = 0.95;
        utterance.pitch = 1.0;
        utterance.lang = 'en-IN'; // Indian accent (Always downloaded on iOS)

        const allVoices = window.speechSynthesis.getVoices();
        const indianVoice = allVoices.find(
          (v) => v.lang === 'en-IN' || v.lang === 'hi-IN' || v.name.includes('India') || v.name.includes('Rishi')
        );
        if (indianVoice) utterance.voice = indianVoice;

        setTimeout(() => {
          window.speechSynthesis.speak(utterance);
        }, 150);
      }
    } catch {}
  };

  // 2. Auto-sync background updates every 8 seconds (no manual refresh needed)
  useEffect(() => {
    const timer = setInterval(() => {
      router.refresh();
    }, 8000);
    return () => clearInterval(timer);
  }, [router]);

  // 3. App Icon Badge Count + Hindi Voice Detection
  const prevNotifCount = useRef(notifications.length);
  const prevGuarantorCount = useRef(guarantorRequests.length);

  // Phone App Icon par red number (badge) set karna
  useEffect(() => {
    const unread = notifications.filter((n) => !n.is_read).length;
    if (typeof navigator !== 'undefined' && 'setAppBadge' in navigator) {
      if (unread > 0) {
        (navigator as any).setAppBadge(unread).catch(() => {});
      } else {
        (navigator as any).clearAppBadge().catch(() => {});
      }
    }
  }, [notifications]);

  useEffect(() => {
    const hasNewNotif = notifications.length > prevNotifCount.current;
    const hasNewGuarantor = guarantorRequests.length > prevGuarantorCount.current;

    if (hasNewNotif || hasNewGuarantor) {
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate([250, 100, 250]);
      }

      // Voice kya bolegi decide karein
      let hindiVoiceMessage = 'Aapke liye nayi notification aayi hai.';

      if (hasNewGuarantor) {
        hindiVoiceMessage = 'Dhyan dein, aapko advance guarantor banne ki request aayi hai.';
      } else if (hasNewNotif && notifications[0]) {
        const title = (notifications[0].title || '').toLowerCase();
        const msg = (notifications[0].message || '').toLowerCase();
        const combined = `${title} ${msg}`;

        if (combined.includes('chutti') && (combined.includes('manzoor') || combined.includes('approve') || combined.includes('haan'))) {
          hindiVoiceMessage = 'Aapki chutti manzoor ho gayi hai.';
        } else if (combined.includes('chutti') && (combined.includes('mana') || combined.includes('reject'))) {
          hindiVoiceMessage = 'Aapki chutti ki request mana kar di gayi hai.';
        } else if (combined.includes('advance') && (combined.includes('manzoor') || combined.includes('approve') || combined.includes('release') || combined.includes('settle'))) {
          hindiVoiceMessage = 'Aapka advance manzoor ho gaya hai.';
        } else if (combined.includes('advance') && (combined.includes('mana') || combined.includes('reject'))) {
          hindiVoiceMessage = 'Aapka advance mana ho gaya hai.';
        } else if (combined.includes('store') || combined.includes('samaan')) {
          hindiVoiceMessage = 'Store se aapke samaan ki nayi update aayi hai.';
        } else {
          hindiVoiceMessage = notifications[0].title || 'Office se naya message aaya hai.';
        }
      }

      // Tun bajao aur bolkar sunao
      playVoiceNotification(hindiVoiceMessage);

      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
        const latest = notifications[0];
        const notifTitle = hasNewGuarantor ? '🛡️ Guarantor Request' : (latest?.title || '🔔 SPARA Update');
        const notifBody = hasNewGuarantor ? 'Aapko colleague ne guarantor banaya hai.' : (latest?.message || hindiVoiceMessage);

        try {
          if ('serviceWorker' in navigator) {
            navigator.serviceWorker.ready.then((reg) => {
              reg.showNotification(notifTitle, {
                body: notifBody,
                icon: '/favicon.ico',
                badge: '/favicon.ico',
              });
            }).catch(() => {
              try { new Notification(notifTitle, { body: notifBody }); } catch {}
            });
          } else {
            new Notification(notifTitle, { body: notifBody });
          }
        } catch {}
      }
    }

    prevNotifCount.current = notifications.length;
    prevGuarantorCount.current = guarantorRequests.length;
  }, [notifications.length, guarantorRequests.length, notifications, guarantorRequests]);

  // Leave form
  const [leaveType, setLeaveType] = useState<'full_day' | 'half_day' | 'short_leave'>('full_day');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');

  const computedDays = () => {
    if (leaveType === 'half_day') return 0.5;
    if (leaveType === 'short_leave') return 0.5;
    if (!startDate) return 1;
    const s = new Date(startDate);
    const e = new Date(endDate || startDate);
    const diff = Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    return diff > 0 ? diff : 1;
  };

  // Advance form
  const [advAmount, setAdvAmount] = useState('');
  const [advReason, setAdvReason] = useState('');
  const [selectedGuarantors, setSelectedGuarantors] = useState<string[]>([]);
  const [guarantorSearch, setGuarantorSearch] = useState('');

  // Store form
  const [storeCat, setStoreCat] = useState<'uniform' | 'stationery' | 'laptop_repair' | 'tools_other'>('uniform');
  const [storeTitle, setStoreTitle] = useState('');
  const [storeDesc, setStoreDesc] = useState('');

  const remainingLeaves = Number(currentUser.annual_leave_quota) - Number(currentUser.leaves_used);
  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const filteredGuarantors = allEmployees.filter(
    (e) =>
      e.id !== currentUser.id &&
      (e.full_name.toLowerCase().includes(guarantorSearch.toLowerCase()) ||
        e.emp_code.toLowerCase().includes(guarantorSearch.toLowerCase()) ||
        e.department.toLowerCase().includes(guarantorSearch.toLowerCase()))
  );

  const toggleGuarantor = (id: string) => {
    if (selectedGuarantors.includes(id)) {
      setSelectedGuarantors(selectedGuarantors.filter((g) => g !== id));
    } else if (selectedGuarantors.length < 4) {
      setSelectedGuarantors([...selectedGuarantors, id]);
    }
  };

  const statusBadge = (status: string) => {
    if (['approved', 'approved_for_accounts', 'paid_settled', 'issued_completed'].includes(status)) {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1 text-[11px] font-bold text-emerald-800">
          <CheckCircle2 className="h-3.5 w-3.5" /> {status.replaceAll('_', ' ').toUpperCase()}
        </span>
      );
    }
    if (['rejected', 'rejected_by_boss', 'rejected_by_mdo', 'guarantor_rejected'].includes(status)) {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-3 py-1 text-[11px] font-bold text-rose-800">
          <XCircle className="h-3.5 w-3.5" /> {status.replaceAll('_', ' ').toUpperCase()}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-3 py-1 text-[11px] font-bold text-amber-800">
        <Clock className="h-3.5 w-3.5" /> {status.replaceAll('_', ' ').toUpperCase()}
      </span>
    );
  };

  return (
    <div className="mx-auto min-h-screen max-w-md bg-slate-50 pb-16 text-slate-900">
      {/* Header */}
      <div className="bg-slate-900 px-5 py-5 text-white">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-slate-400">SPARA CORPORATION • {currentUser.emp_code}</p>
            <h1 className="text-xl font-bold">{currentUser.full_name}</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={async () => {
                setActiveTab('alerts');
                if (unreadCount > 0) await markNotificationsReadAction(currentUser.id);
              }}
              className="relative rounded-xl bg-slate-800 p-2.5 text-slate-200"
            >
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white">
                  {unreadCount}
                </span>
              )}
            </button>
            <button onClick={() => logoutAction()} className="rounded-xl bg-slate-800 p-2.5 text-slate-200" title="Logout">
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between rounded-2xl bg-slate-800 p-3.5">
          <div>
            <p className="text-xs text-slate-400">Annual Leaves Left</p>
            <p className="text-2xl font-extrabold text-emerald-400">
              {remainingLeaves} <span className="text-sm font-normal text-slate-300">/ {currentUser.annual_leave_quota}</span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => playVoiceNotification('Aapki chutti manzoor ho gayi hai')}
              className="rounded-xl bg-emerald-700/80 hover:bg-emerald-600 px-2.5 py-1.5 text-[11px] font-bold text-emerald-100 border border-emerald-500/30"
              title="Test Voice on iPhone"
            >
              🔊 Test Voice
            </button>
            {activeTab !== 'home' && (
              <button onClick={() => setActiveTab('home')} className="rounded-xl bg-slate-700 px-3 py-2 text-xs font-bold">
                ← Home
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-4 p-4">
        {installPrompt && (
          <div className="flex items-center justify-between rounded-2xl bg-emerald-600 p-3.5 text-white shadow-lg animate-pulse">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide">SPARA Mobile App</p>
              <p className="text-[11px] text-emerald-100">Bina browser open kiye phone me install karein</p>
            </div>
            <button
              onClick={async () => {
                if (!installPrompt) return;
                installPrompt.prompt();
                const { outcome } = await installPrompt.userChoice;
                if (outcome === 'accepted') setInstallPrompt(null);
              }}
              className="rounded-xl bg-white px-3.5 py-2 text-xs font-extrabold text-emerald-950 shadow active:scale-95"
            >
              📲 Install App
            </button>
          </div>
        )}

        {message && (
          <div className={`rounded-xl p-3 text-sm font-semibold ${message.type === 'ok' ? 'bg-emerald-100 text-emerald-900' : 'bg-rose-100 text-rose-900'}`}>
            {message.text}
          </div>
        )}

        {/* GUARANTOR PERMISSION BANNER */}
        {guarantorRequests.length > 0 && (
          <div className="rounded-2xl border-2 border-amber-400 bg-amber-50 p-4 shadow-sm">
            <div className="mb-2 flex items-center gap-2 font-bold text-amber-900">
              <ShieldCheck className="h-5 w-5" /> Guarantor Permission Needed
            </div>
            {guarantorRequests.map((gr) => {
              const adv = Array.isArray(gr.advance) ? gr.advance[0] : gr.advance;
              const app = Array.isArray(adv?.applicant) ? adv.applicant[0] : adv?.applicant;
              return (
                <div key={gr.id} className="mt-2 rounded-xl bg-white p-3 shadow-sm">
                  <p className="text-sm text-slate-800">
                    <strong>{app?.full_name}</strong> wants ₹{adv?.amount} advance and asked you to be Guarantor.
                  </p>
                  <div className="mt-2.5 flex gap-2">
                    <button
                      onClick={() => respondGuarantorAction(gr.advance_id, currentUser.id, true)}
                      className="flex-1 rounded-xl bg-emerald-600 py-2.5 text-sm font-bold text-white"
                    >
                      Accept
                    </button>
                    <button
                      onClick={() => respondGuarantorAction(gr.advance_id, currentUser.id, false)}
                      className="flex-1 rounded-xl bg-rose-600 py-2.5 text-sm font-bold text-white"
                    >
                      Decline
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* HOME */}
        {activeTab === 'home' && (
          <>
            <div className="grid grid-cols-1 gap-3">
              <button
                onClick={() => { setMessage(null); setActiveTab('leave'); }}
                className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm active:scale-95"
              >
                <div className="rounded-xl bg-blue-100 p-3 text-blue-700"><Calendar className="h-7 w-7" /></div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">Apply Leave (Chutti)</h2>
                  <p className="text-xs text-slate-500">Full day, Half day & instant approval color</p>
                </div>
              </button>

              <button
                onClick={() => { setMessage(null); setActiveTab('advance'); }}
                className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm active:scale-95"
              >
                <div className="rounded-xl bg-emerald-100 p-3 text-emerald-700"><IndianRupee className="h-7 w-7" /></div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">Salary Advance</h2>
                  <p className="text-xs text-slate-500">Pick 4 guarantors → Channi Sir → Accounts</p>
                </div>
              </button>

              <button
                onClick={() => { setMessage(null); setActiveTab('store'); }}
                className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm active:scale-95"
              >
                <div className="rounded-xl bg-purple-100 p-3 text-purple-700"><Package className="h-7 w-7" /></div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">Store / Uniform / Repair</h2>
                  <p className="text-xs text-slate-500">Uniform, stationery, laptop repair requests</p>
                </div>
              </button>
            </div>

            <div className="pt-2">
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">My Requests Status</h3>
              <div className="space-y-2">
                {myLeaves.map((l) => (
                  <div key={l.id} className="flex items-center justify-between rounded-xl bg-white p-3.5 shadow-sm">
                    <div>
                      <p className="text-sm font-bold">Leave ({l.type.replace('_', ' ')})</p>
                      <p className="text-xs text-slate-500">{l.start_date} • {l.days_count} day(s)</p>
                    </div>
                    {statusBadge(l.status)}
                  </div>
                ))}
                {myAdvances.map((a) => (
                  <div key={a.id} className="flex items-center justify-between rounded-xl bg-white p-3.5 shadow-sm">
                    <div>
                      <p className="text-sm font-bold">Advance ₹{a.amount}</p>
                      <p className="text-xs text-slate-500">{a.reason}</p>
                    </div>
                    {statusBadge(a.status)}
                  </div>
                ))}
                {myStoreRequests.map((s) => (
                  <div key={s.id} className="flex items-center justify-between rounded-xl bg-white p-3.5 shadow-sm">
                    <div>
                      <p className="text-sm font-bold">{s.title}</p>
                      <p className="text-xs text-slate-500">{s.category.replace('_', ' ')}</p>
                    </div>
                    {statusBadge(s.status)}
                  </div>
                ))}
                {myLeaves.length === 0 && myAdvances.length === 0 && myStoreRequests.length === 0 && (
                  <p className="rounded-xl bg-white p-4 text-center text-xs text-slate-400">No requests submitted yet.</p>
                )}
              </div>
            </div>
          </>
        )}

        {/* ALERTS TAB */}
        {activeTab === 'alerts' && (
          <div className="space-y-2.5">
            <div className="flex items-center justify-between pb-1">
              <h2 className="text-sm font-black uppercase tracking-wider text-slate-700">Audit & Updates Feed</h2>
              <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-bold text-slate-700">
                {notifications.length} events
              </span>
            </div>
            {notifications.map((n) => {
              const isGreen = n.title?.includes('🟢') || n.title?.includes('Sanctioned') || n.title?.includes('Disbursed');
              const isRed = n.title?.includes('🔴') || n.title?.includes('Rejected');
              return (
                <div
                  key={n.id}
                  className={`relative rounded-2xl border bg-white p-3.5 shadow-xs transition ${
                    !n.is_read ? 'border-l-4 border-l-blue-600' : 'border-slate-200'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className={`text-xs font-black tracking-wide ${isGreen ? 'text-emerald-700' : isRed ? 'text-rose-700' : 'text-slate-900'}`}>
                      {n.title}
                    </p>
                    <span className="text-[10px] font-mono font-semibold text-slate-400">
                      {n.created_at ? new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Just now'}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-600 leading-relaxed font-medium">{n.message}</p>
                </div>
              );
            })}
            {notifications.length === 0 && (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-xs text-slate-400">
                No system alerts or log entries recorded.
              </div>
            )}
          </div>
        )}

        {/* LEAVE FORM */}
        {activeTab === 'leave' && (
          <div className="space-y-4 rounded-2xl bg-white p-4 shadow-sm">
            <h2 className="text-lg font-bold">Apply for Leave</h2>
            <div className="grid grid-cols-3 gap-2">
              {[
                { key: 'full_day', label: 'Full Day' },
                { key: 'half_day', label: 'Half Day' },
                { key: 'short_leave', label: 'Short' },
              ].map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setLeaveType(item.key as any)}
                  className={`rounded-xl py-3 text-sm font-bold ${
                    leaveType === item.key ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
            {leaveType === 'full_day' ? (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] font-bold text-slate-500">FROM DATE</label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => {
                        setStartDate(e.target.value);
                        if (!endDate || e.target.value > endDate) setEndDate(e.target.value);
                      }}
                      className="mt-1 w-full rounded-xl border border-slate-300 p-3 text-sm font-semibold text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-500">TO DATE</label>
                    <input
                      type="date"
                      min={startDate}
                      value={endDate || startDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-slate-300 p-3 text-sm font-semibold text-slate-900"
                    />
                  </div>
                </div>
                {startDate && (
                  <p className="rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700">
                    Total Duration: {computedDays()} Day(s)
                  </p>
                )}
              </div>
            ) : (
              <div>
                <label className="text-[11px] font-bold text-slate-500">DATE</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    setEndDate(e.target.value);
                  }}
                  className="mt-1 w-full rounded-xl border border-slate-300 p-3 text-sm font-semibold text-slate-900"
                />
              </div>
            )}

            <textarea
              placeholder="Reason for leave..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full rounded-xl border border-slate-300 p-3 text-sm text-slate-900"
            />
            <button
              disabled={busy || !startDate}
              onClick={async () => {
                setBusy(true);
                const finalEndDate = leaveType === 'full_day' ? (endDate || startDate) : startDate;
                const daysCount = computedDays();
                const res = await applyLeaveAction({
                  userId: currentUser.id,
                  type: leaveType,
                  startDate,
                  endDate: finalEndDate,
                  daysCount,
                  reason,
                });
                setBusy(false);
                if (res.error) setMessage({ type: 'err', text: res.error });
                else {
                  setMessage({ type: 'ok', text: `Leave request for ${daysCount} day(s) submitted!` });
                  setStartDate(''); setEndDate(''); setReason('');
                  setActiveTab('home');
                }
              }}
              className="w-full rounded-xl bg-slate-900 py-3.5 font-bold text-white disabled:opacity-50"
            >
              {busy ? 'Sending...' : 'Submit Leave'}
            </button>
          </div>
        )}

        {/* ADVANCE FORM WITH SEARCHABLE 174 GUARANTOR LIST */}
        {activeTab === 'advance' && (
          <div className="space-y-4 rounded-2xl bg-white p-4 shadow-sm">
            <h2 className="text-lg font-bold">Request Salary Advance</h2>
            <input
              type="number"
              placeholder="Amount (₹)"
              value={advAmount}
              onChange={(e) => setAdvAmount(e.target.value)}
              className="w-full rounded-xl border border-slate-300 p-3 text-sm text-slate-900"
            />
            <input
              type="text"
              placeholder="Reason"
              value={advReason}
              onChange={(e) => setAdvReason(e.target.value)}
              className="w-full rounded-xl border border-slate-300 p-3 text-sm text-slate-900"
            />
            <div>
              <p className="mb-2 text-sm font-bold text-slate-700">
                Select 4 Guarantors ({selectedGuarantors.length}/4)
              </p>
              <div className="relative mb-2">
                <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search staff name, ID or department..."
                  value={guarantorSearch}
                  onChange={(e) => setGuarantorSearch(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 py-2.5 pl-9 pr-3 text-sm text-slate-900"
                />
              </div>
              <div className="max-h-56 space-y-2 overflow-y-auto">
                {filteredGuarantors.map((emp) => {
                  const picked = selectedGuarantors.includes(emp.id);
                  return (
                    <button
                      key={emp.id}
                      type="button"
                      disabled={emp.isLocked}
                      onClick={() => toggleGuarantor(emp.id)}
                      className={`flex w-full items-center justify-between rounded-xl border p-3 text-left text-xs ${
                        emp.isLocked
                          ? 'cursor-not-allowed bg-slate-100 text-slate-400'
                          : picked
                          ? 'border-emerald-600 bg-emerald-50 font-bold text-emerald-900'
                          : 'bg-white text-slate-800'
                      }`}
                    >
                      <span>
                        <strong>{emp.full_name}</strong> ({emp.emp_code}) • {emp.department}
                      </span>
                      <span className="shrink-0 pl-2 font-semibold">
                        {emp.isLocked ? '🔒 Busy' : picked ? '✓ Picked' : 'Pick'}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
            <button
              disabled={busy || selectedGuarantors.length !== 4}
              onClick={async () => {
                setBusy(true);
                const res = await applyAdvanceAction({
                  userId: currentUser.id,
                  amount: Number(advAmount),
                  reason: advReason,
                  guarantorIds: selectedGuarantors,
                });
                setBusy(false);
                if (res.error) setMessage({ type: 'err', text: res.error });
                else {
                  setMessage({ type: 'ok', text: 'Sent to 4 guarantors for approval!' });
                  setAdvAmount(''); setAdvReason(''); setSelectedGuarantors([]);
                  setActiveTab('home');
                }
              }}
              className="w-full rounded-xl bg-emerald-600 py-3.5 font-bold text-white disabled:bg-slate-300"
            >
              {busy ? 'Sending...' : 'Submit Advance Request'}
            </button>
          </div>
        )}

        {/* STORE / REPAIR FORM */}
        {activeTab === 'store' && (
          <div className="space-y-4 rounded-2xl bg-white p-4 shadow-sm">
            <h2 className="text-lg font-bold">Store / Repair Request</h2>
            <select
              value={storeCat}
              onChange={(e) => setStoreCat(e.target.value as any)}
              className="w-full rounded-xl border border-slate-300 p-3 text-sm text-slate-900"
            >
              <option value="uniform">Uniform</option>
              <option value="stationery">Stationery</option>
              <option value="laptop_repair">Laptop / IT Repair</option>
              <option value="tools_other">Other Requirement</option>
            </select>
            <input
              type="text"
              placeholder="Item / Issue Title (e.g. New Uniform XL)"
              value={storeTitle}
              onChange={(e) => setStoreTitle(e.target.value)}
              className="w-full rounded-xl border border-slate-300 p-3 text-sm text-slate-900"
            />
            <textarea
              placeholder="Details..."
              value={storeDesc}
              onChange={(e) => setStoreDesc(e.target.value)}
              className="w-full rounded-xl border border-slate-300 p-3 text-sm text-slate-900"
            />
            <button
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                const res = await createStoreRequestAction({
                  userId: currentUser.id,
                  category: storeCat,
                  title: storeTitle,
                  description: storeDesc,
                });
                setBusy(false);
                if (res.error) setMessage({ type: 'err', text: res.error });
                else {
                  setMessage({ type: 'ok', text: 'Request sent to HR/MDO!' });
                  setStoreTitle(''); setStoreDesc('');
                  setActiveTab('home');
                }
              }}
              className="w-full rounded-xl bg-purple-600 py-3.5 font-bold text-white disabled:opacity-50"
            >
              {busy ? 'Sending...' : 'Submit Requirement'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}