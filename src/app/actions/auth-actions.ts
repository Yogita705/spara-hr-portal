'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { supabaseAdmin } from '@/lib/supabase/server';

export async function loginWithPinAction(empCode: string, pin: string) {
  const cleanCode = empCode.trim().toUpperCase();

  const { data: emp, error } = await supabaseAdmin
    .from('employees')
    .select('id, emp_code, full_name, role, pin_code, is_active')
    .eq('emp_code', cleanCode)
    .single();

    if (error) {
        return { error: `DB Error: ${error.message} (key starts: ${process.env.SUPABASE_SERVICE_ROLE_KEY?.slice(0, 5)})` };
      }
      if (!emp || !emp.is_active) {
        return { error: `Employee "${cleanCode}" not found or inactive.` };
      }
  if (emp.pin_code !== pin.trim()) {
    return { error: 'Wrong PIN. Default PIN is 1234.' };
  }

  const cookieStore = await cookies();
  cookieStore.set('spara_user_id', emp.id, {
    httpOnly: true,
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });

  if (emp.role === 'staff') redirect('/');
  redirect('/dashboard');
}

export async function logoutAction() {
  const cookieStore = await cookies();
  cookieStore.delete('spara_user_id');
  redirect('/login');
}