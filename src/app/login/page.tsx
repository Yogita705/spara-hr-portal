'use client';

import { useState, type FormEvent } from 'react';
import { loginWithPinAction } from '@/app/actions/auth-actions';

export default function LoginPage() {
  const [empCode, setEmpCode] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    const res = await loginWithPinAction(empCode, pin);
    if (res?.error) {
      setError(res.error);
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-900 p-4">
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-5 rounded-3xl bg-white p-6 shadow-xl">
        <div className="text-center">
          <p className="text-xs font-bold uppercase tracking-widest text-emerald-600">SPARA CORPORATION</p>
          <h1 className="mt-1 text-2xl font-extrabold text-slate-900">HR & Operations Login</h1>
          <p className="mt-1 text-xs text-slate-500">Enter your Employee ID & 4-Digit PIN</p>
        </div>

        {error && <div className="rounded-xl bg-rose-100 p-3 text-center text-xs font-bold text-rose-800">{error}</div>}

        <div>
          <label className="mb-1 block text-xs font-bold text-slate-600">Employee ID</label>
          <input
            type="text"
            placeholder="e.g. SP-033 or MD-001"
            value={empCode}
            onChange={(e) => setEmpCode(e.target.value)}
            required
            className="w-full rounded-xl border border-slate-300 p-3.5 text-base font-bold uppercase text-slate-900 outline-none focus:border-slate-900"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-bold text-slate-600">4-Digit PIN</label>
          <input
            type="password"
            inputMode="numeric"
            maxLength={6}
            placeholder="Default: 1234"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            required
            className="w-full rounded-xl border border-slate-300 p-3.5 text-base font-bold tracking-widest text-slate-900 outline-none focus:border-slate-900"
          />
        </div>

        <button
          disabled={loading}
          className="w-full rounded-xl bg-slate-900 py-4 text-base font-bold text-white active:scale-95 disabled:opacity-60"
        >
          {loading ? 'Opening...' : 'Login'}
        </button>
      </form>
    </div>
  );
}