export type UserRole = 'admin' | 'office' | 'installer';
export type CallPriority = 'low' | 'mid' | 'high';
export type CallStatus = 'open' | 'in_progress' | 'blocked' | 'completed' | 'cancelled';
export type Responsibility = 'installer' | 'office' | 'manufacturer' | 'client' | 'unknown';
export type BillingType = 'unpaid' | 'paid' | 'undecided';
export type AttachmentKind = 'image' | 'video' | 'document';
export type AttachmentPhase = 'reported' | 'resolution';
export type NoteVisibility = 'shared' | 'internal';

export interface UserProfile {
  id: string;
  fullName: string;
  role: UserRole;
  email: string;
  phone?: string | null;
  isActive: boolean;
  notifyByEmail: boolean;
  createdAt: string;
}

export interface Client {
  id: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  createdAt: string;
}

export interface Attachment {
  id: string;
  serviceCallId: string;
  storagePath: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  kind: AttachmentKind;
  phase: AttachmentPhase;
  uploadedBy: string;
  uploaderName?: string;
  createdAt: string;
  url: string; // Signed Supabase Storage URL
}

export interface ServiceCallNote {
  id: string;
  serviceCallId: string;
  authorId: string;
  authorName: string;
  authorRole: UserRole;
  body: string;
  visibility: NoteVisibility;
  createdAt: string;
}

export interface ServiceCall {
  id: string;
  jobNumber: string; // Reference field, non-unique per spec (e.g. 1537, 1577)
  clientId: string;
  client?: Client;
  installerId?: string | null;
  installer?: UserProfile | null;
  reportedDate: string; // YYYY-MM-DD
  installDate?: string | null; // YYYY-MM-DD
  priority: CallPriority;
  description: string;
  responsibility: Responsibility;
  billing: BillingType;
  status: CallStatus;
  completionNote?: string | null;
  completedAt?: string | null;
  completedBy?: string | null;
  completedByName?: string | null;
  nextFollowUpDate?: string | null; // YYYY-MM-DD
  createdBy: string;
  createdByName?: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
  deletedByName?: string | null;
  attachments?: Attachment[];
  notes?: ServiceCallNote[];
}

export interface NotificationLog {
  id: string;
  serviceCallId: string;
  recipientEmail: string;
  eventType: 'new_call' | 'updated' | 'reassigned' | 'overdue' | 'completed';
  status: 'sent' | 'queued' | 'failed';
  error?: string | null;
  createdAt: string;
}

// ---------- Customer Communications Log (office/admin only) ----------

export type CommunicationMethod = 'phone' | 'email' | 'text' | 'in_person' | 'other';
export type CommunicationStatus = 'open' | 'in_progress' | 'resolved' | 'closed';
export type CommunicationRequestType =
  | 'order_status'
  | 'installation_coordination'
  | 'project_scope'
  | 'other';

export interface CommunicationNote {
  id: string;
  communicationId: string;
  authorId: string;
  authorName: string;
  body: string;
  createdAt: string;
}

export interface CustomerCommunication {
  id: string;
  clientId: string | null;
  serviceCallId: string | null; // only set when logged from a specific job's page
  jobNumber?: string; // from the linked service call, if any, for display
  clientName?: string; // from the client, for display
  clientPhone?: string | null; // from the client, for display
  dateReceived: string; // YYYY-MM-DD
  method: CommunicationMethod;
  requestType: CommunicationRequestType | null; // null on tickets logged before this field existed
  status: CommunicationStatus;
  handledBy: string;
  handledByName?: string;
  summary: string;
  nextFollowUpDate?: string | null; // YYYY-MM-DD
  createdBy: string;
  createdByName?: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
  deletedByName?: string | null;
  notes?: CommunicationNote[];
}
