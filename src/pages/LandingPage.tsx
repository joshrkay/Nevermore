import { Fragment, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { Check, MessageCircle, PenLine, Send } from "lucide-react";
import { BrandMark, Wordmark } from "@/components/BrandMark";
import LegalLinks from "@/components/LegalLinks";
import { preloadIntake } from "@/lib/lazyPages";

const fadeUp = (delay: number) => ({
  initial: { opacity: 0, y: 24 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.6, delay, ease: "easeOut" as const },
});

const sectionFade = {
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true },
};

// What a PEO's underwriting team gets in every packet. Keep each point true of the PDF the prospect sends
// (src/lib/manuscriptPdf.ts), not just the on-screen page; copy.guard.test.ts keeps it PEO-neutral.
const PEO_PARTNER_POINTS = [
  {
    title: "The same layout, every time",
    desc: "Company profile, workforce and state breakdown, employee census, dependent tiers, current benefits and underwriting readiness, then the signed certification.",
  },
  {
    title: "Open items are listed, not buried",
    desc: "Underwriting readiness lists the checks that passed and every open item, including answers that were only inferred, are incomplete or conflict, so you know what to ask before you price.",
  },
  {
    title: "Certified by a verified contact",
    desc: "The prospect verifies their email, reviews the data and signs a certification before the packet is generated. Every packet carries a File ID.",
  },
];

// The complaints the product exists to end. Each is answered by "Never more."
const FAMILIAR = [
  "Submitted the census. Got it back: incomplete.",
  "Answered the same question. Then answered it again.",
  "Waited three weeks. The quote had the wrong class codes.",
];

const AUDIENCE = [
  "Business owners who've been through this before and want it faster.",
  "Brokers who need to move before the client loses patience.",
  "CPAs doing HR due diligence who need a number before the close.",
  "PE associates running comps on a target before the deal moves.",
];

const STEPS = [
  {
    icon: MessageCircle,
    title: "Chat or upload",
    desc: "Tell Lenore about your company, or drop in your census, declarations page and loss runs. She pulls out what she can and asks one question at a time for the rest.",
  },
  {
    icon: PenLine,
    title: "Review and sign",
    desc: "Lenore clears up what usually bounces a quote back: class codes, dependent gaps, workers' comp questions. You check every answer, verify your email and sign.",
  },
  {
    icon: Send,
    title: "Download and send",
    desc: "Download a clean, complete packet in the same layout every time, and send it to the PEO you choose.",
  },
];

// The example in the hero: what the intake looks like while Lenore fills in the packet. Sample data only.
const PACKET_DONE = ["Company details", "Workforce", "Locations", "Payroll"];

const IntakePreview = () => (
  <figure className="bg-card border border-border rounded-[28px] shadow-[0_24px_60px_hsl(var(--foreground)/0.08)] p-3 flex flex-wrap gap-3 text-left">
    <figcaption className="sr-only">An example intake: chatting with Lenore while the packet fills in.</figcaption>
    <div className="flex-[999_1_420px] min-w-0 p-4 sm:p-5 flex flex-col gap-4" aria-hidden="true">
      <LenoreLine>Hi, I'm Lenore, your intake assistant. Tell me a bit about your business, and drop your census on the Upload tab whenever it's handy.</LenoreLine>
      <div className="flex justify-end">
        <p className="max-w-[85%] bg-foreground text-background px-4 py-3 rounded-[18px] rounded-tr-[4px] leading-relaxed">
          We're a creative agency, 28 people across California and Texas, and we pay every two weeks.
        </p>
      </div>
      <LenoreLine>Thanks, got it. Who carries your health coverage today?</LenoreLine>
      <div className="mt-1 flex items-center gap-2 border border-border rounded-full pl-5 pr-1.5 py-1.5">
        <span className="flex-1 text-muted-foreground">Type a message...</span>
        <span className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
          <Send className="w-4 h-4" />
        </span>
      </div>
    </div>

    <div className="flex-[1_1_260px] min-w-0 bg-muted rounded-[20px] p-6" aria-hidden="true">
      <p className="font-extrabold text-lg">Your packet so far</p>
      <p className="text-sm text-muted-foreground mt-1 mb-4">4 of 6 done</p>
      <div className="h-2.5 rounded-full bg-card overflow-hidden">
        <div className="h-full w-2/3 rounded-full bg-primary" />
      </div>
      <ul className="mt-5 space-y-3 font-semibold">
        {PACKET_DONE.map((label) => (
          <li key={label} className="flex items-center gap-2.5">
            <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center shrink-0">
              <Check className="w-3.5 h-3.5" strokeWidth={3.2} />
            </span>
            {label}
          </li>
        ))}
        <li className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
          <span className="w-6 h-6 rounded-full border-2 border-dashed border-warning shrink-0" />
          <span className="whitespace-nowrap">Current benefits</span>
          <span className="ml-auto whitespace-nowrap text-xs font-bold text-warning bg-warning/10 border border-warning/30 px-2 py-0.5 rounded-full">1 question</span>
        </li>
        <li className="flex items-center gap-2.5 text-muted-foreground">
          <span className="w-6 h-6 rounded-full border-2 border-border shrink-0" />
          Review and sign
        </li>
      </ul>
    </div>
  </figure>
);

