import React, { useState } from 'react';
import { ArrowLeft, MessageSquare, CheckCircle2, ExternalLink, Trash2 } from 'lucide-react';
import { CommunicationMethod, CommunicationStatus, CustomerCommunication, UserProfile } from '../../types';
import { formatDate, formatRelativeDate, getCommunicationMethodLabel, getCommunicationStatusBadge } from '../../lib/utils';

interface CommunicationDetailProps {
  communication: CustomerCommunication;
  team: UserProfile[];
  isAdmin: boolean;
  onBack: () => void;
  onUpdate: (id: string, updates: { status?: CommunicationStatus; handledBy?: string; method?: CommunicationMethod }) => void;
  onAddNote: (id: string, body: string) => void;
  onViewJob?: (serviceCallId: string) => void;
  onDeleteCommunication: (id: string) => void;
}

export const CommunicationDetail: React.FC<CommunicationDetailProps> = ({
  communication,
  team,
  isAdmin,
  onBack,
  onUpdate,
  onAddNote,
  onViewJob,
  onDeleteCommunication,
}) => {
  const [status, setStatus] = useState(communication.status);
  const [handledBy, setHandledBy] = useState(communication.handledBy);
  const [method, setMethod] = useState(communication.method);
  const [isSaved, setIsSaved] = useState(false);
  const [noteBody, setNoteBody] = useState('');

  const badge = getCommunicationStatusBadge(communication.status);

  const handleSave = () => {
    onUpdate(communication.id, { status, handledBy, method });
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
  };

  const handlePostNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteBody.trim()) return;
    onAddNote(communication.id, noteBody.trim());
    setNoteBody('');
  };

  const handleDelete = () => {
    if (window.confirm(`Delete this ticket for #${communication.jobNumber}? This cannot be undone.`)) {
      onDeleteCommunication(communication.id);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-[#DFE2DE] shadow-xs">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-2 text-[#3A424B] hover:text-[#12161A] hover:bg-gray-100 rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${badge.bg} ${badge.text}`}>
                {badge.label}
              </span>
              <span className="text-xs text-[#6B7A88]">
                {getCommunicationMethodLabel(communication.method)} • {formatDate(communication.dateReceived)}
              </span>
            </div>
            <h1 className="text-xl font-bold text-[#12161A] mt-1 flex items-center gap-2">
              <span className="font-mono">#{communication.jobNumber}</span>
              <span className="text-[#6B7A88] font-normal text-base">{communication.clientName || 'Customer'}</span>
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isSaved && (
            <span className="text-xs text-emerald-700 font-semibold flex items-center gap-1">
              <CheckCircle2 className="w-4 h-4" /> Saved
            </span>
          )}
          {isAdmin && (
            <button
              onClick={handleDelete}
              title="Delete ticket"
              className="p-2 text-[#6B7A88] hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-[#0F5CC4] hover:bg-[#0E52B0] text-white text-xs font-bold rounded-lg shadow-xs transition-colors"
          >
            Save Changes
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 space-y-6">
          <div className="bg-white p-5 rounded-xl border border-[#DFE2DE] shadow-xs">
            <h2 className="text-xs font-bold uppercase tracking-wider text-[#3A424B] mb-2">Summary</h2>
            <div className="text-sm font-medium text-[#12161A] bg-[#FBFBF9] p-4 rounded-lg border-l-4 border-[#0F5CC4] leading-relaxed">
              {communication.summary}
            </div>
          </div>

          <div className="bg-white p-5 rounded-xl border border-[#DFE2DE] shadow-xs">
            <h2 className="text-xs font-bold uppercase tracking-wider text-[#3A424B] mb-3 flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-[#0F5CC4]" />
              <span>Updates &amp; Notes ({communication.notes?.length || 0})</span>
            </h2>

            {communication.notes && communication.notes.length > 0 ? (
              <div className="space-y-3 mb-4">
                {communication.notes.map((note) => (
                  <div key={note.id} className="p-3.5 rounded-lg border bg-[#FBFBF9] border-[#DFE2DE] text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-[#12161A]">{note.authorName}</span>
                      <span className="text-[10px] text-[#6B7A88]">{formatRelativeDate(note.createdAt)}</span>
                    </div>
                    <p className="text-[#3A424B] leading-relaxed whitespace-pre-wrap">{note.body}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-[#6B7A88] italic mb-4">No updates logged yet.</p>
            )}

            <form onSubmit={handlePostNote} className="space-y-2.5 pt-3 border-t border-[#DFE2DE]">
              <textarea
                value={noteBody}
                onChange={(e) => setNoteBody(e.target.value)}
                placeholder="Add a timestamped update..."
                rows={3}
                className="w-full text-xs p-3 bg-[#FBFBF9] border border-[#DFE2DE] rounded-lg focus:border-[#0F5CC4] outline-none resize-none"
              />
              <div className="flex items-center justify-end">
                <button
                  type="submit"
                  disabled={!noteBody.trim()}
                  className="px-4 py-1.5 bg-[#12161A] hover:bg-[#3A424B] text-white text-xs font-semibold rounded-lg disabled:opacity-50 transition-colors"
                >
                  Post Update
                </button>
              </div>
            </form>
          </div>
        </div>

        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white p-5 rounded-xl border border-[#DFE2DE] shadow-xs space-y-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-[#3A424B]">Status &amp; Assignment</h2>

            <div>
              <label className="block text-[11px] text-[#6B7A88] mb-1">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as CommunicationStatus)}
                className="w-full text-xs p-2.5 bg-[#FBFBF9] border border-[#DFE2DE] rounded-lg font-semibold text-[#12161A] outline-none"
              >
                <option value="open">Open</option>
                <option value="in_progress">In Progress</option>
                <option value="resolved">Resolved</option>
                <option value="closed">Closed</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] text-[#6B7A88] mb-1">Method</label>
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value as CommunicationMethod)}
                className="w-full text-xs p-2.5 bg-[#FBFBF9] border border-[#DFE2DE] rounded-lg text-[#12161A] outline-none"
              >
                <option value="phone">Phone</option>
                <option value="email">Email</option>
                <option value="text">Text</option>
                <option value="in_person">In Person</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] text-[#6B7A88] mb-1">Handled By</label>
              <select
                value={handledBy}
                onChange={(e) => setHandledBy(e.target.value)}
                className="w-full text-xs p-2.5 bg-[#FBFBF9] border border-[#DFE2DE] rounded-lg font-medium text-[#12161A] outline-none"
              >
                {team.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.fullName}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={handleSave}
              className="w-full py-2.5 bg-[#12161A] hover:bg-[#3A424B] text-white text-xs font-bold rounded-lg transition-colors shadow-xs"
            >
              Save Changes
            </button>
          </div>

          <div className="bg-white p-5 rounded-xl border border-[#DFE2DE] shadow-xs space-y-3 text-xs">
            <h2 className="font-bold uppercase tracking-wider text-[#3A424B]">Job Info</h2>
            <div>
              <span className="text-[#6B7A88] block text-[11px]">Job Number:</span>
              <span className="font-mono font-bold text-[#12161A] text-sm">#{communication.jobNumber}</span>
            </div>
            <div>
              <span className="text-[#6B7A88] block text-[11px]">Client:</span>
              <span className="font-semibold text-[#12161A] text-sm">{communication.clientName || 'Customer'}</span>
            </div>
            {onViewJob && (
              <button
                type="button"
                onClick={() => onViewJob(communication.serviceCallId)}
                className="text-xs text-[#0F5CC4] font-semibold hover:underline flex items-center gap-1"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Open Work Order</span>
              </button>
            )}
            <div className="pt-2 border-t border-[#DFE2DE] text-[11px] text-[#6B7A88] space-y-1">
              <div>Received: {formatDate(communication.dateReceived)}</div>
              <div>Logged: {formatDate(communication.createdAt)}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
