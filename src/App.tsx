import React, { useState, useEffect } from 'react';
import { UserProfile } from './types';
import { supabase } from './lib/supabase';
import { getCurrentProfile, getProfileById, signOut } from './lib/api';
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
    let cancelled = false;

    getCurrentProfile()
      .then((profile) => {
        if (!cancelled) setCurrentUser(profile);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    // IMPORTANT: do not `await` Supabase calls directly inside this callback.
    // supabase-js holds an auth lock while the listener runs; calling
    // getSession() / from() here deadlocks and can return a null profile,
    // which cleared currentUser and bounced users back to the login screen
    // right after a successful sign-in.
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      setTimeout(() => {
        void (async () => {
          if (cancelled) return;

          if (!session?.user) {
            setCurrentUser(null);
            return;
          }

          const profile = await getProfileById(session.user.id);
          if (cancelled) return;

          if (!profile) {
            // Keep whatever onLogin already set — don't wipe a good session
            // just because this fetch raced or failed once.
            return;
          }

          if (!profile.isActive) {
            await signOut();
            if (!cancelled) setCurrentUser(null);
            return;
          }

          setCurrentUser(profile);
        })();
      }, 0);
    });

    return () => {
      cancelled = true;
      subscription.subscription.unsubscribe();
    };
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