const LenoreLine = ({ children }: { children: string }) => (
  <div className="flex gap-2.5 items-start">
    <span className="w-9 h-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center shrink-0">
      <MessageCircle className="w-[18px] h-[18px]" />
    </span>
    <div>
      <p className="text-xs font-bold text-muted-foreground mb-1">Lenore</p>
      <p className="bg-muted px-4 py-3 rounded-[18px] rounded-tl-[4px] leading-relaxed">{children}</p>
    </div>
  </div>
);

const LandingPage = () => {
  // A page load of /#peo-partners renders the section after the browser has looked for it, so the
  // browser can't scroll there itself. Do it once the page has rendered.
  const { hash } = useLocation();
  useEffect(() => {
    // Only a plain section id: the hash can also hold an auth redirect's #access_token=… or #error=….
    const id = hash.slice(1);
    if (/^[a-z][a-z0-9-]*$/.test(id)) document.getElementById(id)?.scrollIntoView?.();
  }, [hash]);

  // The intake's code isn't part of this page's download (src/lib/lazyPages.ts). Fetch it once the browser is
  // idle, so "Start chatting" opens without a wait. Browsers without requestIdleCallback fetch it
  // when the visitor reaches for the button instead (startIntent below).
  useEffect(() => {
    if (typeof window.requestIdleCallback !== "function") return;
    const handle = window.requestIdleCallback(preloadIntake, { timeout: 4000 });
    return () => window.cancelIdleCallback(handle);
  }, []);
  const startIntent = { onPointerEnter: preloadIntake, onFocus: preloadIntake, onTouchStart: preloadIntake };

  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <section className="px-6 pt-32 pb-12 md:pt-36">
        <div className="mx-auto max-w-3xl text-center">
          <motion.h1
            {...fadeUp(0.1)}
            className="font-display text-[clamp(1.9rem,9.5vw,2.6rem)] leading-[1.08] sm:text-6xl md:text-7xl font-extrabold tracking-tight"
          >
            Never more <span className="bg-highlight text-highlight-foreground rounded-xl px-2.5 whitespace-nowrap">back-and-forth.</span>
          </motion.h1>
          <motion.p {...fadeUp(0.2)} className="text-lg md:text-xl text-muted-foreground max-w-[620px] mx-auto mt-6 leading-relaxed">
            Have a quick chat with Lenore, drop in your census, and leave with a complete underwriting packet for the PEO
            you choose. Skip the long forms and the <span className="whitespace-nowrap">three-email</span> threads.
          </motion.p>
          <motion.div {...fadeUp(0.3)} className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3 mt-9">
            <Link
              to="/start"
              {...startIntent}
              className="inline-flex items-center justify-center min-h-[52px] px-7 rounded-full bg-primary text-primary-foreground font-bold text-[17px] hover:bg-primary/90 transition-colors"
            >
              Start chatting →
            </Link>
            <a href="#how-it-works" className="font-bold underline underline-offset-4 decoration-2 hover:text-primary transition-colors">
              See how it works
            </a>
          </motion.div>
          <motion.p {...fadeUp(0.4)} className="mt-6 text-[15px] text-muted-foreground">
            {/* Each fact stays on one line; the line breaks only at the separators between them. */}
            {["About 15–20 minutes", "Start as a guest", "PEO-neutral", "You approve every answer"].map((fact, i) => (
              <Fragment key={fact}>
                {i > 0 && <span aria-hidden="true"> · </span>}
                <span className="whitespace-nowrap">{fact}</span>
              </Fragment>
            ))}
          </motion.p>
        </div>
        <motion.div {...fadeUp(0.5)} className="mx-auto max-w-5xl mt-14">
          <IntakePreview />
        </motion.div>
      </section>

      {/* Sound familiar? */}
      <section className="px-6 py-20">
        <div className="mx-auto max-w-5xl text-center">
          <motion.h2 {...sectionFade} className="text-3xl md:text-4xl font-extrabold mb-8">
            Sound familiar?
          </motion.h2>
          <motion.div {...sectionFade} className="flex flex-wrap justify-center gap-4">
            {FAMILIAR.map((line) => (
              <p
                key={line}
                className="basis-[300px] grow sm:grow-0 bg-card border border-border px-5 py-4 rounded-[22px] rounded-bl-[6px] text-[17px] font-semibold leading-snug text-left"
              >
                “{line}”
              </p>
            ))}
          </motion.div>
          <motion.p {...sectionFade} className="mt-10 text-3xl font-extrabold tracking-tight">
            Never more.
          </motion.p>
          <motion.p {...sectionFade} className="mt-2 text-lg text-muted-foreground">
            Lenore asks the underwriter's questions up front, so the quote comes back clean.
          </motion.p>
        </div>
      </section>

      {/* Who it's for */}
      <section className="px-6 pb-20">
        <div className="mx-auto max-w-4xl">
          <motion.h2 {...sectionFade} className="text-center text-2xl md:text-3xl font-extrabold mb-8">
            Made for people who need the packet yesterday
          </motion.h2>
          <motion.ul {...sectionFade} className="grid sm:grid-cols-2 gap-3">
            {AUDIENCE.map((who) => (
              <li key={who} className="flex gap-3 items-start bg-card border border-border rounded-2xl p-4 leading-relaxed">
                <Check className="w-5 h-5 text-primary shrink-0 mt-0.5" strokeWidth={3} aria-hidden="true" />
                {who}
              </li>
            ))}
          </motion.ul>
        </div>
      </section>

      {/* How it works. scroll-mt keeps the heading clear of the fixed navbar when a link jumps here. */}
      <section id="how-it-works" className="bg-muted px-6 py-20 scroll-mt-16">
        <div className="mx-auto max-w-5xl">
          <motion.h2 {...sectionFade} className="text-center text-3xl md:text-4xl font-extrabold mb-12">
            Three steps. About twenty minutes.
          </motion.h2>
          <div className="grid md:grid-cols-3 gap-5">
            {STEPS.map(({ icon: Icon, title, desc }, i) => (
              <motion.div
                key={title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="bg-card rounded-3xl p-7"
              >
                <span className="w-[52px] h-[52px] rounded-2xl bg-highlight text-highlight-foreground flex items-center justify-center">
                  <Icon className="w-6 h-6" aria-hidden="true" />
                </span>
                <h3 className="text-xl font-extrabold mt-5 mb-2">
                  <span className="sr-only">Step {i + 1}: </span>
                  {title}
                </h3>
                <p className="text-muted-foreground leading-relaxed">{desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* For PEO Partners: what a PEO's underwriters receive. Names no PEO, so it implies no affiliation. */}
      <section id="peo-partners" className="px-6 py-20 scroll-mt-16">
        <div className="mx-auto max-w-5xl">
          <motion.div {...sectionFade} className="text-center mb-12">
            <p className="text-sm font-bold uppercase tracking-widest text-primary mb-3">For PEO Partners</p>
            <h2 className="text-3xl md:text-4xl font-extrabold mb-4">A packet your underwriters can work from.</h2>
            <p className="text-muted-foreground text-lg leading-relaxed max-w-2xl mx-auto">
              Every packet follows the same layout, whichever PEO the prospect chooses to send it to. The facts that
              usually take three email threads to collect arrive in one document.
            </p>
          </motion.div>
          <div className="grid md:grid-cols-3 gap-5">
            {PEO_PARTNER_POINTS.map((item, i) => (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="bg-card border border-border rounded-3xl p-7"
              >
                <h3 className="text-lg font-extrabold mb-2">{item.title}</h3>
                <p className="text-muted-foreground leading-relaxed">{item.desc}</p>
              </motion.div>
            ))}
          </div>
          <motion.div {...sectionFade} className="text-center mt-10">
            <Link
              to="/manuscript/demo"
              className="inline-flex items-center justify-center min-h-[48px] px-6 rounded-full bg-foreground text-background font-bold hover:bg-foreground/90 transition-colors"
            >
              See a sample packet →
            </Link>
            <p className="text-sm text-muted-foreground mt-4">
              Nevermore is PEO-neutral: the prospect picks the PEO and sends the packet themselves.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Data note */}
      <section className="px-6 pb-20">
        <motion.div {...sectionFade} className="mx-auto max-w-3xl bg-card border border-border rounded-3xl p-7 md:p-8">
          <h2 className="text-xl font-extrabold mb-3">About your information</h2>
          <p className="text-muted-foreground leading-relaxed">
            Lenore asks for company details and employee information: the census, payroll, benefits and workers' comp
            history. It's used to prepare your packet and for our advisors to review it with you. An AI assistant reads
            what you share so it can fill in your answers, and you confirm every one before you certify. Files stay in
            private storage, drafts you don't certify are deleted on a schedule, and we don't sell your information.
          </p>
          <p className="text-muted-foreground leading-relaxed mt-3">
            What we collect, who handles it and how long it's kept are set out in our{" "}
            <Link to="/privacy" className="font-semibold text-foreground underline underline-offset-2 hover:text-primary">
              Privacy Policy
            </Link>
            .
          </p>
        </motion.div>
      </section>

      {/* Final CTA */}
      <section className="bg-muted px-6 py-20">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl md:text-4xl font-extrabold mb-3">Ready when your census is.</h2>
          <p className="text-lg text-muted-foreground mb-8">Start as a guest. You verify your email when you're ready to sign.</p>
          <Link
            to="/start"
            {...startIntent}
            className="inline-flex items-center justify-center min-h-[52px] px-7 rounded-full bg-primary text-primary-foreground font-bold text-[17px] hover:bg-primary/90 transition-colors"
          >
            Start chatting →
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border px-6 py-12">
        <div className="mx-auto max-w-4xl flex flex-col items-center gap-4 text-center">
          <div className="flex items-center gap-2">
            <BrandMark className="w-7 h-7 text-primary" />
            <Wordmark className="text-xl" />
          </div>
          <p className="font-semibold text-muted-foreground">Never more back-and-forth.</p>
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
            <a href="#how-it-works" className="whitespace-nowrap hover:text-foreground transition-colors">How It Works</a>
            <a href="#peo-partners" className="whitespace-nowrap hover:text-foreground transition-colors">For PEO Partners</a>
            <Link to="/start" className="whitespace-nowrap hover:text-foreground transition-colors">Start your intake</Link>
          </div>
          <p className="text-xs text-muted-foreground">Nevermore is a service of Edgar Allan Advisory.</p>
          <LegalLinks copyright />
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
