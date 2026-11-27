import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { supabaseAdmin } from '@/lib/supabase/server';
import MobileStaffView from '@/components/MobileStaffView';

export default async function HomePage() {
  const cookieStore = await cookies();
  const userId = cookieStore.get('spara_user_id')?.value;
  if (!userId) redirect('/login');

  const { data: currentUser } = await supabaseAdmin
    .from('employees')
    .select('*')
    .eq('id', userId)
    .single();

  if (!currentUser) redirect('/login');

  const [
    { data: employees },
    { data: activeLocks },
    { data: myLeaves },
    { data: myAdvances },
    { data: myStoreRequests },
    { data: guarantorRequests },
    { data: notifications },
  ] = await Promise.all([
    supabaseAdmin.from('employees').select('id, full_name, emp_code, department').eq('is_active', true).order('full_name'),
    supabaseAdmin.from('advance_guarantors').select('guarantor_user_id').eq('is_active_lock', true),
    supabaseAdmin.from('leave_requests').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
    supabaseAdmin.from('advance_requests').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
    supabaseAdmin.from('store_requests').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
    supabaseAdmin
      .from('advance_guarantors')
      .select('id, advance_id, advance:advance_requests!advance_guarantors_advance_id_fkey(amount, applicant:employees!advance_requests_user_id_fkey(full_name))')
      .eq('guarantor_user_id', userId)
      .eq('consent_status', 'pending')
      .eq('is_active_lock', true),
    supabaseAdmin.from('notifications').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(20),
  ]);

  const lockedSet = new Set((activeLocks || []).map((l) => l.guarantor_user_id));
  const formattedEmployees = (employees || []).map((e) => ({
    ...e,
    isLocked: lockedSet.has(e.id),
  }));

  return (
    <MobileStaffView
      currentUser={currentUser}
      allEmployees={formattedEmployees}
      myLeaves={myLeaves || []}
      myAdvances={myAdvances || []}
      myStoreRequests={myStoreRequests || []}
      guarantorRequests={guarantorRequests || []}
      notifications={notifications || []}
    />
  );
}