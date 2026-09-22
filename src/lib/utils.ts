import { CallPriority, CallStatus, ServiceCall } from '../types';

export function formatDate(dateString?: string | null): string {
  if (!dateString) return '—';
  try {
    const parts = dateString.split('T')[0].split('-');
    if (parts.length === 3) {
      const date = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    }
    return dateString;
  } catch {
    return dateString;
  }
}

export function formatRelativeDate(dateString?: string | null): string {
  if (!dateString) return '';
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays > 1 && diffDays < 30) return `${diffDays} days ago`;
    if (diffDays >= 30) return `${Math.floor(diffDays / 30)} mo ago`;
    return formatDate(dateString);
  } catch {
    return dateString;
  }
}

// Whole calendar days between the reported date and now, for "how long has
// this been sitting" at a glance in the calls table. Never negative.
export function getDaysOpen(reportedDate: string): number {
  const reported = new Date(reportedDate);
  const now = new Date();
  const diffMs = now.getTime() - reported.getTime();
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

export function getPriorityBorderColor(priority: CallPriority): string {
  switch (priority) {
    case 'high':
      return '#C4342B'; // High Red
    case 'mid':
      return '#C97A16'; // Mid Amber
    case 'low':
      return '#6B7A88'; // Low Slate
    default:
      return '#DFE2DE';
  }
}

export function getStatusBadge(status: CallStatus): { label: string; bg: string; text: string } {
  switch (status) {
    case 'open':
      return { label: 'Open', bg: 'bg-[#0F5CC4]/10', text: 'text-[#0F5CC4]' };
    case 'in_progress':
      return { label: 'In Progress', bg: 'bg-amber-100', text: 'text-amber-800' };
    case 'blocked':
      return { label: 'Blocked', bg: 'bg-red-100', text: 'text-red-800' };
    case 'completed':
      return { label: 'Completed', bg: 'bg-emerald-100', text: 'text-emerald-800' };
    case 'cancelled':
      return { label: 'Cancelled', bg: 'bg-gray-100', text: 'text-gray-600' };
  }
}

export function exportCallsToCsv(calls: ServiceCall[]): void {
  const headers = [
    'Job Number',
    'Client Name',
    'Client Phone',
    'Reported Date',
    'Install Date',
    'Assigned Installer',
    'Priority',
    'Responsibility',
    'Billing',
    'Status',
    'Description',
    'Completion Note',
  ];

  const rows = calls.map((c) => [
    `"${c.jobNumber}"`,
    `"${c.client?.name || ''}"`,
    `"${c.client?.phone || ''}"`,
    `"${c.reportedDate}"`,
    `"${c.installDate || ''}"`,
    `"${c.installer?.fullName || 'Unassigned'}"`,
    `"${c.priority.toUpperCase()}"`,
    `"${c.responsibility}"`,
    `"${c.billing}"`,
    `"${c.status}"`,
    `"${c.description.replace(/"/g, '""')}"`,
    `"${(c.completionNote || '').replace(/"/g, '""')}"`,
  ]);

  const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `everlast_service_calls_${new Date().toISOString().split('T')[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
