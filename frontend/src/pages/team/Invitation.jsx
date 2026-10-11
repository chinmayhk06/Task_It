import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import api from "../../services/api";
import { authLink } from "../../utils/authReturn";

export default function Invitation() {
  const { token } = useParams();
  const navigate = useNavigate();
  const authenticated = Boolean(localStorage.getItem("token"));
  const returnTo = `/invitations/${token}`;
  const [invitation, setInvitation] = useState(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState("");
  const load = useCallback(async () => {
    if (!authenticated) return;
    try { setInvitation((await api.post("/team/invitations/preview", { token })).data.data); }
    catch (error) { setMessage(error.response?.data?.message || "Unable to load invitation"); }
  }, [authenticated, token]);
  useEffect(() => { load(); }, [load]);
  const run = async (action) => {
    setBusy(true); setMessage("");
    try { await action(); }
    catch (error) { setMessage(error.response?.data?.message || "Unable to complete this action"); }
    finally { setBusy(false); }
  };
  const buttonClass = "rounded-md border border-[var(--border-color)] px-4 py-2 disabled:opacity-50";
  return <div className="app-page min-h-screen flex items-center justify-center">
    <section className="w-full max-w-lg space-y-5 rounded-md border border-[var(--border-color)] bg-[var(--surface-card)] p-8">
      <h1 className="text-2xl font-semibold">Team invitation</h1>
      {!authenticated ? <>
        <p>Sign in or create an account with the email address that received this invitation.</p>
        <div className="flex gap-4"><Link className={buttonClass} to={authLink("/login", returnTo)}>Sign in</Link>
          <Link className={buttonClass} to={authLink("/register", returnTo)}>Create account</Link></div>
      </> : invitation && <>
        <p>Join <strong>{invitation.teamName}</strong> as {invitation.role}.</p>
        <p>Invited email: {invitation.email}</p>
        <p>Status: {invitation.status}. Expires {new Date(invitation.expiresAt).toLocaleString()}.</p>
        {!invitation.emailMatches ? <>
          <p>Sign in with {invitation.email} to accept this invitation.</p>
          <Link className={buttonClass} to={authLink("/login", returnTo)}>Switch account</Link>
        </> : invitation.status === "pending" && <>
          {!invitation.emailVerified ? <>
            <p>Verify your email before joining. Request a code and paste it below.</p>
            <button className={buttonClass} disabled={busy} onClick={() => run(async () => {
              await api.post("/auth/email-verification/send"); setMessage("Verification code sent. Check your inbox.");
            })}>Send verification code</button>
            <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); run(async () => {
              await api.post("/auth/email-verification/confirm", { token: code.trim() }); setCode(""); await load();
            }); }}>
              <label className="block">Verification code<input className="mt-2 w-full rounded-md border border-[var(--border-color)] bg-transparent p-2" value={code} onChange={(e) => setCode(e.target.value)} required /></label>
              <button className={buttonClass} disabled={busy}>Verify email</button>
            </form>
          </> : <button className={buttonClass} disabled={busy} onClick={() => run(async () => {
            const response = await api.post("/team/invitations/accept", { token });
            navigate(`/teams/${response.data.data.teamId}`);
          })}>Accept invitation</button>}
        </>}
        {invitation.status === "accepted" && invitation.emailMatches && <Link className={buttonClass} to={`/teams/${invitation.teamId}`}>Open team</Link>}
        {["expired", "revoked"].includes(invitation.status) && <p>Ask an Admin or Team Lead for a new invitation.</p>}
      </>}
      {message && <p role="status">{message}</p>}
      <Link className="block text-sm underline" to="/teams">Back to teams</Link>
    </section>
  </div>;
}
