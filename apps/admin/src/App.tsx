import { useCallback, useEffect, useState, type FormEvent } from "react";
import { api } from "./api";
import Login from "./Login";
import { useSession } from "./useSession";

type Letter = { id: number; title: string; body: string; recipientId: number; published: boolean; status: string; version: number };
type Recipient = { id: number; name: string; email: string };

export default function App() {
  const { user, setUser, loading, logout } = useSession();
  if (loading) return <main><p>Loading...</p></main>;
  if (!user) return <Login role="admin" onLogin={setUser} />;
  return (
    <>
      <header>
        <h1>Letters Admin</h1>
        <span>{user.name} <button className="secondary" onClick={logout}>Sign out</button></span>
      </header>
      <Letters />
    </>
  );
}

function Letters() {
  const [letters, setLetters] = useState<Letter[]>([]);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [editing, setEditing] = useState<Letter | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(() => api<Letter[]>("/letters").then(setLetters).catch((e) => setError(e.message)), []);
  useEffect(() => { load(); api<Recipient[]>("/users").then(setRecipients); }, [load]);
  useEffect(() => { const t = setInterval(load, 1000); return () => clearInterval(t); }, [load]);

  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const body = { title: f.get("title"), body: f.get("body"), recipientId: Number(f.get("recipient")) };
    // test hook: ?forceFail=1 on the admin URL makes renders fail (API needs TEST_MODE=1)
    const q = new URLSearchParams(location.search).get("forceFail") === "1" ? "?forceFail=1" : "";
    try {
      if (editing) {
        await api(`/letters/${editing.id}${q}`, { method: "PUT", body });
        setEditing(null);
      } else {
        await api("/letters", { method: "POST", body });
      }
      e.currentTarget.reset();
      await load();
    } catch (err) { setError((err as Error).message); }
  }
  async function publish(l: Letter) {
    const q = new URLSearchParams(location.search).get("forceFail") === "1" ? "?forceFail=1" : "";
    try { await api(`/letters/${l.id}/publish${q}`, { method: "POST" }); await load(); } catch (err) { setError((err as Error).message); }
  }

  return (
    <main>
      <h2>{editing ? `Edit letter #${editing.id}` : "New letter"}</h2>
      <form key={editing?.id ?? "new"} onSubmit={save} aria-label={editing ? "Edit letter" : "New letter"}>
        <label>Title <input name="title" required defaultValue={editing?.title} /></label>
        <label>Body <textarea name="body" rows={4} required defaultValue={editing?.body} /></label>
        <label>Recipient
          <select name="recipient" required defaultValue={editing?.recipientId ?? ""}>
            <option value="" disabled>Select a recipient</option>
            {recipients.map((r) => <option key={r.id} value={r.id}>{r.name} ({r.email})</option>)}
          </select>
        </label>
        {error && <p className="error" role="alert">{error}</p>}
        <div>
          <button type="submit">{editing ? "Save changes" : "Create letter"}</button>{" "}
          {editing && <button type="button" className="secondary" onClick={() => setEditing(null)}>Cancel</button>}
        </div>
      </form>

      <h2>Letters</h2>
      <table>
        <thead><tr><th>Title</th><th>Recipient</th><th>Status</th><th>Actions</th></tr></thead>
        <tbody>
          {letters.map((l) => (
            <tr key={l.id}>
              <td>{l.title}</td>
              <td>{recipients.find((r) => r.id === l.recipientId)?.name ?? l.recipientId}</td>
              <td><span className={`status status-${l.status}`}>{l.status}</span></td>
              <td>
                <button className="secondary" onClick={() => setEditing(l)}>Edit</button>{" "}
                {(!l.published || l.status === "failed") && <button onClick={() => publish(l)}>{l.status === "failed" ? "Retry" : "Publish"}</button>}
              </td>
            </tr>
          ))}
          {letters.length === 0 && <tr><td colSpan={4}>No letters yet.</td></tr>}
        </tbody>
      </table>
    </main>
  );
}
