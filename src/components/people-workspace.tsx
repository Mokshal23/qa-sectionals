"use client";

import { useEffect, useState } from "react";
import { Check, CircleAlert, Copy, KeyRound, LockKeyhole, ShieldCheck, UserRoundPlus } from "lucide-react";

type Invite = { email: string; role: string; active: boolean; created_at: string; claimed_at: string | null; invite_expires_at: string | null };

export function PeopleWorkspace() {
  const [email, setEmail] = useState("");
  const [invites, setInvites] = useState<Invite[]>([]);
  const [inviteCode, setInviteCode] = useState("");
  const [inviteRecipient, setInviteRecipient] = useState("");
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function load() {
    const response = await fetch("/api/admin/invites");
    const result = await response.json();
    if (response.ok) setInvites(result.invites ?? []);
    else setError(result.error ?? "Could not load member list.");
  }
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const response = await fetch("/api/admin/invites");
        const result = await response.json();
        if (alive) {
          if (response.ok) setInvites(result.invites ?? []);
          else setError(result.error ?? "Could not load member list.");
        }
      } catch { if (alive) setError("Could not load member list."); }
    })();
    return () => { alive = false; };
  }, []);

  async function invite(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError(""); setMessage(""); setInviteCode(""); setCopied(false);
    const cleanEmail = email.trim().toLowerCase();
    try {
      const response = await fetch("/api/admin/invites", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: cleanEmail }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not create invite code.");
      setInviteRecipient(cleanEmail);
      setInviteCode(result.inviteCode);
      setMessage(`One-time invite code created for ${cleanEmail}. Share it directly; Quantroom will not send an email.`);
      setEmail(""); await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not create invite code."); }
    finally { setBusy(false); }
  }

  async function copyCode() {
    try { await navigator.clipboard.writeText(inviteCode); setCopied(true); }
    catch { setError("Clipboard access was blocked. Select and copy the code manually."); }
  }

  async function revoke(address: string) {
    if (!window.confirm(`Remove ${address} from the workspace? Their saved reports will remain private but they will lose access.`)) return;
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/admin/invites/${encodeURIComponent(address)}`, { method: "DELETE" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not revoke access.");
      setMessage(`Workspace access removed for ${address}.`); await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not revoke access."); }
    finally { setBusy(false); }
  }

  const activeCount = invites.filter((item) => item.role !== "owner" && item.active).length;
  return <div className="page-content">
    <div className="welcome-row"><div><div className="eyebrow"><UserRoundPlus size={13}/> PRIVATE GROUP · INVITE ONLY</div><h1>Bring your people in<span className="heading-period">.</span></h1><p className="page-subtitle">Create a one-time code and share it directly. Quantroom never sends confirmation or invitation emails.</p></div><div className="invite-count"><strong>{activeCount}</strong><span>active</span></div></div>
    <div className="people-layout">
      <section className="panel invite-panel"><span className="panel-kicker">ADD A MEMBER</span><h2>Create an invite code</h2><p>Codes expire after seven days and can be used once. Share the code with your friend outside Quantroom.</p>
        <form className="invite-form" onSubmit={invite}><label htmlFor="invite-email">Friend’s email address</label><div className="invite-input-row"><input id="invite-email" type="email" autoComplete="off" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="friend@example.com" required/><button className="button button-dark" disabled={busy}>{busy ? "Creating…" : <><KeyRound size={15}/>Create code</>}</button></div></form>
        {message && <div className="success-message"><Check size={15}/>{message}</div>}
        {inviteCode && <div className="invite-code-card"><span className="panel-kicker">ONE-TIME CODE · {inviteRecipient}</span><code>{inviteCode}</code><button type="button" className="button button-secondary" onClick={() => void copyCode()}><Copy size={15}/>{copied ? "Copied" : "Copy code"}</button></div>}
        {error && <div className="error-message"><CircleAlert size={15}/>{error}</div>}
        <div className="safe-note"><LockKeyhole size={14}/><span>The code is shown once and stored only as a hash. Organizer tools do not expose friends’ attempt rows.</span></div>
      </section>
      <section className="panel members-panel"><div className="panel-heading"><div><span className="panel-kicker">ACCESS LIST</span><h2>Group members</h2></div><ShieldCheck size={17} className="profile-shield"/></div>
        {invites.length ? <div className="invite-list">{invites.filter((item) => item.role !== "owner").map((item) => <div className={`invite-row ${!item.active ? "revoked-invite" : ""}`} key={item.email}><span className="member-avatar">{item.email[0].toUpperCase()}</span><div><strong>{item.email}</strong><span>{!item.active ? "Access revoked; saved data retained." : item.claimed_at ? "Account activated" : item.invite_expires_at ? `Code expires ${new Date(item.invite_expires_at).toLocaleDateString()}` : "Invite code issued"}</span></div>{item.active ? <><span className="member-role">PARTICIPANT</span><button className="text-button revoke-button" onClick={() => void revoke(item.email)} disabled={busy}>Remove</button></> : <span className="member-role revoked-role">REVOKED</span>}</div>)}</div> : <div className="empty-state compact"><div className="empty-icon"><UserRoundPlus size={19}/></div><strong>No participants invited</strong><span>Generate a one-time code for your first friend.</span></div>}
      </section>
    </div>
    <div className="sectional-footnote"><ShieldCheck size={15}/>Members do not see one another’s accounts, attempts, scores, or reports.</div>
  </div>;
}
