import React, { useEffect, useState } from 'react';
import { X, AlertCircle, CheckCircle2, KeyRound, Eye, EyeOff } from 'lucide-react';
import { UserProfile, UserRole } from '../../types';
import * as api from '../../lib/api';

interface EditTeamMemberModalProps {
  member: UserProfile | null;
  onClose: () => void;
  onSaved: () => void;
}

export const EditTeamMemberModal: React.FC<EditTeamMemberModalProps> = ({ member, onClose, onSaved }) => {
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<UserRole>('installer');
  const [isSavingDetails, setIsSavingDetails] = useState(false);
  const [detailsError, setDetailsError] = useState('');
  const [detailsSaved, setDetailsSaved] = useState(false);

  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSettingPassword, setIsSettingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordSet, setPasswordSet] = useState(false);

  useEffect(() => {
    if (!member) return;
    setFullName(member.fullName);
    setPhone(member.phone || '');
    setRole(member.role);
    setDetailsError('');
    setDetailsSaved(false);
    setNewPassword('');
    setShowPassword(false);
    setPasswordError('');
    setPasswordSet(false);
  }, [member]);

  if (!member) return null;

  const handleSaveDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) {
      setDetailsError('Full name is required.');
      return;
    }
    setDetailsError('');
    setIsSavingDetails(true);
    try {
      await api.updateTeamMember(member.id, { fullName, phone, role });
      setDetailsSaved(true);
      setTimeout(() => setDetailsSaved(false), 3000);
      onSaved();
    } catch (err: any) {
      setDetailsError(err.message || 'Failed to save changes.');
    } finally {
      setIsSavingDetails(false);
    }
  };

  const handleSetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      setPasswordError('Password must be at least 6 characters.');
      return;
    }
    setPasswordError('');
    setIsSettingPassword(true);
    try {
      await api.adminSetPassword(member.id, newPassword);
      setPasswordSet(true);
      setNewPassword('');
      setTimeout(() => setPasswordSet(false), 4000);
    } catch (err: any) {
      setPasswordError(err.message || 'Failed to set password.');
    } finally {
      setIsSettingPassword(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden border border-[#DFE2DE]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#DFE2DE] bg-[#FBFBF9]">
          <div>
            <h3 className="text-base font-semibold text-[#12161A]">{member.fullName}</h3>
            <p className="text-xs text-[#6B7A88]">{member.email}</p>
          </div>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Profile details */}
        <form onSubmit={handleSaveDetails} className="p-5 space-y-3 border-b border-[#DFE2DE]">
          <h4 className="text-xs font-bold uppercase tracking-wider text-[#3A424B]">Profile</h4>

          <div>
            <label className="block text-[11px] font-semibold text-[#3A424B] mb-1">Full Name</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full text-xs p-2.5 bg-[#FBFBF9] border border-[#DFE2DE] rounded-lg focus:border-[#0F5CC4] outline-none"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-[#3A424B] mb-1">Phone</label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="(555) 123-4567"
              className="w-full text-xs p-2.5 bg-[#FBFBF9] border border-[#DFE2DE] rounded-lg focus:border-[#0F5CC4] outline-none"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-[#3A424B] mb-1">Role</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as UserRole)}
              className="w-full text-xs p-2.5 bg-[#FBFBF9] border border-[#DFE2DE] rounded-lg focus:border-[#0F5CC4] outline-none font-medium"
            >
              <option value="installer">Installer</option>
              <option value="office">Office</option>
              <option value="admin">Admin</option>
            </select>
          </div>

          {detailsError && (
            <p className="text-xs text-red-600 font-medium flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{detailsError}</span>
            </p>
          )}

          <button
            type="submit"
            disabled={isSavingDetails}
            className="w-full py-2.5 bg-[#12161A] hover:bg-[#3A424B] text-white text-xs font-bold rounded-lg disabled:opacity-50 transition-colors flex items-center justify-center gap-1.5"
          >
            {detailsSaved ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Saved</span>
              </>
            ) : (
              <span>{isSavingDetails ? 'Saving…' : 'Save Changes'}</span>
            )}
          </button>
        </form>

        {/* Password reset */}
        <form onSubmit={handleSetPassword} className="p-5 space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-[#3A424B] flex items-center gap-1.5">
            <KeyRound className="w-3.5 h-3.5 text-[#0F5CC4]" />
            <span>Set New Password</span>
          </h4>
          <p className="text-[11px] text-[#6B7A88] leading-relaxed">
            Sets the password immediately — no email is sent. Share it with{' '}
            {member.fullName.split(' ')[0]} directly.
          </p>

          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="At least 6 characters"
              className="w-full text-xs p-2.5 pr-9 bg-[#FBFBF9] border border-[#DFE2DE] rounded-lg focus:border-[#0F5CC4] outline-none"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-2.5 top-2.5 text-gray-400 hover:text-gray-600"
            >
              {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            </button>
          </div>

          {passwordError && (
            <p className="text-xs text-red-600 font-medium flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{passwordError}</span>
            </p>
          )}
          {passwordSet && (
            <p className="text-xs text-emerald-700 font-medium flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              <span>Password updated.</span>
            </p>
          )}

          <button
            type="submit"
            disabled={isSettingPassword || !newPassword}
            className="w-full py-2.5 bg-[#0F5CC4] hover:bg-[#0E52B0] text-white text-xs font-bold rounded-lg disabled:opacity-50 transition-colors"
          >
            {isSettingPassword ? 'Setting…' : 'Set Password'}
          </button>
        </form>
      </div>
    </div>
  );
};
