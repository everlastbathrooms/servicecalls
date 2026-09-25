import React, { useState, useMemo } from 'react';
import { Search, Filter, Plus, ArrowUpDown, ChevronUp, ChevronDown, ChevronRight } from 'lucide-react';
import { CustomerCommunication } from '../../types';
import {
  formatDate,
  formatRelativeDate,
  getCommunicationMethodLabel,
  getCommunicationRequestTypeBadge,
  getCommunicationStatusBadge,
  getFollowUpMeta,
} from '../../lib/utils';

interface CommunicationsTableProps {
  communications: CustomerCommunication[];
  onSelect: (communication: CustomerCommunication) => void;
  onCreate: () => void;
}

export const CommunicationsTable: React.FC<CommunicationsTableProps> = ({
  communications,
  onSelect,
  onCreate,
}) => {
  // Default to hiding resolved/closed tickets so the log only shows what
  // still needs follow-up, matching the Service Calls table's default.
  const DEFAULT_STATUS_FILTER = 'active';

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState(DEFAULT_STATUS_FILTER);
  const [methodFilter, setMethodFilter] = useState('all');
  const [requestTypeFilter, setRequestTypeFilter] = useState('all');

  type SortField =
    | 'dateReceived'
    | 'jobNumber'
    | 'client'
    | 'method'
    | 'requestType'
    | 'summary'
    | 'handledBy'
    | 'nextFollowUpDate'
    | 'status';
  const [sortField, setSortField] = useState<SortField>('dateReceived');
  const [sortAsc, setSortAsc] = useState(false);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="w-3 h-3 text-gray-400" />;
    return sortAsc ? (
      <ChevronUp className="w-3.5 h-3.5 text-[#0F5CC4]" />
    ) : (
      <ChevronDown className="w-3.5 h-3.5 text-[#0F5CC4]" />
    );
  };

  const filtered = useMemo(() => {
    return communications
      .filter((c) => {
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchesJob = (c.jobNumber || '').toLowerCase().includes(q);
          const matchesClient = (c.clientName || '').toLowerCase().includes(q);
          const matchesSummary = c.summary.toLowerCase().includes(q);
          if (!matchesJob && !matchesClient && !matchesSummary) return false;
        }
        if (statusFilter !== 'all') {
          if (statusFilter === 'active') {
            if (c.status === 'resolved' || c.status === 'closed') return false;
          } else if (c.status !== statusFilter) {
            return false;
          }
        }
        if (methodFilter !== 'all' && c.method !== methodFilter) return false;
        if (requestTypeFilter !== 'all' && c.requestType !== requestTypeFilter) return false;
        return true;
      })
      .sort((a, b) => {
        if (sortField === 'dateReceived') {
          const timeA = new Date(a.dateReceived).getTime();
          const timeB = new Date(b.dateReceived).getTime();
          return sortAsc ? timeA - timeB : timeB - timeA;
        }
        if (sortField === 'jobNumber') {
          const cmp = (a.jobNumber || '').localeCompare(b.jobNumber || '');
          return sortAsc ? cmp : -cmp;
        }
        if (sortField === 'client') {
          const cmp = (a.clientName || '').localeCompare(b.clientName || '');
          return sortAsc ? cmp : -cmp;
        }
        if (sortField === 'method') {
          const cmp = a.method.localeCompare(b.method);
          return sortAsc ? cmp : -cmp;
        }
        if (sortField === 'requestType') {
          const cmp = (a.requestType || '').localeCompare(b.requestType || '');
          return sortAsc ? cmp : -cmp;
        }
        if (sortField === 'summary') {
          const cmp = a.summary.localeCompare(b.summary);
          return sortAsc ? cmp : -cmp;
        }
        if (sortField === 'handledBy') {
          const cmp = (a.handledByName || '').localeCompare(b.handledByName || '');
          return sortAsc ? cmp : -cmp;
        }
        if (sortField === 'nextFollowUpDate') {
          const timeA = a.nextFollowUpDate ? new Date(a.nextFollowUpDate).getTime() : Infinity;
          const timeB = b.nextFollowUpDate ? new Date(b.nextFollowUpDate).getTime() : Infinity;
          return sortAsc ? timeA - timeB : timeB - timeA;
        }
        if (sortField === 'status') {
          const cmp = a.status.localeCompare(b.status);
          return sortAsc ? cmp : -cmp;
        }
        return 0;
      });
  }, [communications, searchQuery, statusFilter, methodFilter, requestTypeFilter, sortField, sortAsc]);

  return (
    <div className="space-y-4">
      <div className="bg-white p-4 rounded-xl border border-[#DFE2DE] shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-[#6B7A88]" />
            <input
              type="text"
              placeholder="Search by job #, client name, or summary..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs bg-[#FBFBF9] border border-[#DFE2DE] rounded-lg focus:border-[#0F5CC4] outline-none"
            />
          </div>

          <button
            onClick={onCreate}
            className="px-4 py-2 bg-[#0F5CC4] hover:bg-[#0E52B0] text-white text-xs font-bold rounded-lg flex items-center gap-1.5 shadow-xs transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Log Ticket</span>
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[#DFE2DE]/70 text-xs">
          <div className="flex items-center gap-1.5 text-[#6B7A88] font-semibold mr-1">
            <Filter className="w-3.5 h-3.5" />
            <span>Filters:</span>
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-2.5 py-1.5 bg-[#FBFBF9] border border-[#DFE2DE] rounded-lg text-xs font-medium text-[#12161A] outline-none"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active Only (Open / In Progress)</option>
            <option value="open">Open</option>
            <option value="in_progress">In Progress</option>
            <option value="resolved">Resolved</option>
            <option value="closed">Closed</option>
          </select>

          <select
            value={methodFilter}
            onChange={(e) => setMethodFilter(e.target.value)}
            className="px-2.5 py-1.5 bg-[#FBFBF9] border border-[#DFE2DE] rounded-lg text-xs font-medium text-[#12161A] outline-none"
          >
            <option value="all">All Methods</option>
            <option value="phone">Phone</option>
            <option value="email">Email</option>
            <option value="text">Text</option>
            <option value="in_person">In Person</option>
            <option value="other">Other</option>
          </select>

          <select
            value={requestTypeFilter}
            onChange={(e) => setRequestTypeFilter(e.target.value)}
            className="px-2.5 py-1.5 bg-[#FBFBF9] border border-[#DFE2DE] rounded-lg text-xs font-medium text-[#12161A] outline-none"
          >
            <option value="all">All Request Types</option>
            <option value="order_status">Order Status</option>
            <option value="installation_coordination">Installation Coordination</option>
            <option value="project_scope">Project / Scope Question</option>
            <option value="other">Other</option>
          </select>

          {(searchQuery ||
            statusFilter !== DEFAULT_STATUS_FILTER ||
            methodFilter !== 'all' ||
            requestTypeFilter !== 'all') && (
            <button
              onClick={() => {
                setSearchQuery('');
                setStatusFilter(DEFAULT_STATUS_FILTER);
                setMethodFilter('all');
                setRequestTypeFilter('all');
              }}
              className="text-xs text-[#0F5CC4] hover:underline font-medium ml-auto"
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-[#DFE2DE] shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-[#F0F2F0] text-[#3A424B] border-b border-[#DFE2DE] uppercase tracking-wider font-semibold">
              <tr>
                <th
                  className={`py-3 px-3 cursor-pointer hover:text-[#12161A] ${sortField === 'dateReceived' ? 'text-[#12161A]' : ''}`}
                  onClick={() => toggleSort('dateReceived')}
                >
                  <div className="flex items-center gap-1">
                    <span>Date Received</span>
                    <SortIcon field="dateReceived" />
                  </div>
                </th>
                <th
                  className={`py-3 px-3 cursor-pointer hover:text-[#12161A] ${sortField === 'jobNumber' ? 'text-[#12161A]' : ''}`}
                  onClick={() => toggleSort('jobNumber')}
                >
                  <div className="flex items-center gap-1">
                    <span>Job #</span>
                    <SortIcon field="jobNumber" />
                  </div>
                </th>
                <th
                  className={`py-3 px-3 cursor-pointer hover:text-[#12161A] ${sortField === 'client' ? 'text-[#12161A]' : ''}`}
                  onClick={() => toggleSort('client')}
                >
                  <div className="flex items-center gap-1">
                    <span>Client</span>
                    <SortIcon field="client" />
                  </div>
                </th>
                <th
                  className={`py-3 px-3 cursor-pointer hover:text-[#12161A] ${sortField === 'method' ? 'text-[#12161A]' : ''}`}
                  onClick={() => toggleSort('method')}
                >
                  <div className="flex items-center gap-1">
                    <span>Method</span>
                    <SortIcon field="method" />
                  </div>
                </th>
                <th
                  className={`py-3 px-3 cursor-pointer hover:text-[#12161A] ${sortField === 'requestType' ? 'text-[#12161A]' : ''}`}
                  onClick={() => toggleSort('requestType')}
                >
                  <div className="flex items-center gap-1">
                    <span>Type</span>
                    <SortIcon field="requestType" />
                  </div>
                </th>
                <th
                  className={`py-3 px-3 cursor-pointer hover:text-[#12161A] ${sortField === 'summary' ? 'text-[#12161A]' : ''}`}
                  onClick={() => toggleSort('summary')}
                >
                  <div className="flex items-center gap-1">
                    <span>Summary</span>
                    <SortIcon field="summary" />
                  </div>
                </th>
                <th
                  className={`py-3 px-3 cursor-pointer hover:text-[#12161A] ${sortField === 'handledBy' ? 'text-[#12161A]' : ''}`}
                  onClick={() => toggleSort('handledBy')}
                >
                  <div className="flex items-center gap-1">
                    <span>Handled By</span>
                    <SortIcon field="handledBy" />
                  </div>
                </th>
                <th
                  className={`py-3 px-3 cursor-pointer hover:text-[#12161A] ${sortField === 'nextFollowUpDate' ? 'text-[#12161A]' : ''}`}
                  onClick={() => toggleSort('nextFollowUpDate')}
                >
                  <div className="flex items-center gap-1">
                    <span>Next Follow-Up</span>
                    <SortIcon field="nextFollowUpDate" />
                  </div>
                </th>
                <th
                  className={`py-3 px-3 cursor-pointer hover:text-[#12161A] ${sortField === 'status' ? 'text-[#12161A]' : ''}`}
                  onClick={() => toggleSort('status')}
                >
                  <div className="flex items-center gap-1">
                    <span>Status</span>
                    <SortIcon field="status" />
                  </div>
                </th>
                <th className="py-3 px-3 text-right"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#DFE2DE]">
              {filtered.length > 0 ? (
                filtered.map((c) => {
                  const badge = getCommunicationStatusBadge(c.status);
                  const requestTypeBadge = c.requestType ? getCommunicationRequestTypeBadge(c.requestType) : null;
                  const followUpMeta = getFollowUpMeta(c.nextFollowUpDate);
                  return (
                    <tr
                      key={c.id}
                      onClick={() => onSelect(c)}
                      className="hover:bg-[#FBFBF9] cursor-pointer transition-colors group"
                    >
                      <td className="py-3 px-3 text-[#3A424B] whitespace-nowrap">
                        <span>{formatDate(c.dateReceived)}</span>
                        <span className="block text-[10px] text-[#6B7A88]">
                          {formatRelativeDate(c.dateReceived)}
                        </span>
                      </td>
                      <td className="py-3 px-3 font-mono font-bold text-[#12161A] tabular-nums whitespace-nowrap">
                        {c.jobNumber ? `#${c.jobNumber}` : <span className="text-[#6B7A88] font-normal italic">—</span>}
                      </td>
                      <td className="py-3 px-3 font-semibold text-[#12161A] max-w-[160px] truncate">
                        {c.clientName || 'Customer'}
                        {c.clientPhone && (
                          <span className="block text-[11px] font-normal text-[#6B7A88]">{c.clientPhone}</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-[#3A424B] whitespace-nowrap">
                        {getCommunicationMethodLabel(c.method)}
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        {requestTypeBadge ? (
                          <span
                            className={`inline-block text-[11px] font-semibold px-2 py-0.5 rounded-full ${requestTypeBadge.bg} ${requestTypeBadge.text}`}
                          >
                            {requestTypeBadge.label}
                          </span>
                        ) : (
                          <span className="text-[#6B7A88] italic">—</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-[#3A424B] max-w-[280px] truncate">{c.summary}</td>
                      <td className="py-3 px-3 text-[#3A424B] whitespace-nowrap">
                        {c.handledByName || '—'}
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        {followUpMeta ? (
                          <span
                            className={`inline-block text-[11px] font-bold px-2 py-0.5 rounded-full ${followUpMeta.classes}`}
                          >
                            {followUpMeta.label}
                          </span>
                        ) : (
                          <span className="text-[#6B7A88]">—</span>
                        )}
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span className={`inline-block text-[11px] font-semibold px-2 py-0.5 rounded-full ${badge.bg} ${badge.text}`}>
                          {badge.label}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right">
                        <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-[#12161A] inline-block" />
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-[#6B7A88]">
                    <p className="text-sm font-medium">No customer service tickets logged matching filters.</p>
                    <button
                      onClick={onCreate}
                      className="mt-3 px-3 py-1.5 bg-[#0F5CC4] text-white rounded-lg text-xs font-semibold"
                    >
                      Log First Ticket
                    </button>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="px-4 py-2.5 bg-[#FBFBF9] border-t border-[#DFE2DE] flex items-center justify-between text-xs text-[#6B7A88]">
          <span>
            Showing <strong>{filtered.length}</strong> of <strong>{communications.length}</strong> logged tickets
          </span>
        </div>
      </div>
    </div>
  );
};
