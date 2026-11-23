import { useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { failureWords } from "@/components/workspace/form";
import { LINE_LABELS, lineOf, QUOTE_LINES, type QuoteLine } from "@/data/lines";
import { PEO_NAME_MAX } from "@/data/peoCatalog";
import { addPeo } from "@/lib/advisorApi";
import { inputClass, primaryClass } from "./shared";
import { Field } from "./SourceFields";

/**
 * Adds a PEO, listed, with no profile yet. Admins only; the database refuses a name already listed, in words to show. The admin says what it quotes
 * (ADR 0029): a PEO unless they choose workers' comp, which adds a carrier. That choice is made once: a market's line never changes.
 */
const AddPeoForm = ({ onAdded }: { onAdded: (id: number) => void }) => {
  const [name, setName] = useState("");
  const [line, setLine] = useState<QuoteLine>("peo");
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (name.trim() === "") {
      setProblem("Give the PEO's name");
      return;
    }
    setSaving(true);
    setProblem(null);
    try {
      const added = await addPeo(name.trim(), line);
      toast.success(`Added ${name.trim()}. Edit its profile to say what it asks for.`);
      setName("");
      onAdded(added.id);
    } catch (err) {
      setProblem(failureWords(err, "The PEO wasn't added. Check your connection and try again."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} aria-labelledby="add-peo-heading" className="border border-border rounded-xl p-4 space-y-3">
      <h2 id="add-peo-heading" className="font-display text-base font-bold">Add a PEO</h2>
      <Field id="add-peo-name" label="Its name" problem={problem ?? undefined}>
        {(p) => <input {...p} value={name} maxLength={PEO_NAME_MAX} onChange={(e) => setName(e.target.value)} className={inputClass} />}
      </Field>
      <Field id="add-peo-line" label="What it quotes">
        {(p) => (
          <select {...p} value={line} onChange={(e) => setLine(lineOf(e.target.value))} className={inputClass}>
            {QUOTE_LINES.map((l) => <option key={l} value={l}>{l === "peo" ? LINE_LABELS[l] : `${LINE_LABELS[l]} (a carrier)`}</option>)}
          </select>
        )}
      </Field>
      <button type="submit" disabled={saving} className={`${primaryClass} w-full`}>
        {saving && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />} Add a PEO
      </button>
      <p className="text-xs text-muted-foreground">It is listed at once, with no profile: every check against it reads can't tell yet.</p>
    </form>
  );
};

export default AddPeoForm;
