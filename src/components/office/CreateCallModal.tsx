import React, { useState, useEffect } from 'react';
import { X, Plus, Upload, Camera, Film, Trash2, AlertCircle, CheckCircle2, Mail } from 'lucide-react';
import { BillingType, CallPriority, Client, Responsibility, UserProfile } from '../../types';
import * as api from '../../lib/api';
import { formatBytes } from '../../lib/utils';

interface CreateCallModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (newCallId: string) => void;
}

interface PendingFile {
  id: string;
  file: File;
}

export const CreateCallModal: React.FC<CreateCallModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [clients, setClients] = useState<Client[]>([]);
  const [installers, setInstallers] = useState<UserProfile[]>([]);

  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [isCreatingClient, setIsCreatingClient] = useState(false);
  const [newClientName, setNewClientName] = useState('');
  const [newClientPhone, setNewClientPhone] = useState('');
  const [newClientAddress, setNewClientAddress] = useState('');

  const [jobNumber, setJobNumber] = useState('');
  const [installerId, setInstallerId] = useState<string>('');
  const [reportedDate, setReportedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [installDate, setInstallDate] = useState<string>('');
  const [priority, setPriority] = useState<CallPriority>('mid');
  const [responsibility, setResponsibility] = useState<Responsibility>('installer');
  const [billing, setBilling] = useState<BillingType>('unpaid');
  const [description, setDescription] = useState('');

  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (!isOpen) return;

    // Wipe any leftover input from the last time this call was created,
    // since the modal stays mounted (just hidden) between opens.
    setSelectedClientId('');
    setIsCreatingClient(false);
    setNewClientName('');
    setNewClientPhone('');
    setNewClientAddress('');
    setJobNumber('');
    setInstallerId('');
    setReportedDate(new Date().toISOString().split('T')[0]);
    setInstallDate('');
    setPriority('mid');
    setResponsibility('installer');
    setBilling('unpaid');
    setDescription('');
    setPendingFiles([]);
    setErrorMessage('');

    api.getClients().then((data) => {
      setClients(data);
      setIsCreatingClient(data.length === 0);
      if (data.length > 0) setSelectedClientId(data[0].id);
    });
    api.getActiveInstallers().then((data) => {
      setInstallers(data);
      if (data.length > 0) setInstallerId(data[0].id);
    });
  }, [isOpen]);

  if (!isOpen) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newFiles: PendingFile[] = [];
    Array.from(files).forEach((file: File) => {
      if (file.size > 104857600) {
        alert(`File ${file.name} exceeds the 100 MB limit.`);
        return;
      }
      newFiles.push({ id: `${file.name}-${file.size}-${Math.random().toString(36).slice(2, 8)}`, file });
    });

    setPendingFiles((prev) => [...prev, ...newFiles]);
  };

  const removeFile = (id: string) => {
    setPendingFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!jobNumber.trim()) {
      setErrorMessage('Job number is required.');
      return;
    }

    let finalClientId = selectedClientId;

    setErrorMessage('');
    setIsSubmitting(true);

    try {
      if (isCreatingClient) {
        if (!newClientName.trim()) {
          throw new Error('Please provide the client name.');
        }
        const client = await api.createClient({
          name: newClientName.trim(),
          phone: newClientPhone.trim() || undefined,
          address: newClientAddress.trim() || undefined,
        });
        finalClientId = client.id;
      }

      if (!finalClientId) throw new Error('Please provide or select a client name.');
      if (!description.trim()) throw new Error('Issue description is required.');

      const createdCall = await api.createServiceCall({
        jobNumber: jobNumber.trim(),
        clientId: finalClientId,
        installerId: installerId || null,
        reportedDate,
        installDate: installDate || null,
        priority,
        responsibility,
        billing,
        description: description.trim(),
      });

      for (const pending of pendingFiles) {
        await api.uploadAttachment({ callId: createdCall.id, file: pending.file, phase: 'reported' });
      }

      setIsSubmitting(false);
      onSuccess(createdCall.id);
      onClose();
    } catch (err: any) {
      setIsSubmitting(false);
      setErrorMessage(err.message || 'Failed to create service call');
    }
  };

  const selectedInstaller = installers.find((i) => i.id === installerId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="w-full max-w-4xl bg-white rounded-2xl shadow-2xl overflow-hidden border border-[#DFE2DE] max-h-[92vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#DFE2DE] bg-[#FBFBF9]">
          <div>
            <h2 className="text-lg font-bold text-[#12161A]">Create New Service Call</h2>
            <p className="text-xs text-[#3A424B]">
              Logged from office computer • Assigns crew and dispatches automatic email notification
            </p>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-700 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMessage && (
          <div className="px-6 py-2.5 bg-red-50 border-b border-red-200 text-xs text-red-700 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
            <div className="md:col-span-7 space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#3A424B]">
                    Client <span className="text-red-500">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsCreatingClient(!isCreatingClient)}
                    className="text-xs text-[#0F5CC4] font-semibold hover:underline flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{isCreatingClient ? 'Select existing' : 'Create new client'}</span>
                  </button>
                </div>

                {isCreatingClient ? (
                  <div className="p-3 bg-[#FBFBF9] rounded-xl border border-[#DFE2DE] space-y-2.5">
                    <input
                      type="text"
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
                  <select
                    value={selectedClientId}
                    onChange={(e) => setSelectedClientId(e.target.value)}
                    className="w-full text-xs p-2.5 bg-white border border-[#DFE2DE] rounded-lg focus:border-[#0F5CC4] outline-none font-medium"
                  >
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} {c.phone ? `(${c.phone})` : ''} {c.address ? `• ${c.address}` : ''}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#3A424B] mb-1">
                    Job # <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 1537"
                    value={jobNumber}
                    onChange={(e) => setJobNumber(e.target.value)}
                    className="w-full text-xs p-2.5 bg-white border border-[#DFE2DE] rounded-lg focus:border-[#0F5CC4] outline-none font-mono font-bold tabular-nums"
                  />
                  <span className="text-[10px] text-[#6B7A88] mt-0.5 block">Non-unique ref #</span>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#3A424B] mb-1">
                    Reported Date
                  </label>
                  <input
                    type="date"
                    required
                    value={reportedDate}
                    onChange={(e) => setReportedDate(e.target.value)}
                    className="w-full text-xs p-2.5 bg-white border border-[#DFE2DE] rounded-lg focus:border-[#0F5CC4] outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#3A424B] mb-1">
                    Install Date
                  </label>
                  <input
                    type="date"
                    value={installDate}
                    onChange={(e) => setInstallDate(e.target.value)}
                    className="w-full text-xs p-2.5 bg-white border border-[#DFE2DE] rounded-lg focus:border-[#0F5CC4] outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#3A424B] mb-1">
                  Assign to Crew / Installer <span className="text-red-500">*</span>
                </label>
                <select
                  value={installerId}
                  onChange={(e) => setInstallerId(e.target.value)}
                  className="w-full text-xs p-2.5 bg-white border border-[#DFE2DE] rounded-lg focus:border-[#0F5CC4] outline-none font-medium"
                >
                  <option value="">-- Leave Unassigned --</option>
                  {installers.map((inst) => (
                    <option key={inst.id} value={inst.id}>
                      {inst.fullName} ({inst.email})
                    </option>
                  ))}
                </select>
                {selectedInstaller && (
                  <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-[#0F5CC4] bg-[#0F5CC4]/5 p-2 rounded-lg border border-[#0F5CC4]/15">
                    <Mail className="w-3.5 h-3.5 shrink-0" />
                    <span>
                      An automatic notification email will be sent immediately to{' '}
                      <strong>{selectedInstaller.email}</strong>.
                    </span>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#3A424B] mb-1">
                    Priority
                  </label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as CallPriority)}
                    className="w-full text-xs p-2.5 bg-white border border-[#DFE2DE] rounded-lg focus:border-[#0F5CC4] outline-none font-bold uppercase"
                  >
                    <option value="high">High (Red)</option>
                    <option value="mid">Mid (Amber)</option>
                    <option value="low">Low (Slate)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#3A424B] mb-1">
                    Responsibility
                  </label>
                  <select
                    value={responsibility}
                    onChange={(e) => setResponsibility(e.target.value as Responsibility)}
                    className="w-full text-xs p-2.5 bg-white border border-[#DFE2DE] rounded-lg focus:border-[#0F5CC4] outline-none capitalize"
                  >
                    <option value="installer">Installer</option>
                    <option value="office">Office</option>
                    <option value="manufacturer">Manufacturer</option>
                    <option value="client">Client</option>
                    <option value="unknown">Unknown</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#3A424B] mb-1">
                    Billing Status
                  </label>
                  <select
                    value={billing}
                    onChange={(e) => setBilling(e.target.value as BillingType)}
                    className="w-full text-xs p-2.5 bg-white border border-[#DFE2DE] rounded-lg focus:border-[#0F5CC4] outline-none capitalize"
                  >
                    <option value="unpaid">Unpaid</option>
                    <option value="paid">Paid</option>
                    <option value="undecided">Undecided</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#3A424B] mb-1">
                  Issue Description <span className="text-red-500">*</span>
                </label>
                <textarea
                  required
                  rows={4}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe the complaint in detail: what is leaking, loose, broken, or needs adjustment..."
                  className="w-full text-xs p-3 bg-white border border-[#DFE2DE] rounded-lg focus:border-[#0F5CC4] outline-none resize-none leading-relaxed"
                />
              </div>
            </div>

            <div className="md:col-span-5 flex flex-col justify-between border-t md:border-t-0 md:border-l border-[#DFE2DE] md:pl-6 pt-4 md:pt-0">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#3A424B]">
                    Client Photos &amp; Videos
                  </label>
                  <span className="text-[11px] text-[#6B7A88]">Up to 100 MB</span>
                </div>
                <p className="text-xs text-[#6B7A88]">
                  Upload customer-submitted photos or short video clips. These will be viewable on the installer&apos;s phone.
                </p>

                <label className="border-2 border-dashed border-[#DFE2DE] hover:border-[#0F5CC4] rounded-xl p-6 flex flex-col items-center justify-center cursor-pointer transition-colors bg-[#FBFBF9]">
                  <input type="file" accept="image/*,video/*" multiple className="hidden" onChange={handleFileUpload} />
                  <div className="w-12 h-12 rounded-full bg-[#0F5CC4]/10 text-[#0F5CC4] flex items-center justify-center mb-2">
                    <Upload className="w-6 h-6" />
                  </div>
                  <span className="text-xs font-bold text-[#0F5CC4]">Click to browse or drop files</span>
                  <span className="text-[11px] text-[#6B7A88] mt-1 text-center">JPG, PNG, MP4, MOV up to 100 MB</span>
                </label>

                {pendingFiles.length > 0 && (
                  <div className="space-y-2 mt-3 max-h-56 overflow-y-auto pr-1">
                    {pendingFiles.map((p) => (
                      <div key={p.id} className="flex items-center justify-between p-2.5 bg-[#FBFBF9] rounded-lg border border-[#DFE2DE] text-xs">
                        <div className="flex items-center gap-2.5 truncate">
                          {p.file.type.startsWith('video/') ? (
                            <Film className="w-4 h-4 text-[#0F5CC4] shrink-0" />
                          ) : (
                            <Camera className="w-4 h-4 text-[#0F5CC4] shrink-0" />
                          )}
                          <div className="truncate">
                            <p className="font-medium text-[#12161A] truncate">{p.file.name}</p>
                            <p className="text-[10px] text-[#6B7A88]">{formatBytes(p.file.size)}</p>
                          </div>
                        </div>
                        <button type="button" onClick={() => removeFile(p.id)} className="p-1 text-gray-400 hover:text-red-600 rounded">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="mt-4 p-3 bg-[#F0F2F0] rounded-xl text-[11px] text-[#3A424B] border border-[#DFE2DE]">
                <strong>Database Isolation:</strong> Only the assigned crew ({selectedInstaller?.fullName || 'Selected Installer'}) will be able to view this call on their phone portal.
              </div>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-[#DFE2DE] flex items-center justify-end gap-3">
            <button type="button" onClick={onClose} className="px-4 py-2 text-xs font-semibold text-[#3A424B] hover:text-[#12161A]">
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2.5 bg-[#0F5CC4] hover:bg-[#0E52B0] text-white font-bold rounded-xl text-xs flex items-center gap-2 shadow-sm disabled:opacity-50 transition-colors"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{isSubmitting ? 'Creating...' : 'Create & Dispatch Call'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
