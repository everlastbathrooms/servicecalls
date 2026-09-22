import React, { useState, useEffect, useMemo } from 'react';
import { X, CheckCircle2, AlertCircle } from 'lucide-react';
import { CommunicationMethod, ServiceCall, UserProfile } from '../../types';
import * as api from '../../lib/api';

interface CreateCommunicationModalProps {
  isOpen: boolean;
  currentUser: UserProfile;
  serviceCalls: ServiceCall[];
  presetServiceCallId?: string | null;
  onClose: () => void;
  onSuccess: () => void;
}

export const CreateCommunicationModal: React.FC<CreateCommunicationModalProps> = ({
  isOpen,
  currentUser,
  serviceCalls,
  presetServiceCallId,
  onClose,
  onSuccess,
}) => {
  const [team, setTeam] = useState<UserProfile[]>([]);
  const [serviceCallId, setServiceCallId] = useState('');
  const [dateReceived, setDateReceived] = useState(new Date().toISOString().split('T')[0]);
  const [method, setMethod] = useState<CommunicationMethod>('phone');
  const [handledBy, setHandledBy] = useState(currentUser.id);
  const [summary, setSummary] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    api.getAllTeamMembers().then((members) => {
      setTeam(members.filter((m) => m.role === 'admin' || m.role === 'office'));
    });
    setServiceCallId(presetServiceCallId || serviceCalls[0]?.id || '');
  }, [isOpen, presetServiceCallId, serviceCalls]);

  const sortedCalls = useMemo(
    () =>
      [...serviceCalls].sort(
        (a, b) => new Date(b.reportedDate).getTime() - new Date(a.reportedDate).getTime()
      ),
    [serviceCalls]
  );

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!serviceCallId) {
      setError('Please select the job this communication is about.');
      return;
    }
    if (!summary.trim()) {
      setError('A summary of the communication is required.');
      return;
    }

    setError('');
    setIsSubmitting(true);
    try {
      await api.createCommunication({
        serviceCallId,
        dateReceived,
        method,
        handledBy,
        summary: summary.trim(),
      });
      onSuccess();
      onClose();
      setSummary('');
      setMethod('phone');
      setHandledBy(currentUser.id);
    } catch (err: any) {
      setError(err.message || 'Failed to log communication.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden border border-[#DFE2DE] max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#DFE2DE] bg-[#FBFBF9]">
          <div>
            <h2 className="text-lg font-bold text-[#12161A]">Log Customer Service Ticket</h2>
            <p className="text-xs text-[#3A424B]">Internal only — office &amp; admin, no email is sent for this.</p>
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
            <label className="block text-xs font-bold uppercase tracking-wider text-[#3A424B] mb-1">
              Job <span className="text-red-500">*</span>
            </label>
            <select
              required
              value={serviceCallId}
              onChange={(e) => setServiceCallId(e.target.value)}
              disabled={!!presetServiceCallId}
              className="w-full text-xs p-2.5 bg-white border border-[#DFE2DE] rounded-lg focus:border-[#0F5CC4] outline-none font-medium disabled:bg-[#F0F2F0] disabled:text-[#6B7A88]"
            >
              {sortedCalls.length === 0 && <option value="">No service calls yet</option>}
              {sortedCalls.map((c) => (
                <option key={c.id} value={c.id}>
                  #{c.jobNumber} — {c.client?.name || 'Customer'}
                </option>
              ))}
            </select>
            <p className="text-[10px] text-[#6B7A88] mt-1">
              Every communication is tied to a job — pick the one this contact is about.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[#3A424B] mb-1">
                Date Received
              </label>
              <input
                type="date"
                required
                value={dateReceived}
                onChange={(e) => setDateReceived(e.target.value)}
                className="w-full text-xs p-2.5 bg-white border border-[#DFE2DE] rounded-lg focus:border-[#0F5CC4] outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[#3A424B] mb-1">
                Method
              </label>
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value as CommunicationMethod)}
                className="w-full text-xs p-2.5 bg-white border border-[#DFE2DE] rounded-lg focus:border-[#0F5CC4] outline-none font-medium"
              >
                <option value="phone">Phone</option>
                <option value="email">Email</option>
                <option value="text">Text</option>
                <option value="in_person">In Person</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[#3A424B] mb-1">
                Handled By
              </label>
              <select
                value={handledBy}
                onChange={(e) => setHandledBy(e.target.value)}
                className="w-full text-xs p-2.5 bg-white border border-[#DFE2DE] rounded-lg focus:border-[#0F5CC4] outline-none font-medium"
              >
                {team.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.fullName}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-[#3A424B] mb-1">
              Summary <span className="text-red-500">*</span>
            </label>
            <textarea
              required
              rows={4}
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="What did the customer say/report?"
              className="w-full text-xs p-3 bg-white border border-[#DFE2DE] rounded-lg focus:border-[#0F5CC4] outline-none resize-none leading-relaxed"
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-3">
            <button type="button" onClick={onClose} className="px-4 py-2 text-xs font-semibold text-[#3A424B] hover:text-[#12161A]">
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !serviceCallId}
              className="px-6 py-2.5 bg-[#0F5CC4] hover:bg-[#0E52B0] text-white font-bold rounded-xl text-xs flex items-center gap-2 shadow-sm disabled:opacity-50 transition-colors"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{isSubmitting ? 'Saving…' : 'Log Ticket'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
