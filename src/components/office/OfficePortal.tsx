import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ClipboardList, Plus, LogOut, CheckCircle2, RefreshCw, Users, MessageCircle, Trash2 } from 'lucide-react';
import {
  CommunicationMethod,
  CommunicationRequestType,
  CommunicationStatus,
  CustomerCommunication,
  ServiceCall,
  UserProfile,
  UserRole,
} from '../../types';
import * as api from '../../lib/api';
import { ServiceCallsTable } from './ServiceCallsTable';
import { CallDetailOffice } from './CallDetailOffice';
import { CreateCallModal } from './CreateCallModal';
import { TeamView } from './TeamView';
import { InviteCrewModal } from './InviteCrewModal';
import { EditTeamMemberModal } from './EditTeamMemberModal';
import { CommunicationsTable } from './CommunicationsTable';
import { CommunicationDetail } from './CommunicationDetail';
import { CreateCommunicationModal } from './CreateCommunicationModal';
import { BulkActivateModal } from './BulkActivateModal';
import { TrashView } from './TrashView';

interface OfficePortalProps {
  currentUser: UserProfile;
  onLogout: () => void;
}

type OfficeNavigationTab = 'service_calls' | 'communications' | 'team' | 'trash';

// Keep the current tab in the URL hash (not a real route, so it needs no
// server-side rewrite config) purely so a browser refresh lands back on the
// section the user was viewing instead of always resetting to Service Calls.
function readTabFromHash(isAdmin: boolean): OfficeNavigationTab {
  const hash = window.location.hash.replace('#', '');
  if ((hash === 'team' || hash === 'trash') && isAdmin) return hash;
  if (hash === 'communications') return 'communications';
  return 'service_calls';
}

