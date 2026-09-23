import React, { useState, useEffect } from 'react';
import { X, Plus, CheckCircle2, AlertCircle } from 'lucide-react';
import { Client, CommunicationMethod, ServiceCall, UserProfile } from '../../types';
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
  const [clients, setClients] = useState<Client[]>([]);

  const [selectedClientId, setSelectedClientId] = useState('');
  const [clientQuery, setClientQuery] = useState('');
  const [isClientDropdownOpen, setIsClientDropdownOpen] = useState(false);
  const [isCreatingClient, setIsCreatingClient] = useState(false);
  const [newClientName, setNewClientName] = useState('');
  const [newClientPhone, setNewClientPhone] = useState('');
  const [newClientAddress, setNewClientAddress] = useState('');

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
    api.getClients().then(setClients);

    const presetCall = presetServiceCallId ? serviceCalls.find((c) => c.id === presetServiceCallId) : null;
    setSelectedClientId(presetCall?.clientId || '');
    setClientQuery(presetCall?.client?.name || '');
    setIsClientDropdownOpen(false);
    setIsCreatingClient(false);
    setNewClientName('');
    setNewClientPhone('');
    setNewClientAddress('');
    setDateReceived(new Date().toISOString().split('T')[0]);
    setMethod('phone');
    setHandledBy(currentUser.id);
    setSummary('');
    setError('');
  }, [isOpen, presetServiceCallId, serviceCalls, currentUser.id]);

  if (!isOpen) return null;

  const trimmedClientQuery = clientQuery.trim();
  const filteredClients = trimmedClientQuery
    ? clients.filter((c) => c.name.toLowerCase().includes(trimmedClientQuery.toLowerCase()))
    : clients;

  const handleSelectClient = (client: Client) => {
    setSelectedClientId(client.id);
    setClientQuery(client.name);
    setIsClientDropdownOpen(false);
    setIsCreatingClient(false);
  };

  const handleStartCreatingClient = () => {
    setIsCreatingClient(true);
    setNewClientName(trimmedClientQuery);
    setIsClientDropdownOpen(false);
    setSelectedClientId('');
  };

  const handleSearchExistingClient = () => {
    setIsCreatingClient(false);
    setNewClientName('');
    setNewClientPhone('');
    setNewClientAddress('');
  };

  const canSubmit = presetServiceCallId
    ? true
    : isCreatingClient
    ? !!newClientName.trim()
    : !!selectedClientId;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!summary.trim()) {
      setError('A summary of the communication is required.');
      return;
    }
    if (!canSubmit) {
      setError('Please provide the client this ticket is about.');
      return;
    }

    setError('');
    setIsSubmitting(true);
    try {
      let finalClientId = selectedClientId;
      if (!presetServiceCallId && isCreatingClient) {
        const client = await api.createClient({
          name: newClientName.trim(),
          phone: newClientPhone.trim() || undefined,
          address: newClientAddress.trim() || undefined,
        });
        finalClientId = client.id;
      }

      await api.createCommunication({
        clientId: finalClientId,
        serviceCallId: presetServiceCallId || null,
        dateReceived,
        method,
        handledBy,
        summary: summary.trim(),
      });
      onSuccess();
      onClose();
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
          {presetServiceCallId ? (
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[#3A424B] mb-1">
                About Job
              </label>
              <div className="w-full text-xs p-2.5 bg-[#F0F2F0] border border-[#DFE2DE] rounded-lg font-medium text-[#3A424B]">
                {(() => {
                  const call = serviceCalls.find((c) => c.id === presetServiceCallId);
                  return call ? `#${call.jobNumber} — ${call.client?.name || 'Customer'}` : 'Selected job';
                })()}
              </div>
              <p className="text-[10px] text-[#6B7A88] mt-1">
                Logged from this job's page, so it'll stay linked to it.
              </p>
            </div>
          ) : (
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-bold uppercase tracking-wider text-[#3A424B]">
                  Client <span className="text-red-500">*</span>
                </label>
                {isCreatingClient && clients.length > 0 && (
                  <button
                    type="button"
                    onClick={handleSearchExistingClient}
                    className="text-xs text-[#0F5CC4] font-semibold hover:underline"
                  >
                    Search existing instead
                  </button>
                )}
              </div>

              {isCreatingClient ? (
                <div className="p-3 bg-[#FBFBF9] rounded-xl border border-[#DFE2DE] space-y-2.5">
                  <input
                    type="text"
                    autoFocus
                    placeholder="Client Full Name (e.g. Jason Kole (Phase 1))"
                    value={newClientName}
                    onChange={(e) => setNewClientName(e.target.value)}
                    className="w-full text-xs p-2.5 bg-white border border-[#DFE2DE] rounded-lg focus:border-[#0F5CC4] outline-none"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      placeholder="Phone (e.g. 555-412-8832)"
                      value={newClientPhone}
                      onChange={(e) => setNewClientPhone(e.target.value)}
                      className="text-xs p-2 bg-white border border-[#DFE2DE] rounded-lg focus:border-[#0F5CC4] outline-none"
                    />
                    <input
                      type="text"
                      placeholder="Address (e.g. Newton, MA)"
                      value={newClientAddress}
                      onChange={(e) => setNewClientAddress(e.target.value)}
                      className="text-xs p-2 bg-white border border-[#DFE2DE] rounded-lg focus:border-[#0F5CC4] outline-none"
                    />
                  </div>
                </div>
              ) : (
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Type a client name to search..."
                    value={clientQuery}
                    onChange={(e) => {
                      setClientQuery(e.target.value);
                      setSelectedClientId('');
                      setIsClientDropdownOpen(true);
                    }}
                    onBlur={() => setTimeout(() => setIsClientDropdownOpen(false), 150)}
                    className="w-full text-xs p-2.5 bg-white border border-[#DFE2DE] rounded-lg focus:border-[#0F5CC4] outline-none font-medium"
                  />
                  {isClientDropdownOpen && trimmedClientQuery && (
                    <div className="absolute z-10 mt-1 w-full max-h-56 overflow-y-auto bg-white border border-[#DFE2DE] rounded-lg shadow-lg">
                      {filteredClients.length > 0 ? (
                        filteredClients.map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => handleSelectClient(c)}
                            className="w-full text-left px-3 py-2 text-xs hover:bg-[#FBFBF9] border-b border-[#DFE2DE] last:border-b-0"
                          >
                            <span className="font-medium text-[#12161A]">{c.name}</span>
                            {(c.phone || c.address) && (
                              <span className="block text-[10px] text-[#6B7A88]">
                                {[c.phone, c.address].filter(Boolean).join(' • ')}
                              </span>
                            )}
                          </button>
                        ))
                      ) : (
                        <div className="px-3 py-2 text-xs text-[#6B7A88]">No matching clients.</div>
                      )}
                      <button
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={handleStartCreatingClient}
                        className="w-full text-left px-3 py-2 text-xs font-semibold text-[#0F5CC4] hover:bg-[#0F5CC4]/5 flex items-center gap-1.5 border-t border-[#DFE2DE]"
                      >
                        <Plus className="w-3.5 h-3.5 shrink-0" />
                        <span>
                          {trimmedClientQuery ? `Create new client "${trimmedClientQuery}"` : 'Create new client'}
                        </span>
                      </button>
                    </div>
                  )}
                </div>
              )}
              <p className="text-[10px] text-[#6B7A88] mt-1">
                This ticket is logged for the client directly — it won't create or touch any work order.
              </p>
            </div>
          )}

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
              disabled={isSubmitting || !canSubmit}
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
