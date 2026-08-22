import type { Session, User } from "@supabase/supabase-js";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { getRoleForUser } from "@/lib/neuroclass-data";
import { supabase } from "@/lib/supabase";
import type { AppRole, UserProfile } from "@/lib/neuroclass-types";

type SignUpInput = {
  email: string;
  password: string;
  name: string;
  phone: string;
  role: AppRole;
};

type AuthContextValue = {
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  role: AppRole | null;
  loading: boolean;
  error: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (input: SignUpInput) => Promise<void>;
  requestPasswordReset: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const NeuroClassAuthContext = createContext<AuthContextValue | undefined>(undefined);

function friendlyError(error: unknown): Error {
  const message = error instanceof Error ? error.message : "Unable to complete your request.";
  if (message.toLowerCase().includes("invalid login")) return new Error("That email address or password is incorrect.");
  if (message.toLowerCase().includes("email not confirmed")) return new Error("Confirm your email address, then sign in to NeuroClass.");
  return new Error(message);
}

export function NeuroClassAuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadProfile = useCallback(async (currentUser: User | null) => {
    if (!currentUser) {
      setProfile(null);
      setRole(null);
      return;
    }
    const { data, error: profileError } = await supabase
      .from("users")
      .select("uid,email,displayname,mobile_number,role")
      .eq("uid", currentUser.id)
      .maybeSingle();
    if (profileError) throw profileError;
    const resolvedRole = await getRoleForUser(currentUser);
    setProfile({
      uid: currentUser.id,
      email: currentUser.email ?? data?.email ?? "",
      displayName: data?.displayname ?? currentUser.user_metadata?.full_name ?? null,
      mobileNumber: data?.mobile_number ?? null,
      role: resolvedRole,
    });
    setRole(resolvedRole);
  }, []);

  const syncSession = useCallback(async (nextSession: Session | null) => {
    setSession(nextSession);
    try {
      await loadProfile(nextSession?.user ?? null);
      setError(null);
    } catch (nextError) {
      setError(friendlyError(nextError).message);
      setProfile(null);
      setRole(null);
    } finally {
      setLoading(false);
    }
  }, [loadProfile]);

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => syncSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      void syncSession(nextSession);
    });
    return () => listener.subscription.unsubscribe();
  }, [syncSession]);

  const signIn = useCallback(async (email: string, password: string) => {
    setError(null);
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    if (signInError) throw friendlyError(signInError);
  }, []);

  const signUp = useCallback(async (input: SignUpInput) => {
    setError(null);
    const normalizedEmail = input.email.trim().toLowerCase();
    const { data, error: signUpError } = await supabase.auth.signUp({
      email: normalizedEmail,
      password: input.password,
      options: { data: { full_name: input.name.trim(), role: input.role } },
    });
    if (signUpError) throw friendlyError(signUpError);
    if (!data.user) throw new Error("NeuroClass could not create your account.");

    const { error: profileError } = await supabase.from("users").upsert(
      {
        uid: data.user.id,
        email: normalizedEmail,
        displayname: input.name.trim(),
        mobile_number: input.phone.trim() || null,
        role: input.role,
      },
      { onConflict: "uid" },
    );
    if (profileError) throw friendlyError(profileError);
    if (data.session) await syncSession(data.session);
  }, [syncSession]);

  const signOut = useCallback(async () => {
    const { error: signOutError } = await supabase.auth.signOut();
    if (signOutError) throw friendlyError(signOutError);
    await syncSession(null);
  }, [syncSession]);

  const requestPasswordReset = useCallback(async (email: string) => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) throw new Error("Enter your NeuroClass email address first.");
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(normalizedEmail);
    if (resetError) throw friendlyError(resetError);
  }, []);

  const refreshProfile = useCallback(async () => {
    await loadProfile(session?.user ?? null);
  }, [loadProfile, session?.user]);

  const value = useMemo<AuthContextValue>(() => ({
    user: session?.user ?? null,
    session,
    profile,
    role,
    loading,
    error,
    signIn,
    signUp,
    requestPasswordReset,
    signOut,
    refreshProfile,
  }), [error, loading, profile, refreshProfile, requestPasswordReset, role, session, signIn, signOut, signUp]);

  return <NeuroClassAuthContext.Provider value={value}>{children}</NeuroClassAuthContext.Provider>;
}

export function useNeuroClassAuth() {
  const context = useContext(NeuroClassAuthContext);
  if (!context) throw new Error("useNeuroClassAuth must be used within NeuroClassAuthProvider.");
  return context;
}
