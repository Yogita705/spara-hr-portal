import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { supabaseAdmin } from '@/lib/supabase/server';
import AdminDashboard from '@/components/AdminDashboard';

export default async function DashboardPage() {
  const cookieStore = await cookies();
  const userId = cookieStore.get('spara_user_id')?.value;
  if (!userId) redirect('/login');

  const { data: currentUser } = await supabaseAdmin
    .from('employees')
    .select('*')
    .eq('id', userId)
    .single();

  if (!currentUser || currentUser.role === 'staff') redirect('/');

  const [
    { data: allLeaves },
    { data: allAdvances },
    { data: allStore },
    { data: staffList },
    { data: activeLocks },
    { data: myLeaves },
    { data: myStore },
    { data: guarantorRequests },
  ] = await Promise.all([
    supabaseAdmin
      .from('leave_requests')
      .select('*, applicant:employees!leave_requests_user_id_fkey(full_name, emp_code, department, annual_leave_quota, leaves_used)')
      .order('created_at', { ascending: false })
      .limit(50),
    supabaseAdmin
      .from('advance_requests')
      .select('*, applicant:employees!advance_requests_user_id_fkey(full_name, emp_code, department), guarantors:advance_guarantors(consent_status, guarantor:employees(full_name))')
      .order('created_at', { ascending: false })
      .limit(50),
    supabaseAdmin
      .from('store_requests')
      .select('*, applicant:employees!store_requests_user_id_fkey(full_name, emp_code, department)')
      .order('created_at', { ascending: false })
      .limit(50),
    supabaseAdmin.from('employees').select('*').eq('is_active', true).order('emp_code'),
    supabaseAdmin.from('advance_guarantors').select('guarantor_user_id').eq('is_active_lock', true),
    supabaseAdmin.from('leave_requests').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
    supabaseAdmin.from('store_requests').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
    supabaseAdmin
      .from('advance_guarantors')
      .select('*, advance:advance_requests(id, amount, reason, applicant:employees!advance_requests_user_id_fkey(full_name, emp_code))')
      .eq('guarantor_user_id', userId)
      .eq('consent_status', 'pending'),
  ]);

  const lockedSet = new Set((activeLocks || []).map((l) => l.guarantor_user_id));
  const staffDirectory = (staffList || []).map((s) => ({ ...s, isLocked: lockedSet.has(s.id) }));

  return (
    <AdminDashboard
      currentUser={currentUser}
      allLeaves={allLeaves || []}
      allAdvances={allAdvances || []}
      allStore={allStore || []}
      staffDirectory={staffDirectory}
      myLeaves={myLeaves || []}
      myStore={myStore || []}
      guarantorRequests={guarantorRequests || []}
    />
  );
}