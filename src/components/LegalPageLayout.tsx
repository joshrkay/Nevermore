import { useEffect, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { BrandMark, Wordmark } from "@/components/BrandMark";
import LegalLinks from "@/components/LegalLinks";
import { LEGAL_COPY_APPROVED, LEGAL_LAST_UPDATED } from "@/data/legal";

/** The frame the Privacy Policy and Terms of Use share: title, version, the draft notice and the legal links. */
const LegalPageLayout = ({ title, version, children }: { title: string; version: string; children: ReactNode }) => {
  useEffect(() => {
    document.title = `${title} | Nevermore`;
  }, [title]);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="container mx-auto max-w-3xl px-6 h-14 flex items-center justify-between gap-4">
          <Link to="/" className="flex items-center gap-2">
            <BrandMark className="w-7 h-7 text-primary" />
            <Wordmark className="text-xl" />
          </Link>
          <Link to="/start" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            Start your intake
          </Link>
        </div>
      </header>
      <main className="container mx-auto max-w-3xl px-6 py-12">
        <h1 className="font-display text-4xl font-bold mb-2">{title}</h1>
        <p className="text-sm text-muted-foreground mb-6">
          Version {version} · Last updated {LEGAL_LAST_UPDATED}
        </p>
        {!LEGAL_COPY_APPROVED && (
          <p role="note" className="text-sm border border-warning/40 bg-warning/10 rounded-lg px-4 py-3 mb-10">
            <span className="font-medium">Draft, pending legal review.</span> This page describes how the product
            works today. Counsel has not yet approved its wording, and it will be updated before launch.
          </p>
        )}
        <div className="space-y-10 text-sm leading-relaxed [&_h2]:font-display [&_h2]:text-2xl [&_h2]:font-bold [&_h2]:mb-3 [&_h2]:text-foreground [&_p]:text-muted-foreground [&_li]:text-muted-foreground">
          {children}
        </div>
      </main>
      <footer className="border-t border-border py-8">
        <LegalLinks copyright className="container mx-auto max-w-3xl px-6 text-center" />
      </footer>
    </div>
  );
};

export default LegalPageLayout;
