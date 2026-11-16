import { useState, type FormEvent } from "react";
import { requestContact } from "@/lib/contactRequestApi";

// "Ask the firm to contact me", on a firm's public link (story CRM-L1.2b, slice 8.7): for a visitor who starts no intake. The database makes the lead, with the
// source Firm's link, and decides every rule; this holds what the visitor typed and says what came of it.
const field = "w-full min-h-[44px] rounded-xl border border-input bg-background px-3 py-2";

const ContactMeForm = ({ address, firmName }: { address: string; firmName: string }) => {
  const [values, setValues] = useState({ name: "", email: "", phone: "", business: "", message: "" });
  const [done, setDone] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const set = (key: keyof typeof values) => (e: { target: { value: string } }) => setValues((v) => ({ ...v, [key]: e.target.value }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setProblem(null);
    setSending(true);
    try {
      if ((await requestContact({ address, ...values })) === "busy") setProblem("Lots of requests are coming in right now. Try again in a little while.");
      else setDone(true);
    } catch (err) {
      setProblem(err instanceof Error ? err.message : "Couldn't send your request. Try again.");
    } finally {
      setSending(false);
    }
  };

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
      {problem && <p role="alert" className="text-destructive font-semibold">{problem}</p>}
      <button type="submit" disabled={sending} className="inline-flex items-center justify-center min-h-[48px] px-6 rounded-full bg-primary text-primary-foreground font-bold hover:bg-primary/90 transition-colors">
        {sending ? "Sending…" : `Ask ${firmName} to contact me`}
      </button>
    </form>
  );
};

export default ContactMeForm;
