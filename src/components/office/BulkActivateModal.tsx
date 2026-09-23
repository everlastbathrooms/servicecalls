import React, { useEffect, useState } from 'react';
import { X, KeyRound, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { UserRole } from '../../types';

interface UnactivatedMember {
  id: string;
  fullName: string;
  email: string;
  role: UserRole;
}

interface BulkActivateModalProps {
  isOpen: boolean;
  members: UnactivatedMember[];
  onClose: () => void;
  onActivate: (password: string) => Promise<void>;
}

export const BulkActivateModal: React.FC<BulkActivateModalProps> = ({
  isOpen,
  members,
  onClose,
  onActivate,
}) => {
  const [password, setPassword] = useState('everlast123');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setPassword('everlast123');
    setShowPassword(false);
    setIsSubmitting(false);
    setError('');
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    setError('');
    setIsSubmitting(true);
    try {
      await onActivate(password);
    } catch (err: any) {
      setError(err.message || 'Failed to activate accounts.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden border border-[#DFE2DE] max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#DFE2DE] bg-[#FBFBF9]">
          <div>
            <h2 className="text-lg font-bold text-[#12161A]">Activate Unconfirmed Accounts</h2>
            <p className="text-xs text-[#3A424B]">
              Sets the same password immediately for everyone below — no email is sent.
            </p>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-700 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="px-6 py-2.5 bg-red-50 border-b border-red-200 text-xs text-red-700 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-[#3A424B] mb-2">
              Never signed in ({members.length})
            </label>
            <div className="max-h-40 overflow-y-auto rounded-lg border border-[#DFE2DE] divide-y divide-[#DFE2DE]">
              {members.map((m) => (
                <div key={m.id} className="px-3 py-2 text-xs flex items-center justify-between">
                  <div>
                    <span className="font-semibold text-[#12161A]">{m.fullName}</span>
                    <span className="block text-[10px] text-[#6B7A88]">{m.email}</span>
                  </div>
                  <span className="text-[10px] uppercase font-semibold text-[#6B7A88]">{m.role}</span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-[#3A424B] mb-1">
              Password to set for all of them
            </label>
            <div className="relative">
              <KeyRound className="absolute left-3 top-2.5 w-4 h-4 text-[#6B7A88]" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-9 pr-9 py-2.5 text-xs bg-white border border-[#DFE2DE] rounded-lg focus:border-[#0F5CC4] outline-none font-mono"
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                className="absolute right-2.5 top-2 p-0.5 text-[#6B7A88] hover:text-[#12161A]"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-[10px] text-[#6B7A88] mt-1">
              Share it with them directly and ask them to change it after logging in.
            </p>
          </div>

          <div className="pt-2 flex items-center justify-end gap-3">
            <button type="button" onClick={onClose} className="px-4 py-2 text-xs font-semibold text-[#3A424B] hover:text-[#12161A]">
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || members.length === 0}
              className="px-6 py-2.5 bg-[#0F5CC4] hover:bg-[#0E52B0] text-white font-bold rounded-xl text-xs flex items-center gap-2 shadow-sm disabled:opacity-50 transition-colors"
            >
              <KeyRound className="w-4 h-4" />
              <span>{isSubmitting ? 'Activating…' : `Activate ${members.length} Account${members.length === 1 ? '' : 's'}`}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
