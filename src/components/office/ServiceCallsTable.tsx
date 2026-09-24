import React, { useState, useMemo } from 'react';
import {
  Search,
  Download,
  Filter,
  Plus,
  ArrowUpDown,
  ChevronUp,
  ChevronDown,
  Paperclip,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ChevronRight,
} from 'lucide-react';
import {
  CallPriority,
  CallStatus,
  Responsibility,
  ServiceCall,
  UserProfile,
} from '../../types';
import {
  exportCallsToCsv,
  formatDate,
  formatRelativeDate,
  getDaysOpen,
  getFollowUpMeta,
  getPriorityBorderColor,
  getStatusBadge,
} from '../../lib/utils';

interface ServiceCallsTableProps {
  calls: ServiceCall[];
  installers: UserProfile[];
  onSelectCall: (call: ServiceCall) => void;
  onCreateCall: () => void;
}

export const ServiceCallsTable: React.FC<ServiceCallsTableProps> = ({
  calls,
  installers,
  onSelectCall,
  onCreateCall,
}) => {
  // Default to hiding completed/cancelled calls so the main screen only
  // shows work that still needs attention.
  const DEFAULT_STATUS_FILTER = 'active';

  // Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [installerFilter, setInstallerFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState(DEFAULT_STATUS_FILTER);
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [responsibilityFilter, setResponsibilityFilter] = useState('all');

  // Sorting
  type SortField =
    | 'jobNumber'
    | 'client'
    | 'reportedDate'
    | 'daysOpen'
    | 'installer'
    | 'installDate'
    | 'description'
    | 'nextFollowUpDate'
    | 'priority'
    | 'responsibility'
    | 'billing'
    | 'status';
  const [sortField, setSortField] = useState<SortField>('reportedDate');
  const [sortAsc, setSortAsc] = useState(false);

  // Filter logic
  const filteredCalls = useMemo(() => {
    return calls.filter((call) => {
      // Search by job number or client name or description
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesJob = call.jobNumber.toLowerCase().includes(q);
        const matchesClient = (call.client?.name || '').toLowerCase().includes(q);
        const matchesDesc = call.description.toLowerCase().includes(q);
        if (!matchesJob && !matchesClient && !matchesDesc) return false;
      }

      // Installer filter
      if (installerFilter !== 'all') {
        if (installerFilter === 'unassigned') {
          if (call.installerId) return false;
        } else if (call.installerId !== installerFilter) {
          return false;
        }
      }

      // Status filter
      if (statusFilter !== 'all') {
        if (statusFilter === 'active') {
          if (call.status === 'completed' || call.status === 'cancelled') return false;
        } else if (call.status !== statusFilter) {
          return false;
        }
      }

      // Priority filter
      if (priorityFilter !== 'all' && call.priority !== priorityFilter) {
        return false;
      }

      // Responsibility filter
      if (responsibilityFilter !== 'all' && call.responsibility !== responsibilityFilter) {
        return false;
      }

      return true;
    }).sort((a, b) => {
      if (sortField === 'reportedDate') {
        const timeA = new Date(a.reportedDate).getTime();
        const timeB = new Date(b.reportedDate).getTime();
        return sortAsc ? timeA - timeB : timeB - timeA;
      }
      if (sortField === 'jobNumber') {
        return sortAsc ? a.jobNumber.localeCompare(b.jobNumber) : b.jobNumber.localeCompare(a.jobNumber);
      }
      if (sortField === 'priority') {
        const weight: Record<CallPriority, number> = { high: 3, mid: 2, low: 1 };
        return sortAsc ? weight[a.priority] - weight[b.priority] : weight[b.priority] - weight[a.priority];
      }
      if (sortField === 'daysOpen') {
        const daysA = getDaysOpen(a.reportedDate);
        const daysB = getDaysOpen(b.reportedDate);
        return sortAsc ? daysA - daysB : daysB - daysA;
      }
      if (sortField === 'client') {
        const cmp = (a.client?.name || '').localeCompare(b.client?.name || '');
        return sortAsc ? cmp : -cmp;
      }
      if (sortField === 'installer') {
        const cmp = (a.installer?.fullName || '').localeCompare(b.installer?.fullName || '');
        return sortAsc ? cmp : -cmp;
      }
      if (sortField === 'installDate') {
        const timeA = a.installDate ? new Date(a.installDate).getTime() : Infinity;
        const timeB = b.installDate ? new Date(b.installDate).getTime() : Infinity;
        return sortAsc ? timeA - timeB : timeB - timeA;
      }
      if (sortField === 'description') {
        const cmp = a.description.localeCompare(b.description);
        return sortAsc ? cmp : -cmp;
      }
      if (sortField === 'nextFollowUpDate') {
        const timeA = a.nextFollowUpDate ? new Date(a.nextFollowUpDate).getTime() : Infinity;
        const timeB = b.nextFollowUpDate ? new Date(b.nextFollowUpDate).getTime() : Infinity;
        return sortAsc ? timeA - timeB : timeB - timeA;
      }
      if (sortField === 'responsibility') {
        const cmp = a.responsibility.localeCompare(b.responsibility);
        return sortAsc ? cmp : -cmp;
      }
      if (sortField === 'billing') {
        const cmp = a.billing.localeCompare(b.billing);
        return sortAsc ? cmp : -cmp;
      }
      if (sortField === 'status') {
        const cmp = a.status.localeCompare(b.status);
        return sortAsc ? cmp : -cmp;
      }
      return 0;
    });
  }, [
    calls,
    searchQuery,
    installerFilter,
    statusFilter,
    priorityFilter,
    responsibilityFilter,
    sortField,
    sortAsc,
  ]);

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

  return (
    <div className="space-y-4">
      {/* Control Bar: Filters, Search, CSV Export, Create Call */}
      <div className="bg-white p-4 rounded-xl border border-[#DFE2DE] shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-[#6B7A88]" />
            <input
              type="text"
              placeholder="Search by job #, client, or issue text..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs bg-[#FBFBF9] border border-[#DFE2DE] rounded-lg focus:border-[#0F5CC4] outline-none"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => exportCallsToCsv(filteredCalls)}
              className="px-3 py-2 bg-white hover:bg-gray-50 border border-[#DFE2DE] text-[#3A424B] text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors"
              title="Export filtered records to spreadsheet CSV"
            >
              <Download className="w-3.5 h-3.5 text-[#6B7A88]" />
              <span>Export CSV</span>
            </button>

            <button
              onClick={onCreateCall}
              className="px-4 py-2 bg-[#0F5CC4] hover:bg-[#0E52B0] text-white text-xs font-bold rounded-lg flex items-center gap-1.5 shadow-xs transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Create Service Call</span>
            </button>
          </div>
        </div>

        {/* Filter Dropdowns Bar */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[#DFE2DE]/70 text-xs">
          <div className="flex items-center gap-1.5 text-[#6B7A88] font-semibold mr-1">
            <Filter className="w-3.5 h-3.5" />
            <span>Filters:</span>
          </div>

          {/* Installer filter */}
          <select
            value={installerFilter}
            onChange={(e) => setInstallerFilter(e.target.value)}
            className="px-2.5 py-1.5 bg-[#FBFBF9] border border-[#DFE2DE] rounded-lg text-xs font-medium text-[#12161A] outline-none"
          >
            <option value="all">All Crews ({calls.length})</option>
            <option value="unassigned">Unassigned</option>
            {installers.map((inst) => {
              const count = calls.filter((c) => c.installerId === inst.id).length;
              return (
                <option key={inst.id} value={inst.id}>
                  {inst.fullName} ({count})
                </option>
              );
            })}
          </select>

          {/* Status filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-2.5 py-1.5 bg-[#FBFBF9] border border-[#DFE2DE] rounded-lg text-xs font-medium text-[#12161A] outline-none"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active Only (Open / In Progress / Blocked)</option>
            <option value="open">Open</option>
            <option value="in_progress">In Progress</option>
            <option value="blocked">Blocked</option>
            <option value="completed">Completed</option>
          </select>

          {/* Priority filter */}
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="px-2.5 py-1.5 bg-[#FBFBF9] border border-[#DFE2DE] rounded-lg text-xs font-medium text-[#12161A] outline-none"
          >
            <option value="all">All Priorities</option>
            <option value="high">High</option>
            <option value="mid">Mid</option>
            <option value="low">Low</option>
          </select>

          {/* Responsibility filter */}
          <select
            value={responsibilityFilter}
            onChange={(e) => setResponsibilityFilter(e.target.value)}
            className="px-2.5 py-1.5 bg-[#FBFBF9] border border-[#DFE2DE] rounded-lg text-xs font-medium text-[#12161A] outline-none capitalize"
          >
            <option value="all">All Responsibilities</option>
            <option value="installer">Installer</option>
            <option value="office">Office</option>
            <option value="manufacturer">Manufacturer</option>
            <option value="client">Client</option>
          </select>

          {(searchQuery || installerFilter !== 'all' || statusFilter !== DEFAULT_STATUS_FILTER || priorityFilter !== 'all' || responsibilityFilter !== 'all') && (
            <button
              onClick={() => {
                setSearchQuery('');
                setInstallerFilter('all');
                setStatusFilter(DEFAULT_STATUS_FILTER);
                setPriorityFilter('all');
                setResponsibilityFilter('all');
              }}
              className="text-xs text-[#0F5CC4] hover:underline font-medium ml-auto"
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* Dense Spreadsheet-like Table matching Spec Section 7.3 */}
      <div className="bg-white rounded-xl border border-[#DFE2DE] shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-[#F0F2F0] text-[#3A424B] border-b border-[#DFE2DE] uppercase tracking-wider font-semibold sticky top-0">
              <tr>
                <th className="w-2.5 p-0"></th>
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
                  className={`py-3 px-3 cursor-pointer hover:text-[#12161A] ${sortField === 'description' ? 'text-[#12161A]' : ''}`}
                  onClick={() => toggleSort('description')}
                >
                  <div className="flex items-center gap-1">
                    <span>Summary</span>
                    <SortIcon field="description" />
                  </div>
                </th>
                <th
                  className={`py-3 px-3 cursor-pointer hover:text-[#12161A] ${sortField === 'reportedDate' ? 'text-[#12161A]' : ''}`}
                  onClick={() => toggleSort('reportedDate')}
                >
                  <div className="flex items-center gap-1">
                    <span>Reported</span>
                    <SortIcon field="reportedDate" />
                  </div>
                </th>
                <th
                  className={`py-3 px-3 cursor-pointer hover:text-[#12161A] ${sortField === 'daysOpen' ? 'text-[#12161A]' : ''}`}
                  onClick={() => toggleSort('daysOpen')}
                >
                  <div className="flex items-center gap-1">
                    <span>Days Open</span>
                    <SortIcon field="daysOpen" />
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
                  className={`py-3 px-3 cursor-pointer hover:text-[#12161A] ${sortField === 'installer' ? 'text-[#12161A]' : ''}`}
                  onClick={() => toggleSort('installer')}
                >
                  <div className="flex items-center gap-1">
                    <span>Assigned Crew</span>
                    <SortIcon field="installer" />
                  </div>
                </th>
                <th
                  className={`py-3 px-3 cursor-pointer hover:text-[#12161A] ${sortField === 'installDate' ? 'text-[#12161A]' : ''}`}
                  onClick={() => toggleSort('installDate')}
                >
                  <div className="flex items-center gap-1">
                    <span>Install Date</span>
                    <SortIcon field="installDate" />
                  </div>
                </th>
                <th
                  className={`py-3 px-3 cursor-pointer hover:text-[#12161A] ${sortField === 'priority' ? 'text-[#12161A]' : ''}`}
                  onClick={() => toggleSort('priority')}
                >
                  <div className="flex items-center gap-1">
                    <span>Priority</span>
                    <SortIcon field="priority" />
                  </div>
                </th>
                <th
                  className={`py-3 px-3 cursor-pointer hover:text-[#12161A] ${sortField === 'responsibility' ? 'text-[#12161A]' : ''}`}
                  onClick={() => toggleSort('responsibility')}
                >
                  <div className="flex items-center gap-1">
                    <span>Responsibility</span>
                    <SortIcon field="responsibility" />
                  </div>
                </th>
                <th
                  className={`py-3 px-3 cursor-pointer hover:text-[#12161A] ${sortField === 'billing' ? 'text-[#12161A]' : ''}`}
                  onClick={() => toggleSort('billing')}
                >
                  <div className="flex items-center gap-1">
                    <span>Billing</span>
                    <SortIcon field="billing" />
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
              {filteredCalls.length > 0 ? (
                filteredCalls.map((call) => {
                  const priorityColor = getPriorityBorderColor(call.priority);
                  const statusBadge = getStatusBadge(call.status);
                  const attachmentCount = (call.attachments || []).length;
                  const daysOpen = getDaysOpen(call.reportedDate);
                  const daysOpenClasses =
                    daysOpen >= 7
                      ? 'bg-red-50 text-red-700'
                      : daysOpen >= 3
                      ? 'bg-amber-50 text-amber-700'
                      : 'bg-[#F0F2F0] text-[#3A424B]';
                  const followUpMeta = getFollowUpMeta(call.nextFollowUpDate);

                  return (
                    <tr
                      key={call.id}
                      onClick={() => onSelectCall(call)}
                      className="hover:bg-[#FBFBF9] cursor-pointer transition-colors group align-top"
                    >
                      {/* Left Edge Priority Indicator Bar (Per Spec Section 7.3 & 8) */}
                      <td
                        className="w-1.5 p-0"
                        style={{ backgroundColor: priorityColor }}
                        title={`Priority: ${call.priority}`}
                      />

                      {/* Job Number (Tabular nums) */}
                      <td className="py-3 px-3 font-mono font-bold text-[#12161A] tabular-nums whitespace-nowrap">
                        #{call.jobNumber}
                      </td>

                      {/* Client */}
                      <td className="py-3 px-3 font-semibold text-[#12161A] max-w-[160px] truncate">
                        {call.client?.name || 'Customer'}
                        {call.client?.phone && (
                          <span className="block text-[11px] font-normal text-[#6B7A88]">
                            {call.client.phone}
                          </span>
                        )}
                      </td>

                      {/* Summary */}
                      <td className="py-3 px-3 text-[#3A424B] max-w-[280px] min-w-[200px] align-top">
                        <p className="line-clamp-3">{call.description}</p>
                      </td>

                      {/* Reported Date */}
                      <td className="py-3 px-3 text-[#3A424B] whitespace-nowrap">
                        <span>{formatDate(call.reportedDate)}</span>
                        <span className="block text-[10px] text-[#6B7A88]">
                          {formatRelativeDate(call.reportedDate)}
                        </span>
                      </td>

                      {/* Days Open */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span
                          className={`inline-block text-[11px] font-bold px-2 py-0.5 rounded-full tabular-nums ${daysOpenClasses}`}
                        >
                          {daysOpen} {daysOpen === 1 ? 'day' : 'days'}
                        </span>
                      </td>

                      {/* Next Follow-Up */}
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

                      {/* Assigned Crew */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        {call.installer ? (
                          <span className="font-medium text-[#12161A]">
                            {call.installer.fullName}
                          </span>
                        ) : (
                          <span className="text-amber-700 italic font-medium">Unassigned</span>
                        )}
                      </td>

                      {/* Install Date */}
                      <td className="py-3 px-3 text-[#3A424B] whitespace-nowrap">
                        {formatDate(call.installDate)}
                      </td>

                      {/* Priority */}
                      <td className="py-3 px-3 font-bold uppercase whitespace-nowrap">
                        <span style={{ color: priorityColor }}>{call.priority}</span>
                      </td>

                      {/* Responsibility */}
                      <td className="py-3 px-3 capitalize text-[#3A424B] whitespace-nowrap">
                        {call.responsibility}
                      </td>

                      {/* Billing */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span
                          className={`font-semibold capitalize ${
                            call.billing === 'paid' ? 'text-emerald-700' : 'text-amber-700'
                          }`}
                        >
                          {call.billing}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span
                          className={`inline-block text-[11px] font-semibold px-2 py-0.5 rounded-full ${statusBadge.bg} ${statusBadge.text}`}
                        >
                          {statusBadge.label}
                        </span>
                      </td>

                      {/* Right Action / Media Indicator */}
                      <td className="py-3 px-3 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-2 text-gray-400 group-hover:text-[#12161A]">
                          {attachmentCount > 0 && (
                            <span className="flex items-center gap-0.5 text-xs text-[#0F5CC4]" title={`${attachmentCount} attachments`}>
                              <Paperclip className="w-3.5 h-3.5" />
                              <span className="text-[10px] font-bold">{attachmentCount}</span>
                            </span>
                          )}
                          <ChevronRight className="w-4 h-4" />
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={14} className="py-12 text-center text-[#6B7A88]">
                    <p className="text-sm font-medium">No service calls found matching filters.</p>
                    <button
                      onClick={onCreateCall}
                      className="mt-3 px-3 py-1.5 bg-[#0F5CC4] text-white rounded-lg text-xs font-semibold"
                    >
                      Create First Call
                    </button>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Footer Summary */}
        <div className="px-4 py-2.5 bg-[#FBFBF9] border-t border-[#DFE2DE] flex items-center justify-between text-xs text-[#6B7A88]">
          <span>
            Showing <strong>{filteredCalls.length}</strong> of <strong>{calls.length}</strong> total service calls
          </span>
          <span>Click any row to view detail, reassign crew, or inspect photos</span>
        </div>
      </div>
    </div>
  );
};