export const OfficePortal: React.FC<OfficePortalProps> = ({ currentUser, onLogout }) => {
  const [currentTab, setCurrentTab] = useState<OfficeNavigationTab>(() =>
    readTabFromHash(currentUser.role === 'admin')
  );
  const [calls, setCalls] = useState<ServiceCall[]>([]);
  const [installers, setInstallers] = useState<UserProfile[]>([]);
  const [team, setTeam] = useState<UserProfile[]>([]);
  const [communications, setCommunications] = useState<CustomerCommunication[]>([]);
  const [selectedCallId, setSelectedCallId] = useState<string | null>(null);
  const [selectedCommunicationId, setSelectedCommunicationId] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [isCreateCommunicationOpen, setIsCreateCommunicationOpen] = useState(false);
  const [presetCommServiceCallId, setPresetCommServiceCallId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [unactivatedMembers, setUnactivatedMembers] = useState<
    { id: string; fullName: string; email: string; role: UserRole }[]
  >([]);
  const [isBulkActivateOpen, setIsBulkActivateOpen] = useState(false);
  const [deletedCalls, setDeletedCalls] = useState<ServiceCall[]>([]);
  const [deletedCommunications, setDeletedCommunications] = useState<CustomerCommunication[]>([]);

  const isAdmin = currentUser.role === 'admin';

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [callsData, installersData, teamData, communicationsData] = await Promise.all([
        api.getServiceCalls(),
        api.getActiveInstallers(),
        api.getAllTeamMembers(),
        api.getCommunications(),
      ]);
      setCalls(callsData);
      setInstallers(installersData);
      setTeam(teamData);
      setCommunications(communicationsData);
    } catch (err: any) {
      showToast(`Error loading data: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const refreshUnactivatedMembers = useCallback(async () => {
    if (!isAdmin) return;
    try {
      const members = await api.listUnactivatedTeamMembers();
      setUnactivatedMembers(members);
    } catch {
      // Non-critical: the banner just won't show if this fails.
    }
  }, [isAdmin]);

  useEffect(() => {
    if (currentTab === 'team' && isAdmin) {
      refreshUnactivatedMembers();
    }
  }, [currentTab, isAdmin, refreshUnactivatedMembers]);

  const refreshTrash = useCallback(async () => {
    if (!isAdmin) return;
    try {
      const [deletedCallsData, deletedCommsData] = await Promise.all([
        api.getDeletedServiceCalls(),
        api.getDeletedCommunications(),
      ]);
      setDeletedCalls(deletedCallsData);
      setDeletedCommunications(deletedCommsData);
    } catch (err: any) {
      showToast(`Error loading trash: ${err.message}`);
    }
  }, [isAdmin]);

  useEffect(() => {
    if (currentTab === 'trash' && isAdmin) {
      refreshTrash();
    }
  }, [currentTab, isAdmin, refreshTrash]);

  // Also fetch once on load (not just when the Trash tab is opened) so the
  // sidebar badge count is accurate right away.
  useEffect(() => {
    refreshTrash();
  }, [refreshTrash]);

  const selectedCall = useMemo(
    () => calls.find((c) => c.id === selectedCallId) || null,
    [selectedCallId, calls]
  );

  const editingMember = useMemo(
    () => team.find((m) => m.id === editingMemberId) || null,
    [editingMemberId, team]
  );

  const selectedCommunication = useMemo(
    () => communications.find((c) => c.id === selectedCommunicationId) || null,
    [selectedCommunicationId, communications]
  );

  const officeAndAdminTeam = useMemo(
    () => team.filter((m) => m.role === 'admin' || m.role === 'office'),
    [team]
  );

  const handleCreateSuccess = async (newCallId: string) => {
    await loadData();
    showToast('Service call created & automatic email dispatched to assigned crew!');
    setSelectedCallId(newCallId);
  };

  const handleUpdateCall = async (callId: string, updates: Partial<ServiceCall>) => {
    try {
      await api.updateServiceCall(callId, {
        installerId: updates.installerId,
        priority: updates.priority,
        responsibility: updates.responsibility,
        billing: updates.billing,
        status: updates.status,
        nextFollowUpDate: updates.nextFollowUpDate,
      });
      await loadData();
      showToast('Work order updated');
    } catch (e: any) {
      alert(`Error: ${e.message}`);
    }
  };

  const handleAddNote = async (callId: string, body: string, visibility: 'shared' | 'internal') => {
    try {
      await api.addNote(callId, body, visibility);
      await loadData();
      showToast('Note posted');
    } catch (e: any) {
      alert(`Error: ${e.message}`);
    }
  };

  const handleDeleteCall = async (callId: string) => {
    try {
      await api.deleteServiceCall(callId);
      setSelectedCallId(null);
      await Promise.all([loadData(), refreshTrash()]);
      showToast('Work order moved to Trash');
    } catch (e: any) {
      alert(`Error: ${e.message}`);
    }
  };

  const handleRestoreCall = async (callId: string) => {
    try {
      await api.restoreServiceCall(callId);
      await Promise.all([loadData(), refreshTrash()]);
      showToast('Work order restored');
    } catch (e: any) {
      alert(`Error: ${e.message}`);
    }
  };

  const handlePermanentlyDeleteCall = async (callId: string) => {
    try {
      await api.permanentlyDeleteServiceCall(callId);
      await refreshTrash();
      showToast('Work order permanently deleted');
    } catch (e: any) {
      alert(`Error: ${e.message}`);
    }
  };

  const handleUploadAttachment = async (callId: string, file: File) => {
    try {
      await api.uploadAttachment({ callId, file, phase: 'reported' });
      await loadData();
      showToast('Media uploaded');
    } catch (e: any) {
      alert(`Error: ${e.message}`);
    }
  };

  const openCreateCommunication = (serviceCallId?: string) => {
    setPresetCommServiceCallId(serviceCallId || null);
    setIsCreateCommunicationOpen(true);
  };

  const handleCreateCommunicationSuccess = async () => {
    await loadData();
    showToast('Ticket logged');
  };

  const handleViewJobFromCommunication = (serviceCallId: string) => {
    setSelectedCommunicationId(null);
    setCurrentTab('service_calls');
    setSelectedCallId(serviceCallId);
  };

  const handleUpdateCommunication = async (
    id: string,
    updates: {
      status?: CommunicationStatus;
      handledBy?: string;
      method?: CommunicationMethod;
      requestType?: CommunicationRequestType | null;
      nextFollowUpDate?: string | null;
    }
  ) => {
    try {
      await api.updateCommunication(id, updates);
      await loadData();
      showToast('Communication updated');
    } catch (e: any) {
      alert(`Error: ${e.message}`);
    }
  };

  const handleAddCommunicationNote = async (id: string, body: string) => {
    try {
      await api.addCommunicationNote(id, body);
      await loadData();
      showToast('Update posted');
    } catch (e: any) {
      alert(`Error: ${e.message}`);
    }
  };

  const handleDeleteCommunication = async (id: string) => {
    try {
      await api.deleteCommunication(id);
      setSelectedCommunicationId(null);
      await Promise.all([loadData(), refreshTrash()]);
      showToast('Ticket moved to Trash');
    } catch (e: any) {
      alert(`Error: ${e.message}`);
    }
  };

  const handleRestoreCommunication = async (id: string) => {
    try {
      await api.restoreCommunication(id);
      await Promise.all([loadData(), refreshTrash()]);
      showToast('Ticket restored');
    } catch (e: any) {
      alert(`Error: ${e.message}`);
    }
  };

  const handlePermanentlyDeleteCommunication = async (id: string) => {
    try {
      await api.permanentlyDeleteCommunication(id);
      await refreshTrash();
      showToast('Ticket permanently deleted');
    } catch (e: any) {
      alert(`Error: ${e.message}`);
    }
  };

  const handleToggleActive = async (member: UserProfile) => {
    try {
      await api.setTeamMemberActive(member.id, !member.isActive);
      await loadData();
      showToast(member.isActive ? `${member.fullName} deactivated` : `${member.fullName} reactivated`);
    } catch (e: any) {
      alert(`Error: ${e.message}`);
    }
  };

  const handleBulkActivate = async (password: string) => {
    const ids = unactivatedMembers.map((m) => m.id);
    const count = await api.bulkActivateTeamMembers(ids, password);
    showToast(`${count} account${count === 1 ? '' : 's'} activated`);
    setIsBulkActivateOpen(false);
    await refreshUnactivatedMembers();
  };

  const openCallsCount = calls.filter((c) => c.status === 'open' || c.status === 'in_progress').length;
  const openCommunicationsCount = communications.filter((c) => c.status === 'open' || c.status === 'in_progress').length;

  const goToTab = (tab: OfficeNavigationTab) => {
    setCurrentTab(tab);
    setSelectedCallId(null);
    setSelectedCommunicationId(null);
    window.history.replaceState(null, '', `#${tab}`);
  };

  return (
    <div className="flex h-screen bg-[#FBFBF9] text-[#12161A] overflow-hidden font-sans">
      {toastMessage && (
        <div className="fixed top-4 right-4 z-50">
          <div className="bg-[#12161A] text-white px-4 py-3 rounded-xl text-xs font-semibold shadow-2xl border border-white/10 flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{toastMessage}</span>
          </div>
        </div>
      )}

      {/* Left Sidebar */}
      <aside className="w-60 bg-[#12161A] text-white flex flex-col shrink-0 border-r border-[#3A424B]/30 select-none">
        <div className="p-4 border-b border-white/10 flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center shrink-0 overflow-hidden">
            <img src="/everlast-logo.jpg" alt="Everlast Bathrooms" className="w-full h-full object-contain" />
          </div>
          <div>
            <span className="font-bold text-sm tracking-tight block leading-tight">EVERLAST</span>
            <span className="text-[10px] text-gray-400 tracking-wider uppercase font-semibold">
              Client Communications Portal
            </span>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto p-3 text-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 px-3 block mb-1.5">
            Customer Service
          </span>
          <button
            onClick={() => goToTab('service_calls')}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-lg font-medium text-left transition-colors ${
              currentTab === 'service_calls' && !selectedCallId
                ? 'bg-[#0F5CC4] text-white font-bold'
                : 'text-gray-300 hover:text-white hover:bg-white/5'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <ClipboardList className="w-4 h-4 shrink-0" />
              <span>Service Calls (Post-Install)</span>
            </div>
            {openCallsCount > 0 && (
              <span className="bg-[#0F5CC4]/20 text-blue-300 text-[10px] font-bold px-2 py-0.5 rounded-full">
                {openCallsCount} open
              </span>
            )}
          </button>
          <button
            onClick={() => goToTab('communications')}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-lg font-medium text-left transition-colors mt-1 ${
              currentTab === 'communications' && !selectedCommunicationId
                ? 'bg-[#0F5CC4] text-white font-bold'
                : 'text-gray-300 hover:text-white hover:bg-white/5'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <MessageCircle className="w-4 h-4 shrink-0" />
              <span>Client Communications (Pre-Install)</span>
            </div>
            {openCommunicationsCount > 0 && (
              <span className="bg-[#0F5CC4]/20 text-blue-300 text-[10px] font-bold px-2 py-0.5 rounded-full">
                {openCommunicationsCount} open
              </span>
            )}
          </button>

          {isAdmin && (
            <>
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 px-3 block mt-6 mb-1.5">
                Manage
              </span>
              <button
                onClick={() => goToTab('team')}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg font-medium text-left transition-colors ${
                  currentTab === 'team' && !selectedCallId
                    ? 'bg-[#0F5CC4] text-white font-bold'
                    : 'text-gray-300 hover:text-white hover:bg-white/5'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Users className="w-4 h-4 shrink-0" />
                  <span>Team</span>
                </div>
                <span className="bg-white/10 text-gray-300 text-[10px] px-1.5 py-0.5 rounded font-mono">
                  {team.length}
                </span>
              </button>
              <button
                onClick={() => goToTab('trash')}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg font-medium text-left transition-colors mt-1 ${
                  currentTab === 'trash' && !selectedCallId
                    ? 'bg-[#0F5CC4] text-white font-bold'
                    : 'text-gray-300 hover:text-white hover:bg-white/5'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Trash2 className="w-4 h-4 shrink-0" />
                  <span>Trash</span>
                </div>
                {deletedCalls.length + deletedCommunications.length > 0 && (
                  <span className="bg-white/10 text-gray-300 text-[10px] px-1.5 py-0.5 rounded font-mono">
                    {deletedCalls.length + deletedCommunications.length}
                  </span>
                )}
              </button>
            </>
          )}
        </nav>

        <div className="p-3 border-t border-white/10 bg-black/20 text-xs">
          <div className="flex items-center justify-between">
            <div className="truncate">
              <span className="font-bold block truncate text-white">{currentUser.fullName}</span>
              <span className="text-[10px] text-gray-400 capitalize">{currentUser.role} Role</span>
            </div>
            <button
              onClick={onLogout}
              className="p-1.5 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-14 bg-white border-b border-[#DFE2DE] px-6 flex items-center justify-between shrink-0">
          <h2 className="text-sm font-bold text-[#12161A] tracking-tight">
            {selectedCall
              ? `Work Order #${selectedCall.jobNumber}`
              : selectedCommunication
              ? selectedCommunication.jobNumber
                ? `Job #${selectedCommunication.jobNumber} — Customer Service Ticket`
                : `${selectedCommunication.clientName || 'Customer'} — Customer Service Ticket`
              : currentTab === 'team'
              ? 'Crew & Office Accounts'
              : currentTab === 'trash'
              ? 'Trash'
              : currentTab === 'communications'
              ? 'Customer Service Log'
              : 'All Service Calls'}
          </h2>

          <div className="flex items-center gap-3">
            <button
              onClick={loadData}
              className={`p-2 text-gray-500 hover:text-[#12161A] rounded-lg transition-transform ${isLoading ? 'animate-spin' : ''}`}
              title="Refresh"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            {currentTab === 'communications' && !selectedCommunication ? (
              <button
                onClick={() => openCreateCommunication()}
                className="px-3.5 py-1.5 bg-[#0F5CC4] hover:bg-[#0E52B0] text-white text-xs font-bold rounded-lg flex items-center gap-1.5 shadow-xs transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Log Ticket</span>
              </button>
            ) : currentTab === 'service_calls' && !selectedCall ? (
              <button
                onClick={() => setIsCreateModalOpen(true)}
                className="px-3.5 py-1.5 bg-[#0F5CC4] hover:bg-[#0E52B0] text-white text-xs font-bold rounded-lg flex items-center gap-1.5 shadow-xs transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Create Call</span>
              </button>
            ) : null}
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-[1440px] mx-auto">
            {selectedCall ? (
              <CallDetailOffice
                call={selectedCall}
                installers={installers}
                currentUser={currentUser}
                onBack={() => setSelectedCallId(null)}
                onUpdateCall={handleUpdateCall}
                onAddNote={handleAddNote}
                onUploadAttachment={handleUploadAttachment}
                onDeleteCall={handleDeleteCall}
                onLogCommunication={() => openCreateCommunication(selectedCall.id)}
              />
            ) : selectedCommunication ? (
              <CommunicationDetail
                communication={selectedCommunication}
                team={officeAndAdminTeam}
                isAdmin={isAdmin}
                onBack={() => setSelectedCommunicationId(null)}
                onUpdate={handleUpdateCommunication}
                onAddNote={handleAddCommunicationNote}
                onViewJob={handleViewJobFromCommunication}
                onDeleteCommunication={handleDeleteCommunication}
              />
            ) : currentTab === 'team' && isAdmin ? (
              <div className="space-y-4">
                {unactivatedMembers.length > 0 && (
                  <div className="flex items-center justify-between gap-3 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl px-4 py-3 text-xs">
                    <span>
                      <strong>{unactivatedMembers.length}</strong> team member
                      {unactivatedMembers.length === 1 ? ' has' : 's have'} never signed in — their invite may not
                      have gone through: {unactivatedMembers.map((m) => m.fullName).join(', ')}.
                    </span>
                    <button
                      onClick={() => setIsBulkActivateOpen(true)}
                      className="shrink-0 px-3 py-1.5 bg-amber-900 hover:bg-amber-950 text-white text-xs font-bold rounded-lg transition-colors"
                    >
                      Activate All
                    </button>
                  </div>
                )}
                <TeamView
                  team={team}
                  onInvite={() => setIsInviteModalOpen(true)}
                  onToggleActive={handleToggleActive}
                  onEditMember={(member) => setEditingMemberId(member.id)}
                />
              </div>
            ) : currentTab === 'trash' && isAdmin ? (
              <TrashView
                deletedCalls={deletedCalls}
                deletedCommunications={deletedCommunications}
                onRestoreCall={handleRestoreCall}
                onPermanentlyDeleteCall={handlePermanentlyDeleteCall}
                onRestoreCommunication={handleRestoreCommunication}
                onPermanentlyDeleteCommunication={handlePermanentlyDeleteCommunication}
              />
            ) : currentTab === 'communications' ? (
              <CommunicationsTable
                communications={communications}
                onSelect={(c) => setSelectedCommunicationId(c.id)}
                onCreate={() => openCreateCommunication()}
              />
            ) : (
              <ServiceCallsTable
                calls={calls}
                installers={installers}
                onSelectCall={(call) => setSelectedCallId(call.id)}
                onCreateCall={() => setIsCreateModalOpen(true)}
              />
            )}
          </div>
        </main>
      </div>

      <CreateCallModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={handleCreateSuccess}
      />

      <CreateCommunicationModal
        isOpen={isCreateCommunicationOpen}
        currentUser={currentUser}
        serviceCalls={calls}
        presetServiceCallId={presetCommServiceCallId}
        onClose={() => {
          setIsCreateCommunicationOpen(false);
          setPresetCommServiceCallId(null);
        }}
        onSuccess={handleCreateCommunicationSuccess}
      />

      {isAdmin && (
        <InviteCrewModal
          isOpen={isInviteModalOpen}
          onClose={() => setIsInviteModalOpen(false)}
          onSuccess={loadData}
        />
      )}

      {isAdmin && (
        <EditTeamMemberModal
          member={editingMember}
          onClose={() => setEditingMemberId(null)}
          onSaved={loadData}
        />
      )}

      {isAdmin && (
        <BulkActivateModal
          isOpen={isBulkActivateOpen}
          members={unactivatedMembers}
          onClose={() => setIsBulkActivateOpen(false)}
          onActivate={handleBulkActivate}
        />
      )}
    </div>
  );
};
