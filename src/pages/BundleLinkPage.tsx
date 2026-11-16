// The page a PEO opens from the link in an advisor's send, /b/:token (M-2.1, slice 6.6b; ADR 0003; D-609). No sign-in: the edge function
// bundle-link checks the token (it hashes it; the database never sees it as it is) and answers what the page shows, or that the link no
// longer works. Each file is downloaded on its own, through the function, and each download is on the quote request's timeline.
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useParams } from "react-router-dom";
import { Download, Loader2 } from "lucide-react";
import LegalLinks from "@/components/LegalLinks";
import { downloadBlob } from "@/lib/downloadFile";

export interface OpenBundleLink {
  state: "open";
  company_name: string;
  file_id: string;
  version: number;
  peo: string;
  expires_at: string;
  files: { n: number; name: string; what: string }[];
  open_items: string[];
}

export interface BundleLinkApi {
  /** The page's contents for a live link, or null when the link no longer works. */
  open: (token: string) => Promise<OpenBundleLink | null>;
  /** File n's bytes, or null when the link no longer works. */
  download: (token: string, n: number) => Promise<Blob | null>;
}

const functionUrl = () => `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/bundle-link`;
const post = (body: unknown) =>
  fetch(functionUrl(), {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "" },
    body: JSON.stringify(body),
    referrerPolicy: "no-referrer",
  });

/** The edge function, as the page asks it. A 410 is "no longer works"; anything else that is not a 200 is a failure to try again. */
export const bundleLinkApi: BundleLinkApi = {
  open: async (token) => {
    const res = await post({ token });
    if (res.status === 410) return null;
    if (!res.ok) throw new Error(`bundle-link answered ${res.status}`);
    return (await res.json()) as OpenBundleLink;
  },
  download: async (token, n) => {
    const res = await post({ token, file: n });
    if (res.status === 410) return null;
    if (!res.ok) throw new Error(`bundle-link answered ${res.status}`);
    return await res.blob();
  },
};

const dayOf = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

const Gone = () => (
  <main className="min-h-screen bg-background flex items-center justify-center p-6">
    <div className="max-w-md text-center space-y-2">
      <h1 className="text-2xl font-semibold">This link no longer works</h1>
      <p className="text-sm text-muted-foreground">Ask the person who sent it for a new one.</p>
      <LegalLinks className="pt-4" />
    </div>
  </main>
);

const BundleLinkPage = ({ api = bundleLinkApi }: { api?: BundleLinkApi }) => {
  const { token = "" } = useParams();
  const [link, setLink] = useState<OpenBundleLink | null | undefined>(undefined);
  const [busy, setBusy] = useState<number | null>(null);
  const [failed, setFailed] = useState(false);

  const save = async (f: OpenBundleLink["files"][number]) => {
    setBusy(f.n);
    try {
      const blob = await api.download(token, f.n);
      if (blob) downloadBlob(blob, f.name);
      else setLink(null);
    } catch {
      toast.error("We couldn't download that file. Please try again.");
    } finally {
      setBusy(null);
    }
  };

  useEffect(() => {
    let live = true;
    api.open(token).then(
      (l) => live && setLink(l),
      () => live && setFailed(true),
    );
    return () => {
      live = false;
    };
  }, [api, token]);

  if (failed) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="max-w-md text-center space-y-2">
          <h1 className="text-2xl font-semibold">We couldn't load this page</h1>
          <p className="text-sm text-muted-foreground">Please try again in a moment.</p>
          <LegalLinks className="pt-4" />
        </div>
      </main>
    );
  }
  if (link === undefined) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center p-6">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" aria-label="Loading" />
      </main>
    );
  }
  // Expired, revoked, unknown or malformed: one page, which names nobody.
  if (link === null) return <Gone />;

  return (
    <main className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-2xl space-y-6">
        <header className="space-y-1">
          <h1 className="text-2xl font-semibold">{link.company_name}</h1>
          <p className="text-sm text-muted-foreground">{`File ID ${link.file_id}, version ${link.version}, for ${link.peo}`}</p>
          <p className="text-sm text-muted-foreground">{`This link stops working on ${dayOf(link.expires_at)}.`}</p>
        </header>
        <ul className="divide-y divide-border rounded-md border border-border">
          {link.files.map((f) => (
            <li key={f.n} className="flex flex-wrap items-center justify-between gap-3 p-3">
              <div className="min-w-0">
                <p className="text-sm font-medium break-all">{f.name}</p>
                <p className="text-xs text-muted-foreground">{f.what}</p>
              </div>
              <button
                type="button"
                onClick={() => void save(f)}
                disabled={busy !== null}
                className="min-h-11 px-3 inline-flex items-center gap-2 rounded-md border border-border text-sm disabled:opacity-60"
                aria-label={`Download ${f.name}`}
              >
                {busy === f.n ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <Download className="w-4 h-4" aria-hidden="true" />}
                Download
              </button>
            </li>
          ))}
        </ul>
        {link.open_items.length > 0 && (
          <section className="space-y-2">
            <h2 className="text-base font-semibold">Open items</h2>
            <ul aria-label="Open items" className="list-disc pl-5 text-sm">
              {link.open_items.map((item) => <li key={item}>{item}</li>)}
            </ul>
          </section>
        )}
        <LegalLinks />
      </div>
    </main>
  );
};

export default BundleLinkPage;
