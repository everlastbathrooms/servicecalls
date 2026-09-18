import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Wrench, CheckCircle2, User, RefreshCw, LogOut } from 'lucide-react';
import { ServiceCall, UserProfile } from '../../types';
import * as api from '../../lib/api';
import { CallCard } from './CallCard';
import { CallDetail } from './CallDetail';

interface InstallerPortalProps {
  currentUser: UserProfile;
  onLogout: () => void;
}

type TabType = 'my_calls' | 'completed' | 'account';

export const InstallerPortal: React.FC<InstallerPortalProps> = ({ currentUser, onLogout }) => {
  const [activeTab, setActiveTab] = useState<TabType>('my_calls');
  const [statusFilter, setStatusFilter] = useState<'open' | 'blocked' | 'all'>('open');
  const [selectedCallId, setSelectedCallId] = useState<string | null>(null);
  const [myCalls, setMyCalls] = useState<ServiceCall[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const loadCalls = useCallback(async () => {
    setIsLoading(true);
    try {
      // RLS restricts this query to calls assigned to the signed-in installer.
      const calls = await api.getServiceCalls();
      setMyCalls(calls);
    } catch (err: any) {
      showToast(`Error loading calls: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCalls();
  }, [loadCalls]);

  const selectedCall = useMemo(
    () => myCalls.find((c) => c.id === selectedCallId) || null,
    [myCalls, selectedCallId]
  );

  const displayCalls = useMemo(() => {
    if (activeTab === 'completed') {
      return myCalls.filter((c) => c.status === 'completed');
    }
    if (statusFilter === 'open') {
      return myCalls.filter((c) => c.status === 'open' || c.status === 'in_progress');
    }
    if (statusFilter === 'blocked') {
      return myCalls.filter((c) => c.status === 'blocked');
    }
    return myCalls.filter((c) => c.status !== 'completed');
  }, [myCalls, activeTab, statusFilter]);

  const handleStatusUpdate = async (
    status: 'completed' | 'blocked' | 'in_progress',
    note?: string
  ) => {
    if (!selectedCallId) return;
    try {
      await api.installerCompleteCall({ callId: selectedCallId, status, note });
      showToast(status === 'completed' ? 'Marked complete' : 'Marked as blocked');
      if (status === 'completed') setSelectedCallId(null);
      await loadCalls();
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  const handleAddNote = async (noteText: string) => {
    if (!selectedCallId) return;
    try {
      await api.addNote(selectedCallId, noteText, 'shared');
      showToast('Note added');
      await loadCalls();
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  if (selectedCall) {
    return (
      <CallDetail
        call={selectedCall}
        currentUser={currentUser}
        onBack={() => setSelectedCallId(null)}
        onStatusUpdate={handleStatusUpdate}
        onAddNote={handleAddNote}
        onRefresh={loadCalls}
      />
    );
  }

  const openCount = myCalls.filter((c) => c.status === 'open' || c.status === 'in_progress').length;
  const blockedCount = myCalls.filter((c) => c.status === 'blocked').length;
  const completedCount = myCalls.filter((c) => c.status === 'completed').length;

  return (
    <div className="flex flex-col min-h-screen bg-[#FBFBF9] text-[#12161A] pb-24">
      {toastMessage && (
        <div className="fixed top-3 inset-x-4 z-50 flex justify-center">
          <div className="bg-[#12161A] text-white px-4 py-2.5 rounded-xl text-xs font-semibold shadow-xl border border-white/10 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>{toastMessage}</span>
          </div>
        </div>
      )}

      <header className="sticky top-0 z-30 bg-white border-b border-[#DFE2DE] px-4 py-3 shadow-2xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 overflow-hidden">
              <img src="/everlast-logo.jpg" alt="Everlast Bathrooms" className="w-full h-full object-contain" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-[#12161A] tracking-tight">
                EVERLAST BATHROOMS
              </h1>
              <p className="text-[11px] text-[#6B7A88]">
                Installer Portal • <span className="font-semibold text-[#12161A]">{currentUser.fullName}</span>
              </p>
            </div>
          </div>

          <button
            onClick={loadCalls}
            className={`p-2 text-gray-500 hover:text-[#12161A] rounded-lg transition-transform ${isLoading ? 'animate-spin' : ''}`}
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </header>

      <main className="flex-1 px-4 py-4 max-w-lg mx-auto w-full">
        {activeTab === 'my_calls' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              <button
                onClick={() => setStatusFilter('open')}
                className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors flex items-center gap-1.5 shrink-0 ${
                  statusFilter === 'open'
                    ? 'bg-[#12161A] text-white shadow-xs'
                    : 'bg-white text-[#3A424B] border border-[#DFE2DE] hover:bg-gray-50'
                }`}
              >
                <span>Open</span>
                <span className="text-[10px] opacity-80 px-1.5 py-0.2 bg-white/20 rounded-full">
                  {openCount}
                </span>
              </button>

              <button
                onClick={() => setStatusFilter('blocked')}
                className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors flex items-center gap-1.5 shrink-0 ${
                  statusFilter === 'blocked'
                    ? 'bg-[#C97A16] text-white shadow-xs'
                    : 'bg-white text-[#3A424B] border border-[#DFE2DE] hover:bg-gray-50'
                }`}
              >
                <span>Blocked</span>
                {blockedCount > 0 && (
                  <span className="text-[10px] opacity-90 px-1.5 py-0.2 bg-white/30 rounded-full">
                    {blockedCount}
                  </span>
                )}
              </button>

              <button
                onClick={() => setStatusFilter('all')}
                className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors shrink-0 ${
                  statusFilter === 'all'
                    ? 'bg-[#12161A] text-white shadow-xs'
                    : 'bg-white text-[#3A424B] border border-[#DFE2DE] hover:bg-gray-50'
                }`}
              >
                All Active ({openCount + blockedCount})
              </button>
            </div>

            {displayCalls.length > 0 ? (
              <div className="space-y-3">
                {displayCalls.map((call) => (
                  <CallCard key={call.id} call={call} onClick={() => setSelectedCallId(call.id)} />
                ))}
              </div>
            ) : (
              <div className="bg-white rounded-xl p-8 border border-[#DFE2DE] text-center my-6">
                <p className="text-sm font-medium text-[#3A424B]">
                  {isLoading ? 'Loading calls…' : 'No open calls right now.'}
                </p>
                {!isLoading && (
                  <p className="text-xs text-[#6B7A88] mt-1">
                    You will receive an automatic email when the office assigns a new service call.
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'completed' && (
          <div className="space-y-4">
            <h2 className="text-sm font-bold uppercase tracking-wider text-[#3A424B]">
              Completed Service Calls ({displayCalls.length})
            </h2>

            {displayCalls.length > 0 ? (
              <div className="space-y-3">
                {displayCalls.map((call) => (
                  <CallCard key={call.id} call={call} onClick={() => setSelectedCallId(call.id)} />
                ))}
              </div>
            ) : (
              <div className="bg-white rounded-xl p-8 border border-[#DFE2DE] text-center my-6">
                <p className="text-sm font-medium text-[#3A424B]">No completed calls yet.</p>
                <p className="text-xs text-[#6B7A88] mt-1">
                  Calls you mark complete will appear here with your resolution photos.
                </p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'account' && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl p-5 border border-[#DFE2DE] shadow-xs">
              <div className="flex items-center gap-3.5 mb-4">
                <div className="w-12 h-12 rounded-full bg-[#12161A] text-white flex items-center justify-center font-bold text-base">
                  {currentUser.fullName.charAt(0)}
                </div>
                <div>
                  <h2 className="text-base font-bold text-[#12161A]">{currentUser.fullName}</h2>
                  <p className="text-xs text-[#6B7A88] font-mono">{currentUser.email}</p>
                  <span className="inline-block mt-1 px-2 py-0.5 bg-[#0F5CC4]/10 text-[#0F5CC4] text-[10px] font-bold uppercase rounded">
                    Field Crew Installer
                  </span>
                </div>
              </div>

              <div className="space-y-2.5 pt-3 border-t border-[#DFE2DE] text-xs">
                <div className="flex justify-between py-1">
                  <span className="text-[#6B7A88]">Phone:</span>
                  <span className="font-medium">{currentUser.phone || 'Not set'}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-[#6B7A88]">Email Alerts:</span>
                  <span className="font-medium text-emerald-700">
                    {currentUser.notifyByEmail ? 'Active (dispatched on assignment)' : 'Off'}
                  </span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-[#6B7A88]">Total Calls Assigned:</span>
                  <span className="font-bold">{myCalls.length}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-[#6B7A88]">Completed by You:</span>
                  <span className="font-bold text-emerald-700">{completedCount}</span>
                </div>
              </div>
            </div>

            <button
              onClick={onLogout}
              className="w-full py-3 px-4 bg-white hover:bg-gray-50 border border-[#DFE2DE] text-red-600 font-semibold rounded-xl text-xs flex items-center justify-center gap-2 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span>Sign Out</span>
            </button>
          </div>
        )}
      </main>

      <nav className="fixed bottom-0 inset-x-0 z-40 bg-white border-t border-[#DFE2DE] shadow-lg max-w-lg mx-auto">
        <div className="grid grid-cols-3 h-16">
          <button
            onClick={() => setActiveTab('my_calls')}
            className={`flex flex-col items-center justify-center gap-1 transition-colors ${
              activeTab === 'my_calls' ? 'text-[#0F5CC4] font-bold' : 'text-[#6B7A88] font-medium'
            }`}
          >
            <div className="relative">
              <Wrench className="w-5 h-5" />
              {openCount > 0 && (
                <span className="absolute -top-1 -right-2 w-4 h-4 bg-[#0F5CC4] text-white text-[9px] rounded-full flex items-center justify-center font-bold">
                  {openCount}
                </span>
              )}
            </div>
            <span className="text-[11px]">My Calls</span>
          </button>

          <button
            onClick={() => setActiveTab('completed')}
            className={`flex flex-col items-center justify-center gap-1 transition-colors ${
              activeTab === 'completed' ? 'text-[#0F5CC4] font-bold' : 'text-[#6B7A88] font-medium'
            }`}
          >
            <div className="relative">
              <CheckCircle2 className="w-5 h-5" />
              {completedCount > 0 && (
                <span className="absolute -top-1 -right-2 w-4 h-4 bg-emerald-600 text-white text-[9px] rounded-full flex items-center justify-center font-bold">
                  {completedCount}
                </span>
              )}
            </div>
            <span className="text-[11px]">Completed</span>
          </button>

          <button
            onClick={() => setActiveTab('account')}
            className={`flex flex-col items-center justify-center gap-1 transition-colors ${
              activeTab === 'account' ? 'text-[#0F5CC4] font-bold' : 'text-[#6B7A88] font-medium'
            }`}
          >
            <User className="w-5 h-5" />
            <span className="text-[11px]">Account</span>
          </button>
        </div>
      </nav>
    </div>
  );
};
