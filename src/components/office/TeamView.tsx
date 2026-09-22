import React from 'react';
import { UserPlus, ShieldOff, ShieldCheck } from 'lucide-react';
import { UserProfile } from '../../types';

interface TeamViewProps {
  team: UserProfile[];
  onInvite: () => void;
  onToggleActive: (user: UserProfile) => void;
  onEditMember: (user: UserProfile) => void;
}

export const TeamView: React.FC<TeamViewProps> = ({ team, onInvite, onToggleActive, onEditMember }) => {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold uppercase tracking-wider text-[#3A424B]">
          Crew &amp; Office Accounts ({team.length})
        </h2>
        <button
          onClick={onInvite}
          className="px-3.5 py-1.5 bg-[#0F5CC4] hover:bg-[#0E52B0] text-white text-xs font-bold rounded-lg flex items-center gap-1.5 shadow-xs transition-colors"
        >
          <UserPlus className="w-3.5 h-3.5" />
          <span>Invite Crew Member</span>
        </button>
      </div>

      <div className="bg-white rounded-xl border border-[#DFE2DE] shadow-xs overflow-hidden">
        <table className="w-full text-left text-xs border-collapse">
          <thead className="bg-[#F0F2F0] text-[#3A424B] border-b border-[#DFE2DE] uppercase tracking-wider font-semibold">
            <tr>
              <th className="py-3 px-4">Name</th>
              <th className="py-3 px-4">Email</th>
              <th className="py-3 px-4">Phone</th>
              <th className="py-3 px-4">Role</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4 text-right"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#DFE2DE]">
            {team.map((member) => (
              <tr key={member.id} className="hover:bg-[#FBFBF9]">
                <td className="py-3 px-4">
                  <button
                    onClick={() => onEditMember(member)}
                    className="font-semibold text-[#0F5CC4] hover:underline"
                    title="Edit name, role, or password"
                  >
                    {member.fullName}
                  </button>
                </td>
                <td className="py-3 px-4 text-[#3A424B]">{member.email}</td>
                <td className="py-3 px-4 text-[#3A424B]">{member.phone || '—'}</td>
                <td className="py-3 px-4 capitalize text-[#3A424B]">{member.role}</td>
                <td className="py-3 px-4">
                  <span
                    className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                      member.isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {member.isActive ? 'Active' : 'Deactivated'}
                  </span>
                </td>
                <td className="py-3 px-4 text-right">
                  <button
                    onClick={() => onToggleActive(member)}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#3A424B] hover:text-[#12161A]"
                  >
                    {member.isActive ? (
                      <>
                        <ShieldOff className="w-3.5 h-3.5" />
                        <span>Deactivate</span>
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="w-3.5 h-3.5" />
                        <span>Reactivate</span>
                      </>
                    )}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {team.length === 0 && (
          <div className="py-12 text-center text-[#6B7A88]">
            <p className="text-sm font-medium">No crew accounts yet.</p>
          </div>
        )}
      </div>
    </div>
  );
};
