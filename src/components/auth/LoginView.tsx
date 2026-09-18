import React, { useState } from 'react';
import { Lock, Mail, AlertCircle, CheckCircle2 } from 'lucide-react';
import { UserProfile } from '../../types';
import { signIn, requestPasswordReset } from '../../lib/api';

interface LoginViewProps {
  onLogin: (user: UserProfile) => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [mode, setMode] = useState<'login' | 'forgot'>('login');
  const [resetMessage, setResetMessage] = useState('');
  const [isSendingReset, setIsSendingReset] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);
    try {
      const user = await signIn(email.trim(), password);
      onLogin(user);
    } catch (err: any) {
      setError(err.message || 'Unable to sign in. Check your email and password.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setResetMessage('');
    setIsSendingReset(true);
    try {
      await requestPasswordReset(email.trim());
      setResetMessage('If an account exists for that email, a reset link is on its way.');
    } catch (err: any) {
      setError(err.message || 'Failed to send reset email.');
    } finally {
      setIsSendingReset(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FBFBF9] flex flex-col justify-center py-12 sm:px-6 lg:px-8 font-sans">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="inline-flex w-14 h-14 rounded-2xl bg-[#12161A] text-white items-center justify-center font-bold text-xl mb-3 shadow-md">
          EB
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-[#12161A]">
          EVERLAST BATHROOMS
        </h1>
        <p className="mt-1 text-sm text-[#6B7A88]">
          Service Call Dispatch &amp; Field Crew Portal
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-lg px-4 sm:px-0">
        <div className="bg-white py-8 px-6 shadow-xl border border-[#DFE2DE] rounded-2xl sm:px-10">
          {mode === 'login' ? (
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#3A424B] mb-1.5">
                  Work Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-[#6B7A88] absolute left-3 top-3" />
                  <input
                    type="email"
                    required
                    placeholder="name@everlastbathrooms.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full text-xs pl-9 pr-3 py-2.5 bg-[#FBFBF9] border border-[#DFE2DE] rounded-xl focus:border-[#0F5CC4] outline-none"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#3A424B]">
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setMode('forgot');
                      setError('');
                      setResetMessage('');
                    }}
                    className="text-xs text-[#0F5CC4] font-semibold hover:underline"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-[#6B7A88] absolute left-3 top-3" />
                  <input
                    type="password"
                    required
                    placeholder="••••••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full text-xs pl-9 pr-3 py-2.5 bg-[#FBFBF9] border border-[#DFE2DE] rounded-xl focus:border-[#0F5CC4] outline-none"
                  />
                </div>
              </div>

              {error && (
                <p className="text-xs text-red-600 font-medium flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{error}</span>
                </p>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3 bg-[#0F5CC4] hover:bg-[#0E52B0] text-white text-xs font-bold rounded-xl shadow-xs transition-colors disabled:opacity-60"
              >
                {isSubmitting ? 'Signing in…' : 'Sign In to Service Portal'}
              </button>
            </form>
          ) : (
            <form className="space-y-4" onSubmit={handleForgotSubmit}>
              <p className="text-xs text-[#6B7A88] leading-relaxed">
                Enter your work email and we'll send a link to set a new password.
              </p>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#3A424B] mb-1.5">
                  Work Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-[#6B7A88] absolute left-3 top-3" />
                  <input
                    type="email"
                    required
                    placeholder="name@everlastbathrooms.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full text-xs pl-9 pr-3 py-2.5 bg-[#FBFBF9] border border-[#DFE2DE] rounded-xl focus:border-[#0F5CC4] outline-none"
                  />
                </div>
              </div>

              {error && (
                <p className="text-xs text-red-600 font-medium flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{error}</span>
                </p>
              )}
              {resetMessage && (
                <p className="text-xs text-emerald-700 font-medium flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  <span>{resetMessage}</span>
                </p>
              )}

              <button
                type="submit"
                disabled={isSendingReset}
                className="w-full py-3 bg-[#0F5CC4] hover:bg-[#0E52B0] text-white text-xs font-bold rounded-xl shadow-xs transition-colors disabled:opacity-60"
              >
                {isSendingReset ? 'Sending…' : 'Send Reset Link'}
              </button>

              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setError('');
                  setResetMessage('');
                }}
                className="w-full py-1 text-xs font-medium text-[#6B7A88] hover:text-[#12161A]"
              >
                Back to sign in
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
