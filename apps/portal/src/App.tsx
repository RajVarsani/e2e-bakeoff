import { useCallback, useEffect, useState } from "react";
import { api } from "./api";
import Login from "./Login";
import { useSession } from "./useSession";

type Item = { id: number; title: string; status: string; content: string | null };
type Crm = { connected: boolean; clients: { id: string; name: string; email: string }[] };

const CRM_URL = import.meta.env.VITE_CRM_URL as string;
const REDIRECT_URI = `${location.origin}/crm/callback`;

export default function App() {
  const { user, setUser, loading, logout } = useSession();
  if (loading) return <main><p>Loading...</p></main>;
  if (!user) return <Login role="portal" onLogin={setUser} />;
  const path = location.pathname;
  const letterId = path.match(/^\/letters\/(\d+)$/)?.[1];
  return (
    <>
      <header>
        <h1><a href="/" style={{ color: "inherit", textDecoration: "none" }}>Portal</a></h1>
        <span>{user.name} <button className="secondary" onClick={logout}>Sign out</button></span>
      </header>
      {path === "/crm/callback" ? <CrmCallback /> : letterId ? <LetterView id={Number(letterId)} /> : <><Inbox /><CrmPanel /></>}
    </>
  );
}

function usePoll<T>(fn: () => Promise<T>, ms: number) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<{ status?: number; message: string } | null>(null);
  const run = useCallback(() => fn().then(setData).catch((e) => setError(e)), [fn]);
  useEffect(() => { run(); const t = setInterval(run, ms); return () => clearInterval(t); }, [run, ms]);
  return { data, error };
}

function Inbox() {
  const fetchInbox = useCallback(() => api<Item[]>("/inbox"), []);
  const { data } = usePoll(fetchInbox, 1000);
  return (
    <main>
      <h2>Inbox</h2>
      <table>
        <thead><tr><th>Letter</th><th>Status</th></tr></thead>
        <tbody>
          {data?.map((l) => (
            <tr key={l.id}>
              <td>{l.status === "ready" ? <a href={`/letters/${l.id}`}>{l.title}</a> : l.title}</td>
              <td><span className={`status status-${l.status}`}>{l.status}</span></td>
            </tr>
          ))}
          {data?.length === 0 && <tr><td colSpan={2}>No letters yet.</td></tr>}
        </tbody>
      </table>
    </main>
  );
}

function LetterView({ id }: { id: number }) {
  const fetchOne = useCallback(() => api<Item>(`/inbox/${id}`), [id]);
  const { data, error } = usePoll(fetchOne, 1000);
  if (error?.status === 404) return <main><p>Letter not found.</p><a href="/">Back to inbox</a></main>;
  if (!data) return <main><p>Loading...</p></main>;
  return (
    <main>
      <a href="/">Back to inbox</a>
      <h2>{data.title}</h2>
      <p>Status: <span className={`status status-${data.status}`}>{data.status}</span></p>
      {data.status === "ready" ? <article aria-label="Letter content">{data.content}</article> : <p>This letter is being prepared...</p>}
    </main>
  );
}

function CrmPanel() {
  const fetchCrm = useCallback(() => api<Crm>("/crm/connection"), []);
  const { data } = usePoll(fetchCrm, 5000);
  const connect = () => {
    const q = new URLSearchParams({ client_id: "portal-app", response_type: "code", redirect_uri: REDIRECT_URI, state: crypto.randomUUID() });
    sessionStorage.setItem("crm_state", q.get("state")!);
    location.href = `${CRM_URL}/authorize?${q}`;
  };
  return (
    <main>
      <h2>CRM</h2>
      {data?.connected ? (
        <>
          <p className="ok" role="status">CRM connected</p>
          <h3>Clients</h3>
          <ul aria-label="CRM clients">{data.clients.map((c) => <li key={c.id}>{c.name} ({c.email})</li>)}</ul>
        </>
      ) : (
        <button onClick={connect}>Connect CRM</button>
      )}
    </main>
  );
}

function CrmCallback() {
  const [msg, setMsg] = useState("Connecting to CRM...");
  useEffect(() => {
    const p = new URLSearchParams(location.search);
    const code = p.get("code");
    if (p.get("error") || !code || p.get("state") !== sessionStorage.getItem("crm_state")) { setMsg("CRM connection failed"); return; }
    api("/crm/connect", { method: "POST", body: { code, redirectUri: REDIRECT_URI } })
      .then(() => location.replace("/"))
      .catch(() => setMsg("CRM connection failed"));
  }, []);
  return <main><p role="status">{msg}</p></main>;
}
