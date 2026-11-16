// The page a contact opens from a file link in an agent's message, /f#<token> (story CRM-E1.2b, slice 6.3; D-605). A file goes with a message as a link,
// never as an attachment. The token is after #, so no request to the site carries it (D-645's way out); the page posts it to the edge function
// message-file, which hashes it and answers the file's bytes, or that the link no longer works. Each download is logged by the database.
import { useState } from "react";
import { useLocation } from "react-router-dom";
import { Download, Loader2 } from "lucide-react";
import LegalLinks from "@/components/LegalLinks";
import { downloadBlob } from "@/lib/downloadFile";

export interface FileLinkApi {
  /** The file's bytes and its name, or null when the link no longer works. */
  download: (token: string) => Promise<{ blob: Blob; name: string } | null>;
}

/** The name the function gives the file (Content-Disposition's filename*), else a plain one. */
const nameFrom = (disposition: string | null) => {
  const m = disposition?.match(/filename\*=UTF-8''([^;]+)/);
  try {
    return m ? decodeURIComponent(m[1]) : "file";
  } catch {
    return "file";
  }
};

/** The edge function, as the page asks it. A 410 is "no longer works"; anything else that is not a 200 is a failure to try again. */
export const fileLinkApi: FileLinkApi = {
  download: async (token) => {
    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/message-file`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "" },
      body: JSON.stringify({ token }),
      referrerPolicy: "no-referrer",
    });
    if (res.status === 410) return null;
    if (!res.ok) throw new Error(`message-file answered ${res.status}`);
    return { blob: await res.blob(), name: nameFrom(res.headers.get("Content-Disposition")) };
  },
};

const Frame = ({ children }: { children: React.ReactNode }) => (
  <main className="min-h-screen bg-background flex items-center justify-center p-6">
    <div className="max-w-md text-center space-y-3">
      {children}
      <LegalLinks className="pt-4" />
    </div>
  </main>
);

const FileLinkPage = ({ api = fileLinkApi }: { api?: FileLinkApi }) => {
  const { hash } = useLocation();
  const token = hash.replace(/^#/, "");
  const [state, setState] = useState<"ready" | "busy" | "gone" | "failed">("ready");

  const save = async () => {
    setState("busy");
    try {
      const file = await api.download(token);
      if (!file) return setState("gone");
      downloadBlob(file.blob, file.name);
      setState("ready");
    } catch {
      setState("failed");
    }
  };

  // Expired, revoked, unknown or malformed: one page, which names nobody.
  if (state === "gone") {
    return (
      <Frame>
        <h1 className="text-2xl font-semibold">This link no longer works</h1>
        <p className="text-sm text-muted-foreground">Ask the person who sent it for a new one.</p>
      </Frame>
    );
  }
  return (
    <Frame>
      <h1 className="text-2xl font-semibold">A file sent to you</h1>
      <p className="text-sm text-muted-foreground">It was sent with an email from your broker. The link stops working 30 days after it was sent.</p>
      {state === "failed" && <p role="alert" className="text-sm">We couldn't download the file. Please try again in a moment.</p>}
      <button
        type="button"
        onClick={() => void save()}
        disabled={state === "busy"}
        className="min-h-11 px-4 inline-flex items-center gap-2 rounded-md border border-border text-sm disabled:opacity-60"
      >
        {state === "busy" ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <Download className="w-4 h-4" aria-hidden="true" />}
        Download the file
      </button>
    </Frame>
  );
};

export default FileLinkPage;
