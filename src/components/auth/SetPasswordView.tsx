import React, { useState } from 'react';
import { Lock, AlertCircle, ShieldCheck } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface SetPasswordViewProps {
  mode: 'invite' | 'recovery';
  onDone: () => void;
}

/**
 * Shown right after a crew member follows their invite link (or a
 * password-reset link) — before they can reach any portal screen. Until
 * they set a real password here, the only way back in is by clicking the
 * same one-time link again, which is what "no way to log back in" meant.
 */
export const SetPasswordView: React.FC<SetPasswordViewProps> = ({ mode, onDone }) => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setIsSubmitting(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw new Error(updateError.message);
      onDone();
    } catch (err: any) {
      setError(err.message || 'Failed to set password. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FBFBF9] flex flex-col justify-center py-12 sm:px-6 lg:px-8 font-sans">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="inline-flex w-14 h-14 rounded-2xl bg-[#12161A] text-white items-center justify-center font-bold text-xl mb-3 shadow-md">
          EB
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-[#12161A]">
          {mode === 'invite' ? 'Welcome to Everlast Bathrooms' : 'Reset Your Password'}
        </h1>
        <p className="mt-1 text-sm text-[#6B7A88]">
          {mode === 'invite'
            ? 'Set a password to finish creating your account.'
            : 'Choose a new password for your account.'}
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-lg px-4 sm:px-0">
        <div className="bg-white py-8 px-6 shadow-xl border border-[#DFE2DE] rounded-2xl sm:px-10">
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[#3A424B] mb-1.5">
                New Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-[#6B7A88] absolute left-3 top-3" />
                <input
                  type="password"
                  required
                  autoFocus
                  placeholder="At least 8 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full text-xs pl-9 pr-3 py-2.5 bg-[#FBFBF9] border border-[#DFE2DE] rounded-xl focus:border-[#0F5CC4] outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[#3A424B] mb-1.5">
                Confirm Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-[#6B7A88] absolute left-3 top-3" />
                <input
                  type="password"
                  required
                  placeholder="Re-enter password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
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
              className="w-full py-3 bg-[#0F5CC4] hover:bg-[#0E52B0] text-white text-xs font-bold rounded-xl shadow-xs transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>{isSubmitting ? 'Saving…' : 'Set Password & Continue'}</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
