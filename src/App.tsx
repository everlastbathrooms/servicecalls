import React, { useState, useEffect } from 'react';
import { UserProfile } from './types';
import { supabase } from './lib/supabase';
import { getCurrentProfile, signOut } from './lib/api';
import { LoginView } from './components/auth/LoginView';
import { SetPasswordView } from './components/auth/SetPasswordView';
import { InstallerPortal } from './components/installer/InstallerPortal';
import { OfficePortal } from './components/office/OfficePortal';

/**
 * An invite or password-reset email link redirects back here with
 * `type=invite` / `type=recovery` — either in the query string (PKCE flow)
 * or the URL hash (implicit flow). Reading it once at load time lets us
 * force the SetPasswordView before granting access to anything else, so a
 * crew member can't end up signed in with no password ever set.
 */
function detectAuthFlowType(): 'invite' | 'recovery' | null {
  if (typeof window === 'undefined') return null;
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const searchParams = new URLSearchParams(window.location.search);
  const type = hashParams.get('type') || searchParams.get('type');
  return type === 'invite' || type === 'recovery' ? type : null;
}

export default function App() {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authFlowType, setAuthFlowType] = useState<'invite' | 'recovery' | null>(detectAuthFlowType);

  useEffect(() => {
    getCurrentProfile()
      .then(setCurrentUser)
      .finally(() => setIsLoading(false));

    const { data: subscription } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!session) {
        setCurrentUser(null);
        return;
      }
      const profile = await getCurrentProfile();
      setCurrentUser(profile);
    });

    return () => subscription.subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    await signOut();
    setCurrentUser(null);
  };

  const handlePasswordSet = () => {
    setAuthFlowType(null);
    window.history.replaceState({}, '', window.location.pathname);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#FBFBF9] flex items-center justify-center">
        <span className="text-sm text-[#6B7A88]">Loading…</span>
      </div>
    );
  }

  if (!currentUser) {
    return <LoginView onLogin={setCurrentUser} />;
  }

  // Block access to the app until an invited/recovering user sets a real
  // password — otherwise they'd have no way to log back in after signing out.
  if (authFlowType) {
    return <SetPasswordView mode={authFlowType} onDone={handlePasswordSet} />;
  }

  return (
    <div className="min-h-screen bg-[#FBFBF9] flex flex-col font-sans">
      {currentUser.role === 'installer' ? (
        <InstallerPortal currentUser={currentUser} onLogout={handleLogout} />
      ) : (
        <OfficePortal currentUser={currentUser} onLogout={handleLogout} />
      )}
    </div>
  );
}
