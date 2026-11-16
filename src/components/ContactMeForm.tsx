import { useState, type FormEvent } from "react";
import TurnstileWidget from "@/components/TurnstileWidget";
import { contactRequestAvailable, NOT_AVAILABLE, requestContact } from "@/lib/contactRequestApi";

// "Ask the firm to contact me", on a firm's public link (story CRM-L1.2b, slices 8.7 and 8.7b): for a visitor who starts no intake. A Cloudflare Turnstile check stands in
// front of it, and Turnstile's script is loaded only here, when the form is on the page. The database makes the lead, with the source Firm's link, and decides every rule;
// this holds what the visitor typed and says what came of it. Never open without the check: with no site key the form is not offered.
const field = "w-full min-h-[44px] rounded-xl border border-input bg-background px-3 py-2";

const ContactMeForm = ({ address, firmName }: { address: string; firmName: string }) => {
  const [values, setValues] = useState({ name: "", email: "", phone: "", business: "", message: "" });
  const [done, setDone] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  // A token is good for one request. After each try the widget is mounted anew (a new `round`), so the next press needs a fresh check.
  const [token, setToken] = useState<string | null>(null);
  const [round, setRound] = useState(0);
  const [checkFailed, setCheckFailed] = useState(false);
  const set = (key: keyof typeof values) => (e: { target: { value: string } }) => setValues((v) => ({ ...v, [key]: e.target.value }));
  const siteKey = (import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined)?.trim();

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!token || sending) return;
    setProblem(null);
    setSending(true);
    try {
      if ((await requestContact({ address, ...values, token })) === "busy") setProblem("Lots of requests are coming in right now. Try again in a little while.");
      else setDone(true);
    } catch (err) {
      setProblem(err instanceof Error ? err.message : "Couldn't send your request. Try again.");
    } finally {
      setToken(null);
      setRound((r) => r + 1);
      setSending(false);
    }
  };

  if (!contactRequestAvailable() || !siteKey) return <p role="status">{NOT_AVAILABLE}</p>;
  if (done) return <p role="status">Thanks. {firmName} has your details and will be in touch.</p>;
  return (
    <form onSubmit={submit} className="space-y-4 text-left">
      <label className="block">
        <span className="font-semibold">Your name</span>
        <input className={field} value={values.name} onChange={set("name")} />
      </label>
      <label className="block">
        <span className="font-semibold">Email</span>
        <input className={field} type="email" value={values.email} onChange={set("email")} />
      </label>
      <label className="block">
        <span className="font-semibold">Phone</span>
        <input className={field} type="tel" value={values.phone} onChange={set("phone")} />
      </label>
      <label className="block">
        <span className="font-semibold">Business</span>
        <input className={field} value={values.business} onChange={set("business")} />
      </label>
      <label className="block">
        <span className="font-semibold">Message</span>
        <textarea className={field} rows={3} value={values.message} onChange={set("message")} />
      </label>
      <TurnstileWidget
        key={round}
        siteKey={siteKey}
        onToken={(t) => { setCheckFailed(false); setToken(t); }}
        onError={() => { setToken(null); setCheckFailed(true); }}
      />
      {checkFailed && <p role="alert" className="text-destructive font-semibold">The check couldn't load. Reload the page and try again.</p>}
      {problem && <p role="alert" className="text-destructive font-semibold">{problem}</p>}
      <button type="submit" disabled={sending || !token} className="inline-flex items-center justify-center min-h-[48px] px-6 rounded-full bg-primary text-primary-foreground font-bold hover:bg-primary/90 transition-colors disabled:opacity-60">
        {sending ? "Sending…" : `Ask ${firmName} to contact me`}
      </button>
    </form>
  );
};

export default ContactMeForm;
