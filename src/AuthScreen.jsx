import React, { useState, useRef, useEffect } from "react";
import { supabase } from "./supabaseClient.js";
import { AUTH_BOOT_TIMEOUT_MS, withAppTimeout } from "./systemRequest.js";
import { recoveryMessage } from "./systemErrors.js";
import { reportSystemError } from "./systemErrorReporter.js";
import AccessShell from "./AccessShell.jsx";

export function AuthScreen() {
  const [mode, setMode] = useState("SIGN IN");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const inFlight = useRef(false);
  const oauthRecoveryTimerRef = useRef(null);
  useEffect(() => () => window.clearTimeout(oauthRecoveryTimerRef.current), []);

  function friendlyAuthMessage(error) {
    const lower = String(error?.message || "").toLowerCase();
    if (lower.includes("provider") && lower.includes("enabled")) return "Google sign-in is unavailable right now. You can use your email and password.";
    if (lower.includes("email not confirmed")) return "Open your confirmation email, then return here to sign in.";
    if (lower.includes("invalid login credentials")) return "That email and password weren’t recognized. Check both and try again.";
    if (lower.includes("already registered")) return "An account already uses this email. Choose Sign in.";
    if (lower.includes("password")) return "That password could not be accepted. Use a longer, unique password and try again.";
    if (lower.includes("rate") || lower.includes("too many")) return "Too many attempts. Give it a moment before trying again.";
    return recoveryMessage(error, "AUTH");
  }
  async function signInWithGoogle() {
    if (inFlight.current) return;
    inFlight.current = true; setBusy(true); setMessage("");
    try {
      const { data, error } = await withAppTimeout(supabase.auth.signInWithOAuth({provider: "google", options: {redirectTo: window.location.origin}}), AUTH_BOOT_TIMEOUT_MS, "AUTH_REQUEST_TIMEOUT");
      if (error) throw error;
      if (!data?.url) throw new Error("GOOGLE_AUTH_URL_NOT_RETURNED");
      oauthRecoveryTimerRef.current = window.setTimeout(() => {
        inFlight.current = false; setBusy(false);
        setMessage("Google sign-in didn’t finish. Try again, or use your email and password.");
      }, AUTH_BOOT_TIMEOUT_MS);
    } catch (error) {
      void reportSystemError(error, "AUTH");
      setMessage(friendlyAuthMessage(error));
      inFlight.current = false; setBusy(false);
    }
  }
  async function submit(event) {
    event.preventDefault();
    if (inFlight.current) return;
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !password || (mode === "CREATE ACCOUNT" && password.length < 8)) {
      setMessage("Enter your email and password. New accounts need at least 8 characters."); return;
    }
    inFlight.current = true; setBusy(true); setMessage("");
    try {
      const request = mode === "CREATE ACCOUNT"
        ? supabase.auth.signUp({email:cleanEmail, password, options:{emailRedirectTo:window.location.origin}})
        : supabase.auth.signInWithPassword({email:cleanEmail, password});
      const { data, error } = await withAppTimeout(request, AUTH_BOOT_TIMEOUT_MS, "AUTH_REQUEST_TIMEOUT");
      if (error) throw error;
      if (mode === "CREATE ACCOUNT" && !data?.session) setMessage("Account created. Check your email to confirm it, then return here to sign in.");
    } catch (error) {
      void reportSystemError(error, "AUTH");
      setMessage(friendlyAuthMessage(error));
    } finally { inFlight.current = false; setBusy(false); }
  }
  function changeMode(next) { if (!busy) { setMode(next); setMessage(""); } }
  return (
    <AccessShell>
      <form className="login-panel auth-panel" onSubmit={submit} aria-busy={busy}>
        <div className="access-form-heading"><small>PLAYER ACCESS</small><h2>{mode === "SIGN IN" ? "Welcome back." : "Begin your progression."}</h2><p>{mode === "SIGN IN" ? "Your next action is waiting." : "Create an account, then build your personal starting plan."}</p></div>
        <div className="access-mode-tabs" role="tablist" aria-label="Account access">{["SIGN IN", "CREATE ACCOUNT"].map(value => <button key={value} type="button" role="tab" aria-selected={mode === value} disabled={busy} onClick={() => changeMode(value)}>{value === "SIGN IN" ? "Sign in" : "Create account"}</button>)}</div>
        <button type="button" className="google-auth-button" disabled={busy} onClick={signInWithGoogle}>
          <span className="google-auth-mark" aria-hidden="true"><svg viewBox="0 0 24 24"><path fill="#4285F4" d="M21.6 12.2c0-.7-.1-1.4-.2-2.1H12v4h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.8 3-4.3 3-7.4Z"/><path fill="#34A853" d="M12 22c2.7 0 5-.9 6.6-2.4l-3.2-2.5c-.9.6-2 1-3.4 1-2.6 0-4.8-1.8-5.6-4.1H3.1v2.6A10 10 0 0 0 12 22Z"/><path fill="#FBBC05" d="M6.4 14a6 6 0 0 1 0-4V7.4H3.1a10 10 0 0 0 0 9.2Z"/><path fill="#EA4335" d="M12 5.9c1.5 0 2.8.5 3.9 1.5l2.9-2.9A9.6 9.6 0 0 0 12 2a10 10 0 0 0-8.9 5.4L6.4 10c.8-2.3 3-4.1 5.6-4.1Z"/></svg></span><strong>Continue with Google</strong>
        </button>
        <div className="auth-divider"><span>or use email</span></div>
        <label htmlFor="access-email">EMAIL ADDRESS</label><input id="access-email" type="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" disabled={busy}/>
        <label htmlFor="access-password">PASSWORD</label><div className="access-password"><input id="access-password" type={showPassword ? "text" : "password"} required minLength={mode === "CREATE ACCOUNT" ? 8 : undefined} value={password} onChange={e=>setPassword(e.target.value)} placeholder={mode === "CREATE ACCOUNT" ? "At least 8 characters" : "Your password"} autoComplete={mode === "CREATE ACCOUNT" ? "new-password" : "current-password"} disabled={busy}/><button type="button" aria-label={showPassword ? "Hide password" : "Show password"} onClick={()=>setShowPassword(v=>!v)}>{showPassword ? "HIDE" : "SHOW"}</button></div>
        {message && <div className="auth-message" role="status" aria-live="polite">{message}</div>}
        <button type="submit" className="initialize" disabled={busy}>{busy ? "CONNECTING…" : mode === "SIGN IN" ? "ENTER THE SYSTEM" : "CREATE MY ACCOUNT"}</button>
        <p className="access-form-footnote">Your class is your choice. New players get suggestions based on their goals, experience and routine.</p>
      </form>
    </AccessShell>
  );
}
export function CloudBootScreen({message="Connecting to your saved progress…"}) {
  return <AccessShell><div className="login-panel auth-panel cloud-boot" role="status" aria-live="polite"><div className="access-form-heading"><small>PLAYER ACCESS</small><h2>Preparing your System.</h2><p>{message}</p></div><div className="system-loading"><i aria-hidden="true"/>Loading your workspace</div></div></AccessShell>;
}
