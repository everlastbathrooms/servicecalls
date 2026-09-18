import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ClipboardList, Plus, LogOut, CheckCircle2, RefreshCw, Users } from 'lucide-react';
import { ServiceCall, UserProfile } from '../../types';
import * as api from '../../lib/api';
import { ServiceCallsTable } from './ServiceCallsTable';
import { CallDetailOffice } from './CallDetailOffice';
import { CreateCallModal } from './CreateCallModal';
import { TeamView } from './TeamView';
import { InviteCrewModal } from './InviteCrewModal';

interface OfficePortalProps {
  currentUser: UserProfile;
  onLogout: () => void;
}

type OfficeNavigationTab = 'service_calls' | 'team';

export const OfficePortal: React.FC<OfficePortalProps> = ({ currentUser, onLogout }) => {
  const [currentTab, setCurrentTab] = useState<OfficeNavigationTab>('service_calls');
  const [calls, setCalls] = useState<ServiceCall[]>([]);
  const [installers, setInstallers] = useState<UserProfile[]>([]);
  const [team, setTeam] = useState<UserProfile[]>([]);
  const [selectedCallId, setSelectedCallId] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const isAdmin = currentUser.role === 'admin';

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [callsData, installersData, teamData] = await Promise.all([
        api.getServiceCalls(),
        api.getActiveInstallers(),
        isAdmin ? api.getAllTeamMembers() : Promise.resolve<UserProfile[]>([]),
      ]);
      setCalls(callsData);
      setInstallers(installersData);
      setTeam(teamData);
    } catch (err: any) {
      showToast(`Error loading data: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const selectedCall = useMemo(
    () => calls.find((c) => c.id === selectedCallId) || null,
    [selectedCallId, calls]
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

  const handleUploadAttachment = async (callId: string, file: File) => {
    try {
      await api.uploadAttachment({ callId, file, phase: 'reported' });
      await loadData();
      showToast('Media uploaded');
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

  const openCallsCount = calls.filter((c) => c.status === 'open' || c.status === 'in_progress').length;

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
              Service Call Portal
            </span>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto p-3 text-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 px-3 block mb-1.5">
            Work Orders
          </span>
          <button
            onClick={() => {
              setCurrentTab('service_calls');
              setSelectedCallId(null);
            }}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-lg font-medium transition-colors ${
              currentTab === 'service_calls' && !selectedCallId
                ? 'bg-[#0F5CC4] text-white font-bold'
                : 'text-gray-300 hover:text-white hover:bg-white/5'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <ClipboardList className="w-4 h-4" />
              <span>Service Calls</span>
            </div>
            {openCallsCount > 0 && (
              <span className="bg-[#0F5CC4]/20 text-blue-300 text-[10px] font-bold px-2 py-0.5 rounded-full">
                {openCallsCount} open
              </span>
            )}
          </button>

          {isAdmin && (
            <>
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 px-3 block mt-6 mb-1.5">
                Manage
              </span>
              <button
                onClick={() => {
                  setCurrentTab('team');
                  setSelectedCallId(null);
                }}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg font-medium transition-colors ${
                  currentTab === 'team' && !selectedCallId
                    ? 'bg-[#0F5CC4] text-white font-bold'
                    : 'text-gray-300 hover:text-white hover:bg-white/5'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Users className="w-4 h-4" />
                  <span>Team</span>
                </div>
                <span className="bg-white/10 text-gray-300 text-[10px] px-1.5 py-0.5 rounded font-mono">
                  {team.length}
                </span>
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
              : currentTab === 'team'
              ? 'Crew & Office Accounts'
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
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="px-3.5 py-1.5 bg-[#0F5CC4] hover:bg-[#0E52B0] text-white text-xs font-bold rounded-lg flex items-center gap-1.5 shadow-xs transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create Call</span>
            </button>
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
              />
            ) : currentTab === 'team' && isAdmin ? (
              <TeamView
                team={team}
                onInvite={() => setIsInviteModalOpen(true)}
                onToggleActive={handleToggleActive}
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

      {isAdmin && (
        <InviteCrewModal
          isOpen={isInviteModalOpen}
          onClose={() => setIsInviteModalOpen(false)}
          onSuccess={loadData}
        />
      )}
    </div>
  );
};
