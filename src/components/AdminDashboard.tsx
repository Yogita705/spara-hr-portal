'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  LogOut,
  Search,
  Bell,
  Calendar,
  IndianRupee,
  Package,
  Users,
  UserCheck,
  ShieldCheck,
  Check,
  X,
  Building2,
  FileText,
  AlertTriangle,
  MessageSquareText,
  ChevronRight,
  Clock,
  Menu,
} from 'lucide-react';
import {
  reviewLeaveAction,
  sendLeaveRemarkAction,
  revertLeaveApprovalAction,
  bossReviewAdvanceAction,
  accountsSettleAdvanceAction,
  updateStoreStatusAction,
  updateEmployeeRoleAction,
  applyLeaveAction,
  createStoreRequestAction,
  respondGuarantorAction,
} from '@/app/actions/hr-actions';
import { RotateCcw } from 'lucide-react';
import { logoutAction } from '@/app/actions/auth-actions';

export default function AdminDashboard({
  currentUser,
  allLeaves = [],
  allAdvances = [],
  allStore = [],
  staffDirectory = [],
  myLeaves = [],
  myStore = [],
  guarantorRequests = [],
}: {
  currentUser: {
    id: string;
    full_name: string;
    emp_code: string;
    role: 'hr_mdo' | 'boss' | 'store' | 'accounts';
    annual_leave_quota: number;
    leaves_used: number;
  };
  allLeaves: any[];
  allAdvances: any[];
  allStore: any[];
  staffDirectory: any[];
  myLeaves: any[];
  myStore: any[];
  guarantorRequests: any[];
}) {
  const defaultTab =
    currentUser.role === 'accounts'
      ? 'advances'
      : currentUser.role === 'store'
      ? 'store'
      : 'leaves';
  const [tab, setTab] = useState<'leaves' | 'advances' | 'store' | 'staff' | 'my'>(defaultTab);

  const canSeeLeaves = currentUser.role === 'hr_mdo' || currentUser.role === 'boss';
  const canSeeAdvances = currentUser.role === 'accounts' || currentUser.role === 'boss';
  const canSeeStore = currentUser.role === 'hr_mdo' || currentUser.role === 'store' || currentUser.role === 'boss';
  const canSeeStaff = currentUser.role === 'hr_mdo' || currentUser.role === 'boss';

  const [staffSearch, setStaffSearch] = useState('');
  const [leaveSearch, setLeaveSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'resolved'>('all');
  const [msg, setMsg] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(true); // Desktop hide/show
  const [mobileOpen, setMobileOpen] = useState(false);  // Mobile hide/show

  // Active dialog popup state
  const [activeAction, setActiveAction] = useState<{ id: string; type: 'remark' | 'reject' | 'revoke'; applicantName: string } | null>(null);
  const [actionInput, setActionInput] = useState('');
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const router = useRouter();

  // Real-time toast state with distinct alert categories
  const [liveToast, setLiveToast] = useState<{
    type: 'leave' | 'advance' | 'store';
    title: string;
    desc: string;
    targetTab: 'leaves' | 'advances' | 'store';
  } | null>(null);

  // Track previous counts to detect fresh arrivals
  const prevLeavesCount = useRef(allLeaves.length);
  const prevAdvancesCount = useRef(allAdvances.length);
  const prevStoreCount = useRef(allStore.length);

  // High-End Loud Chime + Professional AI Voice Announcement
  const playVoiceAlert = (kind: 'leave' | 'advance' | 'store', detail?: string) => {
    try {
      // 1. Loud Executive Chime (Volume boosted to 0.75)
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.setValueAtTime(880.00, ctx.currentTime + 0.12); // A5
      gain.gain.setValueAtTime(0.75, ctx.currentTime); // LOUD volume
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);
      osc.start();
      osc.stop(ctx.currentTime + 0.45);

      // 2. High-End Spoken Voice Alert
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel(); // Clear any previous queue
        
        let spokenText = '';
        if (kind === 'leave') {
          spokenText = `Attention! You have received a new leave request ${detail ? `from ${detail}` : ''}.`;
        } else if (kind === 'advance') {
          spokenText = `Alert! You have received a new salary advance request ${detail ? `for ${detail}` : ''}.`;
        } else {
          spokenText = `Notification! New store and repair requirement received.`;
        }

        const utterance = new SpeechSynthesisUtterance(spokenText);
        utterance.volume = 1.0; // Max Loudness (100%)
        utterance.rate = 0.95;  // Clear, crisp enterprise delivery speed
        utterance.pitch = 1.05; // Natural vocal tone

        // Pick clear English female/assistant voice if available
        const voices = window.speechSynthesis.getVoices();
        const preferredVoice = voices.find(
          (v) =>
            v.lang.startsWith('en') &&
            (v.name.includes('Google') || v.name.includes('Natural') || v.name.includes('Zira') || v.name.includes('Samantha'))
        );
        if (preferredVoice) utterance.voice = preferredVoice;

        // Speak right after chime
        setTimeout(() => {
          window.speechSynthesis.speak(utterance);
        }, 200);
      }
    } catch {}
  };

  // Request browser desktop notification permission on first load
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'default') {
        Notification.requestPermission();
      }
    }
  }, []);

  // Personal leave/store state
  const [leaveType, setLeaveType] = useState<'full_day' | 'half_day' | 'short_leave'>('full_day');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [leaveReason, setLeaveReason] = useState('');
  const [storeTitle, setStoreTitle] = useState('');
  const [storeCat, setStoreCat] = useState<'uniform' | 'stationery' | 'laptop_repair' | 'tools_other'>('stationery');

  const isAccounts = currentUser.role === 'accounts';
  const isStore = currentUser.role === 'store';
  const isChanniSir = currentUser.emp_code === 'MD-001';

  const visibleAdvances = isAccounts
    ? allAdvances.filter((a) => ['approved_for_accounts', 'paid_settled'].includes(a.status))
    : allAdvances;
  const visibleStore = isStore
    ? allStore.filter((s) => ['approved_to_store', 'issued_completed'].includes(s.status))
    : allStore;

  const pendingLeavesCount = allLeaves.filter((l) => l.status === 'pending').length;
  const actionAdvancesCount = isAccounts
    ? allAdvances.filter((a) => a.status === 'approved_for_accounts').length
    : allAdvances.filter((a) => ['waiting_guarantors', 'pending_boss', 'approved_for_accounts'].includes(a.status)).length;
  const actionStoreCount = isStore
    ? allStore.filter((s) => s.status === 'approved_to_store').length
    : allStore.filter((s) => ['pending_mdo', 'approved_to_store'].includes(s.status)).length;

  const filteredStaff = staffDirectory.filter(
    (s) =>
      s.full_name?.toLowerCase().includes(staffSearch.toLowerCase()) ||
      s.emp_code?.toLowerCase().includes(staffSearch.toLowerCase()) ||
      s.department?.toLowerCase().includes(staffSearch.toLowerCase())
  );

  const filteredLeaves = allLeaves.filter((l) => {
    const matchesSearch =
      l.applicant?.full_name?.toLowerCase().includes(leaveSearch.toLowerCase()) ||
      l.applicant?.emp_code?.toLowerCase().includes(leaveSearch.toLowerCase()) ||
      l.applicant?.department?.toLowerCase().includes(leaveSearch.toLowerCase());
    if (!matchesSearch) return false;
    if (filterStatus === 'pending') return l.status === 'pending';
    if (filterStatus === 'resolved') return l.status !== 'pending';
    return true;
  });

  // Background refresh every 10s
  useEffect(() => {
    const interval = setInterval(() => {
      router.refresh();
    }, 10000);
    return () => clearInterval(interval);
  }, [router]);

  // Tab Title Alert
  const totalPending = pendingLeavesCount + actionAdvancesCount + actionStoreCount;
  useEffect(() => {
    if (totalPending > 0) {
      document.title = `(${totalPending}) 🔔 New Requests - SPARA Authority`;
    } else {
      document.title = `SPARA Corporation - Authority Portal`;
    }
  }, [totalPending]);

  // Detect new arrivals & trigger distinct toast, sound, and OS desktop notification
  useEffect(() => {
    if (allLeaves.length > prevLeavesCount.current) {
      const latest = allLeaves[0];
      playVoiceAlert('leave', latest?.applicant?.full_name);
      setLiveToast({
        type: 'leave',
        title: 'LEAVE CONCURRENCE • PENDING AUDIT',
        desc: `${latest?.applicant?.full_name || 'Staff'} (${latest?.applicant?.emp_code || 'EMP'}) scheduled ${latest?.type?.replace('_', ' ')} (${latest?.days_count || 1}d) starting ${latest?.start_date}.`,
        targetTab: 'leaves',
      });
      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
        const notif = new Notification(`[ACTION REQUIRED] Leave: ${latest?.applicant?.full_name || 'Staff'}`, {
          body: `📅 Period: ${latest?.start_date} (${latest?.days_count || 1}d) • Dept: ${latest?.applicant?.department || 'Operations'}`,
          tag: 'spara-leave-inbound',
        } as NotificationOptions);
        notif.onclick = () => { window.focus(); setTab('leaves'); };
      }
    } else if (allAdvances.length > prevAdvancesCount.current) {
      const latest = allAdvances[0];
      playVoiceAlert('advance', `rupees ${Number(latest?.amount || 0).toLocaleString('en-IN')}`);
      setLiveToast({
        type: 'advance',
        title: 'DISBURSEMENT INDENT • EXECUTIVE REVIEW',
        desc: `${latest?.applicant?.full_name || 'Staff'} (${latest?.applicant?.emp_code || 'EMP'}) filed advance ₹${Number(latest?.amount || 0).toLocaleString('en-IN')}. Guarantor pipeline active.`,
        targetTab: 'advances',
      });
      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
        const notif = new Notification(`⚡ Advance Request: ₹${Number(latest?.amount || 0).toLocaleString('en-IN')}`, {
          body: `Applicant: ${latest?.applicant?.full_name} (${latest?.applicant?.emp_code})\nGuarantor Pipeline: Active • Action Needed`,
          tag: 'spara-advance-inbound',
        } as NotificationOptions);
        notif.onclick = () => { window.focus(); setTab('advances'); };
      }
    } else if (allStore.length > prevStoreCount.current) {
      const latest = allStore[0];
      playVoiceAlert('store', latest?.title);
      setLiveToast({
        type: 'store',
        title: 'LOGISTICS INDENT • MDO APPROVAL REQUIRED',
        desc: `New store ticket: "${latest?.title || 'Item'}" logged under [${(latest?.category || 'general').toUpperCase()}] by ${latest?.applicant?.full_name || 'Staff'}.`,
        targetTab: 'store',
      });
      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
        const notif = new Notification(`📦 Store Indent: [${(latest?.category || 'general').toUpperCase()}]`, {
          body: `Item: ${latest?.title}\nRequested by: ${latest?.applicant?.full_name} (${latest?.applicant?.emp_code})`,
          tag: 'spara-store-inbound',
        } as NotificationOptions);
      }
    }

    prevLeavesCount.current = allLeaves.length;
    prevAdvancesCount.current = allAdvances.length;
    prevStoreCount.current = allStore.length;
  }, [allLeaves.length, allAdvances.length, allStore.length]);

  const getInitials = (name?: string) => {
    if (!name) return 'SP';
    return name
      .replace(/^(Mr\.|Mrs\.|Ms\.|Dr\.)\s+/i, '')
      .split(' ')
      .map((w) => w[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  };

  const statusBadge = (status: string) => {
    const isApproved = ['approved', 'approved_for_accounts', 'paid_settled', 'issued_completed'].includes(status);
    const isRejected = ['rejected', 'rejected_by_boss', 'rejected_by_mdo', 'guarantor_rejected'].includes(status);

    if (isApproved) {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          APPROVED
        </span>
      );
    }
    if (isRejected) {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-200 bg-rose-50 px-2.5 py-0.5 text-[11px] font-bold text-rose-700">
          <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
          REJECTED
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-[11px] font-bold text-amber-700">
        <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
        PENDING
      </span>
    );
  };

  return (
    <div className="flex min-h-screen bg-slate-100/70 text-slate-900 font-sans antialiased">
      {/* Mobile Dark Backdrop */}
      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 z-40 bg-slate-950/70 backdrop-blur-xs md:hidden"
        />
      )}

      {/* ================= 1. COLLAPSIBLE NAVIGATION SIDEBAR ================= */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col justify-between border-r border-slate-800 bg-slate-950 text-slate-300 transition-transform duration-300 ease-in-out ${
          sidebarOpen ? 'md:translate-x-0' : 'md:-translate-x-full'
        } ${mobileOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'}`}
      >
        <div>
          {/* Brand Header with Toggle Close Button */}
          <div className="flex h-16 items-center justify-between border-b border-slate-800/80 px-5">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500 font-black text-slate-950 shadow-xs">
                S
              </div>
              <div>
                <div className="text-xs font-black tracking-widest text-emerald-400 uppercase">SPARA CORP</div>
                <div className="text-[11px] font-medium text-slate-400">Enterprise Operations</div>
              </div>
            </div>
            <button
              onClick={() => {
                if (typeof window !== 'undefined' && window.innerWidth < 768) {
                  setMobileOpen(false);
                } else {
                  setSidebarOpen(false);
                }
              }}
              title="Hide Sidebar"
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Nav Links */}
          <div className="p-3 space-y-1">
            <div className="px-3 py-2 text-[10px] font-bold tracking-wider text-slate-500 uppercase">
              Management Modules
            </div>

            {canSeeLeaves && (
              <button
                onClick={() => { setTab('leaves'); setMobileOpen(false); }}
                className={`flex w-full items-center justify-between rounded-xl px-3.5 py-2.5 text-xs font-semibold transition ${
                  tab === 'leaves'
                    ? 'bg-slate-800/90 font-bold text-white shadow-xs'
                    : 'text-slate-400 hover:bg-slate-900 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Calendar className="h-4 w-4 text-emerald-400" />
                  <span>Leave Requests</span>
                </div>
                {pendingLeavesCount > 0 && (
                  <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-500/20 px-1.5 text-[10px] font-bold text-amber-300 border border-amber-500/30">
                    {pendingLeavesCount}
                  </span>
                )}
              </button>
            )}

{canSeeAdvances && (
              <button
                onClick={() => { setTab('advances'); setMobileOpen(false); }}
                className={`flex w-full items-center justify-between rounded-xl px-3.5 py-2.5 text-xs font-semibold transition ${
                  tab === 'advances'
                    ? 'bg-slate-800/90 font-bold text-white shadow-xs'
                    : 'text-slate-400 hover:bg-slate-900 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <IndianRupee className="h-4 w-4 text-blue-400" />
                  <span>Salary Advances</span>
                </div>
                {actionAdvancesCount > 0 && (
                  <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-blue-500/20 px-1.5 text-[10px] font-bold text-blue-300 border border-blue-500/30">
                    {actionAdvancesCount}
                  </span>
                )}
              </button>
            )}

{canSeeStore && (
              <button
                onClick={() => { setTab('store'); setMobileOpen(false); }}
                className={`flex w-full items-center justify-between rounded-xl px-3.5 py-2.5 text-xs font-semibold transition ${
                  tab === 'store'
                    ? 'bg-slate-800/90 font-bold text-white shadow-xs'
                    : 'text-slate-400 hover:bg-slate-900 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Package className="h-4 w-4 text-purple-400" />
                  <span>Store & Repairs</span>
                </div>
                {actionStoreCount > 0 && (
                  <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-purple-500/20 px-1.5 text-[10px] font-bold text-purple-300 border border-purple-500/30">
                    {actionStoreCount}
                  </span>
                )}
              </button>
            )}

{canSeeStaff && (
              <button
                onClick={() => { setTab('staff'); setMobileOpen(false); }}
                className={`flex w-full items-center justify-between rounded-xl px-3.5 py-2.5 text-xs font-semibold transition ${
                  tab === 'staff'
                    ? 'bg-slate-800/90 font-bold text-white shadow-xs'
                    : 'text-slate-400 hover:bg-slate-900 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Users className="h-4 w-4 text-indigo-400" />
                  <span>Staff Directory</span>
                </div>
                <span className="text-[11px] font-mono text-slate-500">{staffDirectory.length}</span>
              </button>
            )}

{!isChanniSir && (
              <button
                onClick={() => { setTab('my'); setMobileOpen(false); }}
                className={`flex w-full items-center justify-between rounded-xl px-3.5 py-2.5 text-xs font-semibold transition ${
                  tab === 'my'
                    ? 'bg-emerald-950/60 font-bold text-emerald-200 border border-emerald-800/50'
                    : 'text-slate-400 hover:bg-slate-900 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <UserCheck className="h-4 w-4 text-emerald-400" />
                  <span>My Quota & Requests</span>
                </div>
                <span className="text-[11px] font-bold text-emerald-400">
                  {Number(currentUser.annual_leave_quota) - Number(currentUser.leaves_used)} Left
                </span>
              </button>
            )}
          </div>
        </div>

        {/* User Card at bottom of sidebar */}
        <div className="border-t border-slate-800/80 p-3.5">
          <div className="flex items-center justify-between rounded-xl bg-slate-900/90 p-2.5">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/20 font-bold text-emerald-400 border border-emerald-500/30 text-xs">
                {getInitials(currentUser.full_name)}
              </div>
              <div className="min-w-0">
                <p className="truncate text-xs font-bold text-white">{currentUser.full_name}</p>
                <p className="text-[10px] text-slate-400 font-mono">
                  {currentUser.emp_code} • <span className="uppercase text-emerald-400 font-bold">{currentUser.role}</span>
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowLogoutConfirm(true)}
              title="Logout"
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-rose-400 transition"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* ================= 2. MAIN WORKSPACE WITH GRIDS & SOFTWARE AESTHETICS ================= */}
      <div className={`flex-1 min-w-0 flex flex-col transition-all duration-300 ${sidebarOpen ? 'md:ml-64' : 'md:ml-0'} ml-0`}>
        {/* Top Breadcrumb & Status Bar with Notification Bell */}
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-slate-200 bg-white/95 backdrop-blur-md px-4 sm:px-8 shadow-2xs">
          <div className="flex items-center gap-3">
            {/* Unified ☰ Button for Desktop and Mobile */}
            <button
              onClick={() => {
                if (typeof window !== 'undefined' && window.innerWidth < 768) {
                  setMobileOpen(!mobileOpen);
                } else {
                  setSidebarOpen(!sidebarOpen);
                }
              }}
              className="rounded-xl border border-slate-200 bg-white p-2 text-slate-700 hover:bg-slate-50 transition active:scale-95 shadow-2xs"
              title={sidebarOpen ? 'Hide Sidebar (Full Width)' : 'Show Sidebar'}
              aria-label="Toggle Sidebar"
            >
              <Menu className="h-4 w-4" />
            </button>
            <div className="flex items-center gap-1.5 text-xs">
              <span className="font-bold text-slate-900 capitalize text-sm sm:text-xs">
                {tab.replace('_', ' ')}
              </span>
              <span className="hidden sm:inline-flex items-center gap-1.5 text-slate-400 font-medium">
                <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
                Authority Portal
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                if (pendingLeavesCount > 0) setTab('leaves');
                else if (actionAdvancesCount > 0) setTab('advances');
                else if (actionStoreCount > 0) setTab('store');
              }}
              className={`inline-flex items-center gap-2 rounded-xl border px-3.5 py-1.5 text-xs font-bold transition shadow-2xs ${
                totalPending > 0
                  ? 'border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100'
                  : 'border-slate-200 bg-slate-50 text-slate-600'
              }`}
            >
              <Bell className={`h-4 w-4 shrink-0 ${totalPending > 0 ? 'text-amber-600 animate-bounce' : 'text-slate-400'}`} />
              <span className="hidden sm:inline">
                {totalPending > 0 ? `${totalPending} New Incoming Requests` : 'All Caught Up'}
              </span>
              <span className="sm:hidden font-mono">
                {totalPending > 0 ? totalPending : '0'}
              </span>
              {totalPending > 0 && (
                <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
              )}
            </button>
          </div>
        </header>

        {/* Content View */}
        <main className="p-3.5 sm:p-8 space-y-4 sm:space-y-6">
          {msg && (
            <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-bold text-emerald-900 shadow-2xs">
              <span>{msg}</span>
              <button onClick={() => setMsg('')} className="text-emerald-700 hover:text-emerald-900">
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* Guarantor Permission Banner if needed */}
          {guarantorRequests.length > 0 && (
            <div className="rounded-xl border border-amber-300 bg-amber-50/80 p-4 shadow-2xs">
              <div className="flex items-center gap-2 text-xs font-bold text-amber-900 uppercase tracking-wide">
                <ShieldCheck className="h-4 w-4 text-amber-600" />
                Guarantor Consent Action Pending
              </div>
              <div className="mt-2 space-y-2">
                {guarantorRequests.map((gr) => {
                  const adv = Array.isArray(gr.advance) ? gr.advance[0] : gr.advance;
                  const app = Array.isArray(adv?.applicant) ? adv.applicant[0] : adv?.applicant;
                  return (
                    <div
                      key={gr.id}
                      className="flex items-center justify-between rounded-lg border border-amber-200 bg-white p-3 text-xs"
                    >
                      <span className="text-slate-800">
                        <strong>{app?.full_name}</strong> requested ₹<strong>{Number(adv?.amount).toLocaleString('en-IN')}</strong> advance and nominated you as Guarantor.
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => respondGuarantorAction(gr.advance_id, currentUser.id, true)}
                          className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white shadow-2xs hover:bg-emerald-700"
                        >
                          Accept
                        </button>
                        <button
                          onClick={() => respondGuarantorAction(gr.advance_id, currentUser.id, false)}
                          className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-700 hover:bg-rose-100"
                        >
                          Decline
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ================= TAB: LEAVES DATA GRID ================= */}
          {tab === 'leaves' && canSeeLeaves && (
            <div className="rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden">
              {/* Header Bar */}
              <div className="flex flex-col gap-3 border-b border-slate-200 bg-slate-50/50 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-sm font-bold text-slate-900">Leave Applications Queue</h2>
                  <p className="text-xs text-slate-500">Manage employee leave requests with instant quota audit</p>
                </div>

                {/* Filter and Search Bar */}
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search name, code, dept..."
                      value={leaveSearch}
                      onChange={(e) => setLeaveSearch(e.target.value)}
                      className="h-8 rounded-lg border border-slate-200 bg-white pl-8 pr-3 text-xs text-slate-800 outline-none focus:border-slate-400"
                    />
                  </div>

                  <div className="flex items-center rounded-lg border border-slate-200 bg-white p-0.5 text-xs font-semibold text-slate-600">
                    <button
                      onClick={() => setFilterStatus('all')}
                      className={`rounded-md px-2.5 py-1 text-xs transition ${
                        filterStatus === 'all' ? 'bg-slate-900 font-bold text-white' : 'hover:text-slate-900'
                      }`}
                    >
                      All ({allLeaves.length})
                    </button>
                    <button
                      onClick={() => setFilterStatus('pending')}
                      className={`rounded-md px-2.5 py-1 text-xs transition ${
                        filterStatus === 'pending' ? 'bg-amber-600 font-bold text-white' : 'hover:text-slate-900'
                      }`}
                    >
                      Pending ({pendingLeavesCount})
                    </button>
                    <button
                      onClick={() => setFilterStatus('resolved')}
                      className={`rounded-md px-2.5 py-1 text-xs transition ${
                        filterStatus === 'resolved' ? 'bg-slate-900 font-bold text-white' : 'hover:text-slate-900'
                      }`}
                    >
                      Resolved
                    </button>
                  </div>
                </div>
              </div>

              {/* Real Data Table Grid */}
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-xs">
                  <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-600">
                    <tr>
                      <th className="px-4 py-3.5">Employee</th>
                      <th className="px-4 py-3.5">Leave Period</th>
                      <th className="px-4 py-3.5">Type & Duration</th>
                      <th className="px-4 py-3.5">Annual Quota</th>
                      <th className="px-4 py-3.5">Reason</th>
                      <th className="px-4 py-3.5 text-center">Status</th>
                      <th className="px-4 py-3.5 text-right">Review Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {filteredLeaves.map((l) => {
                      const totalQuota = Number(l.applicant?.annual_leave_quota || 18);
                      const used = Number(l.applicant?.leaves_used || 0);
                      const remaining = Math.max(0, totalQuota - used);
                      const isDateRange = l.end_date && l.end_date !== l.start_date;

                      return (
                        <tr key={l.id} className="hover:bg-slate-50/70 transition">
                          {/* Col 1: Employee */}
                          <td className="px-4 py-3.5">
                            <div className="flex items-center gap-2.5">
                              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-900 font-bold text-[11px] text-white">
                                {getInitials(l.applicant?.full_name)}
                              </div>
                              <div className="min-w-0">
                                <div className="font-bold text-slate-900 truncate">{l.applicant?.full_name}</div>
                                <div className="text-[11px] text-slate-500 font-mono">
                                  {l.applicant?.emp_code} • {l.applicant?.department}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Col 2: Leave Period */}
                          <td className="px-4 py-3.5 whitespace-nowrap">
                            <div className="flex items-center gap-1.5 font-semibold text-slate-800">
                              <Calendar className="h-3.5 w-3.5 text-slate-400" />
                              <span>{isDateRange ? `${l.start_date} → ${l.end_date}` : l.start_date}</span>
                            </div>
                          </td>

                          {/* Col 3: Type & Duration */}
                          <td className="px-4 py-3.5 whitespace-nowrap">
                            <span className="rounded-md bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700 capitalize border border-blue-200/60">
                              {l.type.replace('_', ' ')} ({l.days_count || 1}d)
                            </span>
                            {l.type === 'short_leave' && l.start_time && (
                              <div className="mt-1 font-mono text-[10px] font-bold text-indigo-600">
                                ⏰ {l.start_time} - {l.end_time}
                              </div>
                            )}
                          </td>

                          {/* Col 4: Annual Quota */}
                          <td className="px-4 py-3.5 whitespace-nowrap">
                            <div className="font-bold text-emerald-700">{remaining} Days Left</div>
                            <div className="text-[10px] text-slate-400 font-medium">Used: {used} of {totalQuota}</div>
                          </td>

                          {/* Col 5: Reason & Attachment */}
                          <td className="px-4 py-3.5 max-w-xs">
                            <div className="space-y-1">
                              <span className="italic text-slate-800 font-medium line-clamp-2" title={l.reason || 'No reason'}>
                                {l.reason ? `“${l.reason}”` : '—'}
                              </span>
                              {l.attachment_url && (
                                <a
                                  href={l.attachment_url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-1 rounded bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-700 hover:bg-indigo-100 border border-indigo-200"
                                >
                                  📎 View Attached Card/Slip
                                </a>
                              )}
                            </div>
                          </td>

                          {/* Col 6: Status */}
                          <td className="px-4 py-3.5 text-center whitespace-nowrap">
                            {statusBadge(l.status)}
                          </td>

                          {/* Col 7: Actions */}
                          <td className="px-4 py-3.5 text-right whitespace-nowrap">
                            {l.status === 'pending' && l.user_id !== currentUser.id ? (
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  onClick={() => {
                                    setActiveAction({ id: l.id, type: 'remark', applicantName: l.applicant?.full_name });
                                    setActionInput('');
                                  }}
                                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 transition active:scale-95"
                                  title="Send Note / Reschedule Advice"
                                >
                                  <MessageSquareText className="h-3.5 w-3.5 text-amber-600" />
                                  <span>Note</span>
                                </button>

                                <button
                                  onClick={() => {
                                    setActiveAction({ id: l.id, type: 'reject', applicantName: l.applicant?.full_name });
                                    setActionInput('');
                                  }}
                                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-50 hover:border-rose-200 transition active:scale-95"
                                  title="Reject with Reason"
                                >
                                  <X className="h-3.5 w-3.5" />
                                  <span>Reject</span>
                                </button>

                                <button
                                  onClick={() => reviewLeaveAction(l.id, currentUser.id, 'approved')}
                                  className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1 text-xs font-bold text-white shadow-2xs hover:bg-emerald-700 transition active:scale-95"
                                >
                                  <Check className="h-3.5 w-3.5" />
                                  <span>Approve</span>
                                </button>
                              </div>
                            ) : l.status === 'approved' && (currentUser.role === 'boss' || currentUser.role === 'hr_mdo') ? (
                              <button
                                onClick={() => setActiveAction({ id: l.id, type: 'revoke', applicantName: l.applicant?.full_name })}
                                className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50/70 px-2.5 py-1 text-[11px] font-semibold text-rose-700 hover:bg-rose-100 transition active:scale-95"
                                title="Click to undo approval and restore employee quota balance"
                              >
                                <RotateCcw className="h-3 w-3" />
                                <span>Revoke Approval</span>
                              </button>
                            ) : (
                              <span className="text-xs text-slate-400 font-medium italic">Reviewed</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}

                    {filteredLeaves.length === 0 && (
                      <tr>
                        <td colSpan={7} className="p-12 text-center">
                          <Calendar className="mx-auto h-8 w-8 text-slate-300" />
                          <p className="mt-2 text-sm font-semibold text-slate-600">No leave requests found</p>
                          <p className="text-xs text-slate-400">All applications have been processed.</p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ================= TAB: ADVANCES ================= */}
          {tab === 'advances' && canSeeAdvances && (
            <div className="rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden">
              <div className="border-b border-slate-200 bg-slate-50/50 p-4">
                <h2 className="text-sm font-bold text-slate-900">Salary Advances & 4-Guarantor Pipeline</h2>
                <p className="text-xs text-slate-500">Track guarantor consents, boss approvals, and payout disbursements</p>
              </div>

              <div className="divide-y divide-slate-100">
                {visibleAdvances.map((a) => (
                  <div key={a.id} className="p-4 flex items-center justify-between gap-4 hover:bg-slate-50/70">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900">{a.applicant?.full_name}</span>
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-600">
                          {a.applicant?.emp_code}
                        </span>
                        <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-bold text-emerald-800">
                          ₹{Number(a.amount).toLocaleString('en-IN')}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500">Reason: {a.reason || 'None'}</p>
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {(a.guarantors || []).map((g: any, i: number) => (
                          <span
                            key={i}
                            className={`rounded px-1.5 py-0.5 text-[10px] font-semibold border ${
                              g.consent_status === 'accepted'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : g.consent_status === 'declined'
                                ? 'bg-rose-50 text-rose-700 border-rose-200'
                                : 'bg-slate-100 text-slate-600 border-slate-200'
                            }`}
                          >
                            {g.guarantor?.full_name || 'Staff'}: {g.consent_status}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                    {statusBadge(a.status)}
                      {a.status === 'pending_boss' && (currentUser.role === 'boss' || currentUser.role === 'hr_mdo') && (
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => bossReviewAdvanceAction(a.id, currentUser.id, true)}
                            className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white shadow-2xs hover:bg-emerald-700"
                            title={currentUser.role === 'boss' ? 'Sanction Payout (Channi Sir Authority)' : 'Emergency HR Acknowledge/Pass'}
                          >
                            {currentUser.role === 'boss' ? 'Sign & Approve' : 'HR Emergency Pass'}
                          </button>
                          <button
                            onClick={() => bossReviewAdvanceAction(a.id, currentUser.id, false)}
                            className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-700 hover:bg-rose-100"
                          >
                            Reject
                          </button>
                        </div>
                      )}
                      {a.status === 'approved_for_accounts' && (currentUser.role === 'accounts' || currentUser.role === 'boss') && (
                        <button
                          onClick={() => accountsSettleAdvanceAction(a.id, currentUser.id)}
                          className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-bold text-white shadow-2xs hover:bg-blue-700"
                        >
                          Mark Paid & Settle
                        </button>
                      )}
                    </div>
                  </div>
                ))}

                {visibleAdvances.length === 0 && (
                  <div className="p-12 text-center text-xs text-slate-400">No active advances in pipeline.</div>
                )}
              </div>
            </div>
          )}

          {/* ================= TAB: STORE ================= */}
          {tab === 'store' && canSeeStore && (
            <div className="rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden">
              <div className="border-b border-slate-200 bg-slate-50/50 p-4">
                <h2 className="text-sm font-bold text-slate-900">Store, Stationery & IT Maintenance</h2>
                <p className="text-xs text-slate-500">Approve uniform allocations, hardware repairs, and stationery requests</p>
              </div>

              <div className="divide-y divide-slate-100">
                {visibleStore.map((s) => (
                  <div key={s.id} className="p-4 flex items-center justify-between gap-4 hover:bg-slate-50/70">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900">{s.title}</span>
                        <span className="rounded bg-purple-50 px-2 py-0.5 text-[10px] font-bold text-purple-700 uppercase">
                          {s.category.replace('_', ' ')}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500">
                        By {s.applicant?.full_name} ({s.applicant?.emp_code}) {s.description && `• ${s.description}`}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      {statusBadge(s.status)}
                      {s.status === 'pending_mdo' && (currentUser.role === 'hr_mdo' || currentUser.role === 'boss') && (
                        <>
                          <button
                            onClick={() => updateStoreStatusAction(s.id, currentUser.id, 'approved_to_store')}
                            className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 shadow-2xs"
                          >
                            Approve → Store
                          </button>
                          <button
                            onClick={() => updateStoreStatusAction(s.id, currentUser.id, 'rejected_by_mdo')}
                            className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-700 hover:bg-rose-100"
                          >
                            Reject
                          </button>
                        </>
                      )}
                      {s.status === 'approved_to_store' && (currentUser.role === 'store' || currentUser.role === 'boss') && (
                        <button
                          onClick={() => updateStoreStatusAction(s.id, currentUser.id, 'issued_completed')}
                          className="rounded-lg bg-purple-600 px-3 py-1.5 text-xs font-bold text-white shadow-2xs hover:bg-purple-700"
                        >
                          Mark Handed Over
                        </button>
                      )}
                    </div>
                  </div>
                ))}

                {visibleStore.length === 0 && (
                  <div className="p-12 text-center text-xs text-slate-400">No store requirements found.</div>
                )}
              </div>
            </div>
          )}

          {/* ================= TAB: STAFF DIRECTORY ================= */}
          {tab === 'staff' && canSeeStaff && (
            <div className="rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden">
              <div className="flex flex-col gap-3 border-b border-slate-200 bg-slate-50/50 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-sm font-bold text-slate-900">SPARA Staff Directory ({filteredStaff.length})</h2>
                  <p className="text-xs text-slate-500">Employee database and dynamic authority assignment</p>
                </div>
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search name, code, dept..."
                    value={staffSearch}
                    onChange={(e) => setStaffSearch(e.target.value)}
                    className="h-8 rounded-lg border border-slate-200 bg-white pl-8 pr-3 text-xs text-slate-800 outline-none focus:border-slate-400"
                  />
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-xs">
                  <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-600">
                    <tr>
                      <th className="px-4 py-3">Employee</th>
                      <th className="px-4 py-3">Department</th>
                      <th className="px-4 py-3">Annual Leaves</th>
                      <th className="px-4 py-3">Guarantor Lock</th>
                      <th className="px-4 py-3">Authority Role</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {filteredStaff.map((s) => (
                      <tr key={s.id} className="hover:bg-slate-50/70">
                        <td className="px-4 py-3">
                          <div className="font-bold text-slate-900">{s.full_name}</div>
                          <div className="font-mono text-[10px] text-slate-400">{s.emp_code}</div>
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {s.department} {s.unit_name ? `• ${s.unit_name}` : ''}
                        </td>
                        <td className="px-4 py-3 font-semibold text-emerald-700">
                          {Number(s.annual_leave_quota) - Number(s.leaves_used)} / {s.annual_leave_quota} Left
                        </td>
                        <td className="px-4 py-3">
                          {s.isLocked ? (
                            <span className="rounded bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-800 border border-amber-200">
                              🔒 Locked
                            </span>
                          ) : (
                            <span className="text-[11px] text-slate-400">Available</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {currentUser.role === 'boss' && s.id !== currentUser.id ? (
                            <select
                              value={s.role}
                              onChange={async (e) => {
                                const res = await updateEmployeeRoleAction(s.id, currentUser.id, e.target.value as any);
                                if (res.success) setMsg(`Authority updated for ${s.full_name}`);
                              }}
                              className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-700"
                            >
                              <option value="staff">Staff (Mobile Only)</option>
                              <option value="hr_mdo">HR / MDO Authority</option>
                              <option value="accounts">Accounts Authority</option>
                              <option value="store">Store Authority</option>
                              <option value="boss">MD / Boss</option>
                            </select>
                          ) : (
                            <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-700">
                              {s.role}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ================= TAB: MY REQUESTS ================= */}
          {tab === 'my' && !isChanniSir && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
                <h3 className="text-sm font-bold text-slate-900">Submit Personal Leave</h3>
                <div className="grid grid-cols-3 gap-2">
                  {(['full_day', 'half_day', 'short_leave'] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => setLeaveType(t)}
                      className={`rounded-lg py-2 text-xs font-bold ${
                        leaveType === t ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {t.replace('_', ' ')}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => {
                      setStartDate(e.target.value);
                      if (!endDate || e.target.value > endDate) setEndDate(e.target.value);
                    }}
                    className="rounded-lg border border-slate-300 p-2 text-xs"
                  />
                  <input
                    type="date"
                    min={startDate}
                    value={endDate || startDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="rounded-lg border border-slate-300 p-2 text-xs"
                  />
                </div>

                <input
                  type="text"
                  placeholder="Reason..."
                  value={leaveReason}
                  onChange={(e) => setLeaveReason(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 p-2 text-xs"
                />

                <button
                  onClick={async () => {
                    const res = await applyLeaveAction({
                      userId: currentUser.id,
                      type: leaveType,
                      startDate,
                      endDate: endDate || startDate,
                      daysCount: leaveType === 'half_day' ? 0.5 : 1,
                      reason: leaveReason,
                    });
                    if (res.success) {
                      setMsg('Personal leave submitted successfully!');
                      setStartDate('');
                      setEndDate('');
                      setLeaveReason('');
                    }
                  }}
                  className="w-full rounded-lg bg-slate-900 py-2.5 text-xs font-bold text-white shadow-xs"
                >
                  Submit Leave Request
                </button>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs space-y-3">
                <h3 className="text-sm font-bold text-slate-900">My Recent Submissions</h3>
                <div className="space-y-2">
                  {myLeaves.map((l) => (
                    <div key={l.id} className="flex items-center justify-between rounded-lg border p-2.5 text-xs">
                      <div>
                        <div className="font-bold">{l.type.replace('_', ' ')} Leave</div>
                        <div className="text-[10px] text-slate-400">{l.start_date}</div>
                      </div>
                      {statusBadge(l.status)}
                    </div>
                  ))}
                  {myLeaves.length === 0 && (
                    <p className="text-xs text-slate-400 italic">No personal requests yet.</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
{/* ================= 5. ENTERPRISE LIVE EVENT TOAST ================= */}
{liveToast && (
  <aside 
    role="alert" 
    aria-live="assertive"
    className="fixed top-5 right-5 z-50 flex w-[440px] max-w-[94vw] flex-col rounded-2xl border border-slate-800 bg-slate-950/95 p-4 text-white shadow-2xl backdrop-blur-xl animate-in slide-in-from-top-4 duration-200 ring-1 ring-white/10"
  >
    {/* Micro status header bar */}
    <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5 mb-3">
      <div className="flex items-center gap-2">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
        </span>
        <span className="text-[10px] font-mono font-bold tracking-widest text-slate-400 uppercase">
          INBOUND DISPATCH EVENT
        </span>
      </div>
      <div className="flex items-center gap-2">
        <span className="rounded bg-slate-800/90 px-1.5 py-0.5 font-mono text-[9px] font-semibold text-slate-300 uppercase">
          {liveToast.type}
        </span>
        <button
          onClick={() => setLiveToast(null)}
          className="rounded-md p-1 text-slate-400 hover:bg-slate-800 hover:text-white transition"
          aria-label="Dismiss notification"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>

    {/* Body content with category icon */}
    <div className="flex items-start gap-3">
      <div
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl font-bold shadow-inner ${
          liveToast.type === 'advance'
            ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
            : liveToast.type === 'leave'
            ? 'bg-sky-500/15 text-sky-400 border border-sky-500/30'
            : 'bg-purple-500/15 text-purple-400 border border-purple-500/30'
        }`}
      >
        {liveToast.type === 'advance' ? (
          <IndianRupee className="h-5 w-5" />
        ) : liveToast.type === 'leave' ? (
          <Calendar className="h-5 w-5" />
        ) : (
          <Package className="h-5 w-5" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <h4 className="text-[11px] font-black tracking-wide text-white uppercase leading-snug">
          {liveToast.title}
        </h4>
        <p className="mt-1 text-xs text-slate-300 leading-relaxed font-normal">
          {liveToast.desc}
        </p>
      </div>
    </div>

    {/* Quick-action trigger */}
    <div className="mt-3.5 flex items-center justify-end gap-2 border-t border-slate-800/60 pt-3">
    <button
                type="button"
                onClick={() => setLiveToast(null)}
                className="rounded-lg px-3 py-1.5 text-[11px] font-semibold text-slate-400 hover:text-white transition"
              >
                Dismiss
              </button>
              <button
                type="button"
                onClick={() => {
                  setTab(liveToast.targetTab);
                  setLiveToast(null);
                }}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-bold text-slate-950 transition active:scale-95 shadow-sm ${
                  liveToast.type === 'advance'
                    ? 'bg-emerald-400 hover:bg-emerald-300'
                    : liveToast.type === 'leave'
                    ? 'bg-sky-400 hover:bg-sky-300'
                    : 'bg-purple-400 hover:bg-purple-300'
                }`}
              >
                <span>Open in {liveToast.targetTab.toUpperCase()}</span>
                <ChevronRight className="h-3 w-3 stroke-[3]" />
              </button>
    </div>
  </aside>
)}
      {/* ================= 3. CLEAN ON-SCREEN DIALOG (POPUP) ================= */}
      {activeAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-100">
            {/* Header */}
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                    activeAction.type === 'remark'
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-rose-100 text-rose-800'
                  }`}
                >
                  {activeAction.type === 'remark' ? (
                    <MessageSquareText className="h-5 w-5" />
                  ) : activeAction.type === 'reject' ? (
                    <AlertTriangle className="h-5 w-5" />
                  ) : (
                    <RotateCcw className="h-5 w-5" />
                  )}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    {activeAction.type === 'remark'
                      ? 'Send Note to Employee'
                      : activeAction.type === 'reject'
                      ? 'Reject Leave Application'
                      : 'Revoke Leave Approval'}
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">{activeAction.applicantName}</p>
                </div>
              </div>
              <button
                onClick={() => setActiveAction(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Revoke Confirmation Content */}
            {activeAction.type === 'revoke' ? (
              <div className="mt-4 space-y-3">
                <div className="rounded-xl border border-rose-200 bg-rose-50/70 p-3.5 text-xs text-slate-700">
                  <p className="font-bold text-rose-900">Confirmation Required</p>
                  <p className="mt-1">
                    Are you sure you want to revoke the approval for <strong>{activeAction.applicantName}</strong>?
                  </p>
                  <ul className="mt-2 list-disc list-inside space-y-1 text-slate-600">
                    <li>The leave request will be marked as <strong>Pending</strong> (Wapas review queue me chali jayegi).</li>
                    <li>The deducted leave quota will be <strong>restored immediately</strong>.</li>
                    <li>Employee ko alert jayega ki unki application dobara pending me hai.</li>
                  </ul>
                </div>
              </div>
            ) : (
              /* Remark / Reject Input Form */
              <>
                <div className="mt-4">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Quick 1-Click Suggestions:
                  </label>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {(activeAction.type === 'remark'
                      ? [
                          'Abhi mat lo, next week aage le lena.',
                          'Pehle cabin me aakar milo.',
                          'Is date pe staff shortage hai, reschedule karo.',
                          'Project handover complete karo pehle.',
                        ]
                      : [
                          'Critical client delivery scheduled on this date.',
                          'Leave quota exhausted for this period.',
                          'Too many team members already away.',
                          'Short notice without handover.',
                        ]
                    ).map((chip) => (
                      <button
                        key={chip}
                        type="button"
                        onClick={() => setActionInput(chip)}
                        className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-100"
                      >
                        + {chip}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mt-3">
                  <textarea
                    rows={3}
                    value={actionInput}
                    onChange={(e) => setActionInput(e.target.value)}
                    placeholder={
                      activeAction.type === 'remark'
                        ? 'Write message for employee...'
                        : 'Specify rejection reason...'
                    }
                    className="w-full rounded-xl border border-slate-300 p-2.5 text-xs text-slate-900 outline-none focus:border-slate-900"
                  />
                </div>
              </>
            )}

            {/* Footer Buttons */}
            <div className="mt-5 flex items-center justify-end gap-2 border-t border-slate-100 pt-3">
              <button
                onClick={() => setActiveAction(null)}
                className="rounded-lg border border-slate-200 px-3.5 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>

              {activeAction.type === 'remark' && (
                <button
                  disabled={!actionInput.trim()}
                  onClick={async () => {
                    const res = await sendLeaveRemarkAction(activeAction.id, currentUser.id, actionInput);
                    if (res.success) {
                      setMsg(`Message sent to ${activeAction.applicantName}.`);
                      setActiveAction(null);
                    }
                  }}
                  className="rounded-lg bg-amber-600 px-3.5 py-2 text-xs font-bold text-white shadow-2xs hover:bg-amber-700 disabled:opacity-50"
                >
                  Send Note
                </button>
              )}

              {activeAction.type === 'reject' && (
                <button
                  disabled={!actionInput.trim()}
                  onClick={async () => {
                    const res = await reviewLeaveAction(activeAction.id, currentUser.id, 'rejected', actionInput);
                    if (res.success) {
                      setMsg(`Leave application rejected for ${activeAction.applicantName}.`);
                      setActiveAction(null);
                    }
                  }}
                  className="rounded-lg bg-rose-600 px-3.5 py-2 text-xs font-bold text-white shadow-2xs hover:bg-rose-700 disabled:opacity-50"
                >
                  Confirm Rejection
                </button>
              )}

              {activeAction.type === 'revoke' && (
                <button
                  onClick={async () => {
                    const res = await revertLeaveApprovalAction(activeAction.id, currentUser.id);
                    if (res.success) {
                      setMsg(`Approval revoked and quota restored for ${activeAction.applicantName}.`);
                      setActiveAction(null);
                    }
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-4 py-2 text-xs font-bold text-white shadow-2xs hover:bg-rose-700"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>Confirm Revocation</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
      {/* ================= 4. LOGOUT CONFIRMATION MODAL ================= */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl border border-slate-100">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-100 text-rose-700">
                <LogOut className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Confirm Logout</h3>
                <p className="text-xs text-slate-500">End your current authority session</p>
              </div>
            </div>

            <p className="mt-3.5 text-xs text-slate-600">
              Are you sure you want to log out of the SPARA Authority Portal?
            </p>

            <div className="mt-5 flex items-center justify-end gap-2 border-t border-slate-100 pt-3.5">
              <button
                type="button"
                onClick={() => setShowLogoutConfirm(false)}
                className="rounded-lg border border-slate-200 px-3.5 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => logoutAction()}
                className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-4 py-2 text-xs font-bold text-white shadow-2xs hover:bg-rose-700 transition active:scale-95"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span>Log Out</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}