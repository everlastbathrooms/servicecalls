import React, { useState } from 'react';
import {
  ArrowLeft,
  Phone,
  Mail,
  MapPin,
  Calendar,
  AlertCircle,
  Paperclip,
  CheckCircle2,
  Upload,
  UserCheck,
  Play,
  MessageSquare,
  DollarSign,
  Share2,
  Trash2,
} from 'lucide-react';
import {
  Attachment,
  BillingType,
  CallPriority,
  CallStatus,
  Responsibility,
  ServiceCall,
  UserProfile,
} from '../../types';
import {
  formatDate,
  formatRelativeDate,
  getPriorityBorderColor,
  getStatusBadge,
} from '../../lib/utils';
import { MediaLightbox } from '../common/MediaLightbox';

interface CallDetailOfficeProps {
  call: ServiceCall;
  installers: UserProfile[];
  currentUser: UserProfile;
  onBack: () => void;
  onUpdateCall: (callId: string, updates: Partial<ServiceCall>) => void;
  onAddNote: (callId: string, body: string, visibility: 'shared' | 'internal') => void;
  onUploadAttachment: (callId: string, file: File) => void;
  onDeleteCall: (callId: string) => void;
}

export const CallDetailOffice: React.FC<CallDetailOfficeProps> = ({
  call,
  installers,
  currentUser,
  onBack,
  onUpdateCall,
  onAddNote,
  onUploadAttachment,
  onDeleteCall,
}) => {
  const [activeLightboxMedia, setActiveLightboxMedia] = useState<Attachment | null>(null);

  // Edit states
  const [selectedInstallerId, setSelectedInstallerId] = useState(call.installerId || '');
  const [selectedPriority, setSelectedPriority] = useState(call.priority);
  const [selectedResponsibility, setSelectedResponsibility] = useState(call.responsibility);
  const [selectedBilling, setSelectedBilling] = useState(call.billing);
  const [selectedStatus, setSelectedStatus] = useState(call.status);
  const [isSaved, setIsSaved] = useState(false);

  // Note states
  const [noteBody, setNoteBody] = useState('');
  const [noteVisibility, setNoteVisibility] = useState<'shared' | 'internal'>('shared');

  const priorityColor = getPriorityBorderColor(call.priority);
  const statusBadge = getStatusBadge(call.status);
  const isAdmin = currentUser.role === 'admin';

  const reportedAttachments = (call.attachments || []).filter((a) => a.phase === 'reported');
  const resolutionAttachments = (call.attachments || []).filter((a) => a.phase === 'resolution');

  const handleSaveEdits = () => {
    onUpdateCall(call.id, {
      installerId: selectedInstallerId || null,
      priority: selectedPriority,
      responsibility: selectedResponsibility,
      billing: selectedBilling,
      status: selectedStatus,
    });
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
  };

  const handlePostNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteBody.trim()) return;
    onAddNote(call.id, noteBody.trim(), noteVisibility);
    setNoteBody('');
  };

  const handleDeleteClick = () => {
    const confirmed = window.confirm(
      `Permanently delete Work Order #${call.jobNumber} for ${call.client?.name || 'this customer'}?\n\n` +
        'This cannot be undone — all photos, videos, and notes on this call will be deleted too.'
    );
    if (confirmed) {
      onDeleteCall(call.id);
    }
  };

  const handleUploadOfficeMedia = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach((file: File) => {
      onUploadAttachment(call.id, file);
    });
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Breadcrumb */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-[#DFE2DE] shadow-xs">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 text-[#3A424B] hover:text-[#12161A] hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono font-bold text-sm bg-[#12161A] text-white px-2.5 py-0.5 rounded-md tabular-nums">
                JOB #{call.jobNumber}
              </span>
              <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${statusBadge.bg} ${statusBadge.text}`}>
                {statusBadge.label}
              </span>
            </div>
            <h1 className="text-xl font-bold text-[#12161A] mt-1">
              {call.client?.name || 'Customer'}
            </h1>
          </div>
        </div>

        {/* Quick action buttons */}
        <div className="flex items-center gap-2">
          {isSaved && (
            <span className="text-xs text-emerald-700 font-semibold flex items-center gap-1">
              <CheckCircle2 className="w-4 h-4" /> Changes saved
            </span>
          )}
          {isAdmin && (
            <button
              onClick={handleDeleteClick}
              title="Delete this work order permanently"
              className="p-2 text-red-600 hover:text-white hover:bg-red-600 rounded-lg border border-red-200 hover:border-red-600 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={handleSaveEdits}
            className="px-4 py-2 bg-[#0F5CC4] hover:bg-[#0E52B0] text-white text-xs font-bold rounded-lg shadow-xs transition-colors"
          >
            Save Changes
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (8 cols): Details, Attachments, Notes */}
        <div className="lg:col-span-8 space-y-6">
          {/* Issue Card */}
          <div className="bg-white p-5 rounded-xl border border-[#DFE2DE] shadow-xs">
            <h2 className="text-xs font-bold uppercase tracking-wider text-[#3A424B] mb-2 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-[#0F5CC4]" />
              <span>Reported Issue Description</span>
            </h2>
            <div className="text-sm font-medium text-[#12161A] bg-[#FBFBF9] p-4 rounded-lg border-l-4 border-[#0F5CC4] leading-relaxed">
              {call.description}
            </div>

            {call.completionNote && (
              <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs">
                <span className="font-bold text-amber-900 block mb-1">
                  {call.status === 'blocked' ? 'Blocked Reason Note (from crew):' : 'Completion Note:'}
                </span>
                <p className="text-amber-800 leading-relaxed">{call.completionNote}</p>
                {call.completedByName && (
                  <p className="text-[10px] text-amber-700 mt-1">
                    Recorded by {call.completedByName} on {formatDate(call.completedAt)}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Photos & Videos Section */}
          <div className="bg-white p-5 rounded-xl border border-[#DFE2DE] shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xs font-bold uppercase tracking-wider text-[#3A424B] flex items-center gap-2">
                  <Paperclip className="w-4 h-4 text-[#0F5CC4]" />
                  <span>Media Attachments</span>
                </h2>
                <p className="text-xs text-[#6B7A88] mt-0.5">
                  Photos and video clips sent to crew phone
                </p>
              </div>

              <label className="px-3 py-1.5 bg-[#F0F2F0] hover:bg-[#DFE2DE] text-[#12161A] rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors">
                <Upload className="w-3.5 h-3.5" />
                <span>Upload Media</span>
                <input
                  type="file"
                  accept="image/*,video/*"
                  multiple
                  className="hidden"
                  onChange={handleUploadOfficeMedia}
                />
              </label>
            </div>

            {/* Reported Attachments */}
            <div className="mb-4">
              <span className="text-xs font-semibold text-[#6B7A88] block mb-2">
                Reported by Customer ({reportedAttachments.length})
              </span>
              {reportedAttachments.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {reportedAttachments.map((att) => (
                    <div
                      key={att.id}
                      onClick={() => setActiveLightboxMedia(att)}
                      className="group relative aspect-4/3 rounded-lg overflow-hidden border border-[#DFE2DE] bg-gray-100 cursor-pointer shadow-2xs hover:shadow-xs transition-all"
                    >
                      {att.kind === 'video' ? (
                        <div className="w-full h-full flex flex-col items-center justify-center bg-black/80 text-white p-2">
                          <Play className="w-6 h-6 text-white mb-1 group-hover:scale-110 transition-transform" />
                          <span className="text-[10px] text-center truncate w-full">Video Clip</span>
                        </div>
                      ) : (
                        <img
                          src={att.url}
                          alt={att.fileName}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                          referrerPolicy="no-referrer"
                        />
                      )}
                      <span className="absolute bottom-0 inset-x-0 bg-black/60 backdrop-blur-xs text-[10px] text-white px-2 py-0.5 truncate">
                        {att.fileName}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-[#6B7A88] italic">No customer photos uploaded yet.</p>
              )}
            </div>

            {/* Resolution Photos (Uploaded by Crew on Phone) */}
            {resolutionAttachments.length > 0 && (
              <div className="pt-4 border-t border-[#DFE2DE]">
                <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider block mb-2">
                  Resolution / "After" Proof Uploaded by Crew ({resolutionAttachments.length})
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {resolutionAttachments.map((att) => (
                    <div
                      key={att.id}
                      onClick={() => setActiveLightboxMedia(att)}
                      className="group relative aspect-4/3 rounded-lg overflow-hidden border border-emerald-300 bg-emerald-50 cursor-pointer shadow-2xs"
                    >
                      <img
                        src={att.url}
                        alt={att.fileName}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        referrerPolicy="no-referrer"
                      />
                      <span className="absolute bottom-0 inset-x-0 bg-black/60 text-[10px] text-white px-2 py-0.5 truncate">
                        Fixed • {att.fileName}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Notes Thread */}
          <div className="bg-white p-5 rounded-xl border border-[#DFE2DE] shadow-xs">
            <h2 className="text-xs font-bold uppercase tracking-wider text-[#3A424B] mb-3 flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-[#0F5CC4]" />
              <span>Notes Thread ({call.notes?.length || 0})</span>
            </h2>

            {call.notes && call.notes.length > 0 ? (
              <div className="space-y-3 mb-4">
                {call.notes.map((note) => (
                  <div
                    key={note.id}
                    className={`p-3.5 rounded-lg border text-xs space-y-1 ${
                      note.visibility === 'internal'
                        ? 'bg-amber-50/60 border-amber-200'
                        : 'bg-[#FBFBF9] border-[#DFE2DE]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-[#12161A]">{note.authorName}</span>
                        {note.visibility === 'internal' && (
                          <span className="text-[10px] bg-amber-200 text-amber-900 px-1.5 py-0.2 rounded font-semibold uppercase">
                            Internal Office Only
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-[#6B7A88]">
                        {formatRelativeDate(note.createdAt)}
                      </span>
                    </div>
                    <p className="text-[#3A424B] leading-relaxed whitespace-pre-wrap">{note.body}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-[#6B7A88] italic mb-4">No notes posted yet.</p>
            )}

            {/* Post Note Form */}
            <form onSubmit={handlePostNote} className="space-y-2.5 pt-3 border-t border-[#DFE2DE]">
              <textarea
                value={noteBody}
                onChange={(e) => setNoteBody(e.target.value)}
                placeholder="Write note (shared with crew, or internal office note)..."
                rows={3}
                className="w-full text-xs p-3 bg-[#FBFBF9] border border-[#DFE2DE] rounded-lg focus:border-[#0F5CC4] outline-none resize-none"
              />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 text-xs">
                  <label className="flex items-center gap-1.5 cursor-pointer text-[#3A424B]">
                    <input
                      type="radio"
                      name="visibility"
                      checked={noteVisibility === 'shared'}
                      onChange={() => setNoteVisibility('shared')}
                      className="accent-[#0F5CC4]"
                    />
                    <span>Shared with Crew</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer text-[#3A424B]">
                    <input
                      type="radio"
                      name="visibility"
                      checked={noteVisibility === 'internal'}
                      onChange={() => setNoteVisibility('internal')}
                      className="accent-[#0F5CC4]"
                    />
                    <span>Office Internal</span>
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={!noteBody.trim()}
                  className="px-4 py-1.5 bg-[#12161A] hover:bg-[#3A424B] text-white text-xs font-semibold rounded-lg disabled:opacity-50 transition-colors"
                >
                  Post Note
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Right Column (4 cols): Assignment & Metadata Controls */}
        <div className="lg:col-span-4 space-y-6">
          {/* Assignment Box */}
          <div className="bg-white p-5 rounded-xl border border-[#DFE2DE] shadow-xs space-y-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-[#3A424B] flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-[#0F5CC4]" />
              <span>Assigned Crew</span>
            </h2>

            <div>
              <label className="block text-[11px] text-[#6B7A88] mb-1">
                Assignee (Phone Portal Access)
              </label>
              <select
                value={selectedInstallerId}
                onChange={(e) => setSelectedInstallerId(e.target.value)}
                className="w-full text-xs p-2.5 bg-[#FBFBF9] border border-[#DFE2DE] rounded-lg font-medium text-[#12161A] outline-none"
              >
                <option value="">-- Unassigned --</option>
                {installers.map((inst) => (
                  <option key={inst.id} value={inst.id}>
                    {inst.fullName} ({inst.email})
                  </option>
                ))}
              </select>
              {selectedInstallerId !== call.installerId && (
                <p className="text-[11px] text-[#0F5CC4] font-medium mt-1">
                  ⚠️ Reassigning will trigger automatic email notification to both crews.
                </p>
              )}
            </div>

            {/* Status Control */}
            <div>
              <label className="block text-[11px] text-[#6B7A88] mb-1">Status</label>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value as CallStatus)}
                className="w-full text-xs p-2.5 bg-[#FBFBF9] border border-[#DFE2DE] rounded-lg font-semibold text-[#12161A] outline-none"
              >
                <option value="open">Open</option>
                <option value="in_progress">In Progress</option>
                <option value="blocked">Blocked</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>

            {/* Priority Control */}
            <div>
              <label className="block text-[11px] text-[#6B7A88] mb-1">Priority</label>
              <select
                value={selectedPriority}
                onChange={(e) => setSelectedPriority(e.target.value as CallPriority)}
                className="w-full text-xs p-2.5 bg-[#FBFBF9] border border-[#DFE2DE] rounded-lg font-bold uppercase text-[#12161A] outline-none"
              >
                <option value="high">High (Red)</option>
                <option value="mid">Mid (Amber)</option>
                <option value="low">Low (Slate)</option>
              </select>
            </div>

            {/* Responsibility */}
            <div>
              <label className="block text-[11px] text-[#6B7A88] mb-1">Responsibility</label>
              <select
                value={selectedResponsibility}
                onChange={(e) => setSelectedResponsibility(e.target.value as Responsibility)}
                className="w-full text-xs p-2.5 bg-[#FBFBF9] border border-[#DFE2DE] rounded-lg text-[#12161A] capitalize outline-none"
              >
                <option value="installer">Installer (counts in 90d rate)</option>
                <option value="office">Office (excluded from rate)</option>
                <option value="manufacturer">Manufacturer (excluded)</option>
                <option value="client">Client</option>
                <option value="unknown">Unknown</option>
              </select>
              <p className="text-[10px] text-[#6B7A88] mt-1">
                Per Spec: Only &apos;installer&apos; fault counts toward 90-day service call %.
              </p>
            </div>

            {/* Billing */}
            <div>
              <label className="block text-[11px] text-[#6B7A88] mb-1">Billing</label>
              <select
                value={selectedBilling}
                onChange={(e) => setSelectedBilling(e.target.value as BillingType)}
                className="w-full text-xs p-2.5 bg-[#FBFBF9] border border-[#DFE2DE] rounded-lg text-[#12161A] capitalize outline-none"
              >
                <option value="unpaid">Unpaid</option>
                <option value="paid">Paid</option>
                <option value="undecided">Undecided</option>
              </select>
            </div>

            <button
              type="button"
              onClick={handleSaveEdits}
              className="w-full py-2.5 bg-[#12161A] hover:bg-[#3A424B] text-white text-xs font-bold rounded-lg transition-colors shadow-xs"
            >
              Update Work Order
            </button>
          </div>

          {/* Client Details Box */}
          <div className="bg-white p-5 rounded-xl border border-[#DFE2DE] shadow-xs space-y-3 text-xs">
            <h2 className="font-bold uppercase tracking-wider text-[#3A424B]">Customer Info</h2>
            <div>
              <span className="text-[#6B7A88] block text-[11px]">Name:</span>
              <span className="font-semibold text-[#12161A] text-sm">{call.client?.name}</span>
            </div>

            {call.client?.phone && (
              <div>
                <span className="text-[#6B7A88] block text-[11px]">Phone:</span>
                <a
                  href={`tel:${call.client.phone}`}
                  className="text-[#0F5CC4] font-medium hover:underline flex items-center gap-1 mt-0.5"
                >
                  <Phone className="w-3.5 h-3.5" />
                  <span>{call.client.phone}</span>
                </a>
              </div>
            )}

            {call.client?.address && (
              <div>
                <span className="text-[#6B7A88] block text-[11px]">Address:</span>
                <p className="text-[#3A424B] mt-0.5">{call.client.address}</p>
              </div>
            )}

            <div className="pt-2 border-t border-[#DFE2DE] text-[11px] text-[#6B7A88] space-y-1">
              <div>Reported: {formatDate(call.reportedDate)}</div>
              <div>Installed: {formatDate(call.installDate)}</div>
              <div>Logged by: Office</div>
            </div>
          </div>
        </div>
      </div>

      <MediaLightbox
        attachment={activeLightboxMedia}
        onClose={() => setActiveLightboxMedia(null)}
      />
    </div>
  );
};
