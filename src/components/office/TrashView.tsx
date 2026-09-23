import React from 'react';
import { Trash2, RotateCcw, ClipboardList, MessageCircle } from 'lucide-react';
import { CustomerCommunication, ServiceCall } from '../../types';
import { formatDate, formatRelativeDate } from '../../lib/utils';

interface TrashViewProps {
  deletedCalls: ServiceCall[];
  deletedCommunications: CustomerCommunication[];
  onRestoreCall: (callId: string) => void;
  onPermanentlyDeleteCall: (callId: string) => void;
  onRestoreCommunication: (id: string) => void;
  onPermanentlyDeleteCommunication: (id: string) => void;
}

export const TrashView: React.FC<TrashViewProps> = ({
  deletedCalls,
  deletedCommunications,
  onRestoreCall,
  onPermanentlyDeleteCall,
  onRestoreCommunication,
  onPermanentlyDeleteCommunication,
}) => {
  const handlePermanentDeleteCall = (call: ServiceCall) => {
    if (
      window.confirm(
        `Permanently delete Job #${call.jobNumber} — ${call.client?.name || 'Customer'}? This cannot be undone.`
      )
    ) {
      onPermanentlyDeleteCall(call.id);
    }
  };

  const handlePermanentDeleteCommunication = (c: CustomerCommunication) => {
    if (
      window.confirm(
        `Permanently delete this ticket (#${c.jobNumber || '—'} — ${c.clientName || 'Customer'})? This cannot be undone.`
      )
    ) {
      onPermanentlyDeleteCommunication(c.id);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-xl px-4 py-3 text-xs">
        Deleted items land here first and stay recoverable. "Delete Forever" is the only action that can't be undone.
      </div>

      <div className="bg-white rounded-xl border border-[#DFE2DE] shadow-xs overflow-hidden">
        <div className="px-4 py-3 border-b border-[#DFE2DE] flex items-center gap-2">
          <ClipboardList className="w-4 h-4 text-[#6B7A88]" />
          <h2 className="text-xs font-bold uppercase tracking-wider text-[#3A424B]">
            Deleted Service Calls ({deletedCalls.length})
          </h2>
        </div>
        {deletedCalls.length > 0 ? (
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-[#F0F2F0] text-[#3A424B] border-b border-[#DFE2DE] uppercase tracking-wider font-semibold">
              <tr>
                <th className="py-2.5 px-4">Job #</th>
                <th className="py-2.5 px-4">Client</th>
                <th className="py-2.5 px-4">Summary</th>
                <th className="py-2.5 px-4">Deleted</th>
                <th className="py-2.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#DFE2DE]">
              {deletedCalls.map((call) => (
                <tr key={call.id} className="hover:bg-[#FBFBF9]">
                  <td className="py-3 px-4 font-mono font-bold text-[#12161A] whitespace-nowrap">
                    #{call.jobNumber}
                  </td>
                  <td className="py-3 px-4 font-semibold text-[#12161A] max-w-[160px] truncate">
                    {call.client?.name || 'Customer'}
                  </td>
                  <td className="py-3 px-4 text-[#3A424B] max-w-[280px] truncate">{call.description}</td>
                  <td className="py-3 px-4 text-[#6B7A88] whitespace-nowrap">
                    <span>{formatRelativeDate(call.deletedAt)}</span>
                    {call.deletedByName && <span className="block text-[10px]">by {call.deletedByName}</span>}
                  </td>
                  <td className="py-3 px-4 text-right whitespace-nowrap">
                    <button
                      onClick={() => onRestoreCall(call.id)}
                      className="inline-flex items-center gap-1 text-[#0F5CC4] font-semibold hover:underline mr-4"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Restore</span>
                    </button>
                    <button
                      onClick={() => handlePermanentDeleteCall(call)}
                      className="inline-flex items-center gap-1 text-red-700 font-semibold hover:underline"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete Forever</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="py-8 text-center text-xs text-[#6B7A88]">No deleted service calls.</p>
        )}
      </div>

      <div className="bg-white rounded-xl border border-[#DFE2DE] shadow-xs overflow-hidden">
        <div className="px-4 py-3 border-b border-[#DFE2DE] flex items-center gap-2">
          <MessageCircle className="w-4 h-4 text-[#6B7A88]" />
          <h2 className="text-xs font-bold uppercase tracking-wider text-[#3A424B]">
            Deleted Client Communications ({deletedCommunications.length})
          </h2>
        </div>
        {deletedCommunications.length > 0 ? (
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-[#F0F2F0] text-[#3A424B] border-b border-[#DFE2DE] uppercase tracking-wider font-semibold">
              <tr>
                <th className="py-2.5 px-4">Job #</th>
                <th className="py-2.5 px-4">Client</th>
                <th className="py-2.5 px-4">Summary</th>
                <th className="py-2.5 px-4">Received</th>
                <th className="py-2.5 px-4">Deleted</th>
                <th className="py-2.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#DFE2DE]">
              {deletedCommunications.map((c) => (
                <tr key={c.id} className="hover:bg-[#FBFBF9]">
                  <td className="py-3 px-4 font-mono font-bold text-[#12161A] whitespace-nowrap">
                    #{c.jobNumber || '—'}
                  </td>
                  <td className="py-3 px-4 font-semibold text-[#12161A] max-w-[160px] truncate">
                    {c.clientName || 'Customer'}
                  </td>
                  <td className="py-3 px-4 text-[#3A424B] max-w-[280px] truncate">{c.summary}</td>
                  <td className="py-3 px-4 text-[#6B7A88] whitespace-nowrap">{formatDate(c.dateReceived)}</td>
                  <td className="py-3 px-4 text-[#6B7A88] whitespace-nowrap">
                    <span>{formatRelativeDate(c.deletedAt)}</span>
                    {c.deletedByName && <span className="block text-[10px]">by {c.deletedByName}</span>}
                  </td>
                  <td className="py-3 px-4 text-right whitespace-nowrap">
                    <button
                      onClick={() => onRestoreCommunication(c.id)}
                      className="inline-flex items-center gap-1 text-[#0F5CC4] font-semibold hover:underline mr-4"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Restore</span>
                    </button>
                    <button
                      onClick={() => handlePermanentDeleteCommunication(c)}
                      className="inline-flex items-center gap-1 text-red-700 font-semibold hover:underline"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete Forever</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="py-8 text-center text-xs text-[#6B7A88]">No deleted communications.</p>
        )}
      </div>
    </div>
  );
};
