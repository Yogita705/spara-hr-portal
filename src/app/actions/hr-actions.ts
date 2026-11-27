'use server';

import { revalidatePath } from 'next/cache';
import { supabaseAdmin } from '@/lib/supabase/server';

export async function applyLeaveAction(formData: {
  userId: string;
  type: 'full_day' | 'half_day' | 'short_leave';
  startDate: string;
  endDate: string;
  daysCount: number;
  reason: string;
}) {
  if (!formData.startDate) return { error: 'Please select a date.' };

  const { error } = await supabaseAdmin.from('leave_requests').insert({
    user_id: formData.userId,
    type: formData.type,
    start_date: formData.startDate,
    end_date: formData.endDate || formData.startDate,
    days_count: formData.daysCount,
    reason: formData.reason,
  });

  if (error) return { error: error.message };
  revalidatePath('/');
  revalidatePath('/dashboard');
  return { success: true };
}

export async function reviewLeaveAction(
  leaveId: string,
  reviewerId: string,
  decision: 'approved' | 'rejected',
  remarks?: string
) {
  const { data: reviewer } = await supabaseAdmin.from('employees').select('role').eq('id', reviewerId).single();
  if (!reviewer || !['hr_mdo', 'boss'].includes(reviewer.role)) {
    return { error: 'Only MDO or Boss can approve/reject leaves.' };
  }

  // 1. Fetch leave request details
  const { data: leave, error: fetchErr } = await supabaseAdmin
    .from('leave_requests')
    .select('id, user_id, days_count, status')
    .eq('id', leaveId)
    .single();

  if (fetchErr || !leave) return { error: 'Leave request not found.' };
  if (leave.status !== 'pending') return { error: 'This request has already been reviewed.' };

  // 2. ONLY cut leaves quota if decision is APPROVED (Rejected will NOT cut any quota)
  if (decision === 'approved') {
    const { data: emp } = await supabaseAdmin
      .from('employees')
      .select('leaves_used')
      .eq('id', leave.user_id)
      .single();

    if (emp) {
      const newUsed = Number(emp.leaves_used || 0) + Number(leave.days_count || 1);
      await supabaseAdmin
        .from('employees')
        .update({ leaves_used: newUsed })
        .eq('id', leave.user_id);
    }
  }

  // 3. Update leave request status & remarks
  const { error } = await supabaseAdmin
    .from('leave_requests')
    .update({
      status: decision,
      remarks: remarks || null,
      reviewed_by: reviewerId,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', leaveId);

  if (error) return { error: error.message };

  // 4. Send structured enterprise notification to employee
  await supabaseAdmin.from('notifications').insert({
    user_id: leave.user_id,
    title: decision === 'approved' ? '🟢 Leave Sanctioned' : '🔴 Leave Not Approved',
    message: decision === 'approved' 
      ? `Leave sanctioned for ${leave.days_count || 1} day(s). Balance adjusted in annual quota.` 
      : `Application could not be approved.${remarks ? ` Management note: "${remarks}"` : ' Please check with HR/MDO.'}`,
  });

  revalidatePath('/dashboard');
  revalidatePath('/');
  return { success: true };
}

export async function applyAdvanceAction(formData: {
  userId: string;
  amount: number;
  reason: string;
  guarantorIds: string[];
}) {
  if (!formData.amount || formData.amount <= 0) return { error: 'Enter valid amount.' };

  const { data, error } = await supabaseAdmin.rpc('create_advance_with_guarantors', {
    p_user_id: formData.userId,
    p_amount: formData.amount,
    p_reason: formData.reason,
    p_guarantor_ids: formData.guarantorIds,
  });

  if (error) return { error: error.message };
  revalidatePath('/');
  return { success: true, advanceId: data };
}

export async function respondGuarantorAction(
  advanceId: string,
  guarantorId: string,
  accept: boolean
) {
  const { error } = await supabaseAdmin.rpc('respond_guarantor_consent', {
    p_advance_id: advanceId,
    p_guarantor_id: guarantorId,
    p_accept: accept,
  });

  if (error) return { error: error.message };
  revalidatePath('/');
  revalidatePath('/dashboard');
  return { success: true };
}

export async function bossReviewAdvanceAction(
  advanceId: string,
  bossId: string,
  approve: boolean,
  remarks?: string
) {
  const { data: boss } = await supabaseAdmin.from('employees').select('role').eq('id', bossId).single();
  if (!boss || boss.role !== 'boss') {
    return { error: 'Only Boss (Prabh Sir / MD) can approve advances.' };
  }

  const newStatus = approve ? 'approved_for_accounts' : 'rejected_by_boss';

  const { data: adv, error } = await supabaseAdmin
    .from('advance_requests')
    .update({
      status: newStatus,
      boss_approved_by: bossId,
      boss_approved_at: new Date().toISOString(),
      remarks: remarks || null,
    })
    .eq('id', advanceId)
    .select('user_id, amount')
    .single();

  if (error) return { error: error.message };

  if (!approve) {
    await supabaseAdmin
      .from('advance_guarantors')
      .update({ is_active_lock: false })
      .eq('advance_id', advanceId);
  }

  await supabaseAdmin.from('notifications').insert({
    user_id: adv.user_id,
    title: approve ? '💳 Advance Sanctioned by MD' : '❌ Advance Request Rejected',
    message: approve
      ? `Executive approval granted for ₹${Number(adv.amount).toLocaleString('en-IN')}. Dispatched to Accounts Desk for payout clearance.`
      : `Advance of ₹${Number(adv.amount).toLocaleString('en-IN')} was rejected.${remarks ? ` Reason: "${remarks}"` : ''} Guarantor locks released.`,
  });

  revalidatePath('/dashboard');
  revalidatePath('/');
  return { success: true };
}

export async function accountsSettleAdvanceAction(advanceId: string, accountsUserId: string) {
  const { data: acc } = await supabaseAdmin.from('employees').select('role').eq('id', accountsUserId).single();
  if (!acc || !['accounts', 'boss'].includes(acc.role)) {
    return { error: 'Only Accounts or Boss can settle advances.' };
  }

  const { data: adv, error } = await supabaseAdmin
    .from('advance_requests')
    .update({
      status: 'paid_settled',
      accounts_settled_by: accountsUserId,
      accounts_settled_at: new Date().toISOString(),
    })
    .eq('id', advanceId)
    .select('user_id, amount')
    .single();

  if (error) return { error: error.message };

  await supabaseAdmin
    .from('advance_guarantors')
    .update({ is_active_lock: false })
    .eq('advance_id', advanceId);

    await supabaseAdmin.from('notifications').insert({
      user_id: adv.user_id,
      title: '💰 Payout Disbursed & Settled',
      message: `Amount ₹${Number(adv.amount).toLocaleString('en-IN')} has been settled by Accounts. All 4 guarantor liabilities have been released.`,
    });

  revalidatePath('/dashboard');
  revalidatePath('/');
  return { success: true };
}

export async function createStoreRequestAction(formData: {
  userId: string;
  category: 'uniform' | 'stationery' | 'laptop_repair' | 'tools_other';
  title: string;
  description: string;
}) {
  if (!formData.title.trim()) return { error: 'Please enter what you need.' };

  const { error } = await supabaseAdmin.from('store_requests').insert({
    user_id: formData.userId,
    category: formData.category,
    title: formData.title,
    description: formData.description,
  });

  if (error) return { error: error.message };
  revalidatePath('/');
  revalidatePath('/dashboard');
  return { success: true };
}

export async function updateStoreStatusAction(
  requestId: string,
  actorId: string,
  nextStatus: 'approved_to_store' | 'rejected_by_mdo' | 'issued_completed'
) {
  const { data: actor } = await supabaseAdmin.from('employees').select('role').eq('id', actorId).single();
  const allowedRoles = nextStatus === 'issued_completed' ? ['store', 'boss'] : ['hr_mdo', 'boss'];
  if (!actor || !allowedRoles.includes(actor.role)) {
    return { error: 'You are not authorized for this store action.' };
  }

  const payload =
    nextStatus === 'issued_completed'
      ? { status: nextStatus, store_completed_by: actorId, store_completed_at: new Date().toISOString() }
      : { status: nextStatus, mdo_reviewed_by: actorId, mdo_reviewed_at: new Date().toISOString() };

  const { data: req, error } = await supabaseAdmin
    .from('store_requests')
    .update(payload)
    .eq('id', requestId)
    .select('user_id, title')
    .single();

  if (error) return { error: error.message };

  const msgMap = {
    approved_to_store: `MDO approved "${req.title}". Sent to Store (Sarabjot) for handover.`,
    rejected_by_mdo: `Your request "${req.title}" was rejected by MDO.`,
    issued_completed: `Your item "${req.title}" is ready / issued by Store!`,
  };

  await supabaseAdmin.from('notifications').insert({
    user_id: req.user_id,
    title: 'Store Request Update',
    message: msgMap[nextStatus],
  });

  revalidatePath('/dashboard');
  revalidatePath('/');
  return { success: true };
}

export async function markNotificationsReadAction(userId: string) {
  await supabaseAdmin
    .from('notifications')
    .update({ is_read: true })
    .eq('user_id', userId)
    .eq('is_read', false);
  revalidatePath('/');
}
export async function updateEmployeeRoleAction(
  targetUserId: string,
  actorId: string,
  newRole: 'staff' | 'hr_mdo' | 'boss' | 'store' | 'accounts'
) {
  const { data: actor } = await supabaseAdmin
    .from('employees')
    .select('role')
    .eq('id', actorId)
    .single();

  if (!actor || actor.role !== 'boss') {
    return { error: 'Only MD can change authority roles.' };
  }

  const { error } = await supabaseAdmin
    .from('employees')
    .update({ role: newRole })
    .eq('id', targetUserId);

  if (error) return { error: error.message };
  revalidatePath('/dashboard');
  return { success: true };
}
export async function sendLeaveRemarkAction(
  leaveId: string,
  reviewerId: string,
  remark: string
) {
  if (!remark?.trim()) return { error: 'Please enter a remark/message.' };

  const { data: reviewer } = await supabaseAdmin
    .from('employees')
    .select('full_name, role')
    .eq('id', reviewerId)
    .single();

  if (!reviewer || !['hr_mdo', 'boss'].includes(reviewer.role)) {
    return { error: 'Only MDO or Boss can add remarks.' };
  }

  // Update remarks column
  const { data: leave, error } = await supabaseAdmin
    .from('leave_requests')
    .update({ remarks: remark })
    .eq('id', leaveId)
    .select('user_id')
    .single();

  if (error) return { error: error.message };

  // Send direct alert to employee mobile view
  await supabaseAdmin.from('notifications').insert({
    user_id: leave.user_id,
    title: `HR Message (${reviewer.full_name})`,
    message: `Regarding your leave: "${remark}"`,
  });

  revalidatePath('/dashboard');
  revalidatePath('/');
  return { success: true };
}
export async function revertLeaveApprovalAction(
  leaveId: string,
  actorId: string,
  reason: string = 'Approval revoked by management by mistake'
) {
  // 1. Check authority
  const { data: actor } = await supabaseAdmin
    .from('employees')
    .select('full_name, role')
    .eq('id', actorId)
    .single();

  if (!actor || !['hr_mdo', 'boss'].includes(actor.role)) {
    return { error: 'Only MDO or Boss can revoke approvals.' };
  }

  // 2. Fetch the approved leave
  const { data: leave, error: fetchErr } = await supabaseAdmin
    .from('leave_requests')
    .select('*')
    .eq('id', leaveId)
    .single();

  if (fetchErr || !leave) return { error: 'Leave request not found.' };
  if (leave.status !== 'approved') return { error: 'Only approved leaves can be revoked.' };

  // 3. Refund used quota back to the employee
  const { data: emp } = await supabaseAdmin
    .from('employees')
    .select('leaves_used')
    .eq('id', leave.user_id)
    .single();

  if (emp) {
    const daysToRefund = Number(leave.days_count || 1);
    const newUsed = Math.max(0, Number(emp.leaves_used || 0) - daysToRefund);
    await supabaseAdmin
      .from('employees')
      .update({ leaves_used: newUsed })
      .eq('id', leave.user_id);
  }

  // 4. Update leave status
  await supabaseAdmin
    .from('leave_requests')
    .update({
      status: 'rejected',
      remarks: reason,
    })
    .eq('id', leaveId);

  // Alert employee
  await supabaseAdmin.from('notifications').insert({
    user_id: leave.user_id,
    title: 'Leave Approval Revoked',
    message: `${actor.full_name} has revoked the approval for your leave (${leave.start_date}). Your leave quota has been restored.`,
  });

  revalidatePath('/dashboard');
  revalidatePath('/');
  return { success: true };
}