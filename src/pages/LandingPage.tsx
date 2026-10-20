import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { RavenIcon } from "@/components/RavenLogo";

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

const LandingPage = () => {
  return (
    <div className="min-h-screen bg-background relative noise-overlay">
      {/* Hero */}
      <section className="relative min-h-screen flex items-center justify-center px-6 pt-16">
        <div className="container mx-auto max-w-3xl text-center relative z-10">
          <motion.div {...fadeUp(0.1)} className="mb-6">
            <RavenIcon className="w-14 h-14 text-primary mx-auto opacity-70" />
          </motion.div>
          <motion.h1
            {...fadeUp(0.2)}
            className="font-display text-5xl md:text-7xl font-bold tracking-tight leading-tight mb-6"
          >
            Nevermore will HR
            <br />
            <span className="text-primary italic">slow you down.</span>
          </motion.h1>
          <motion.p
            {...fadeUp(0.3)}
            className="text-lg text-muted-foreground max-w-[520px] mx-auto mb-10 leading-relaxed"
          >
            Upload your census. Talk to Lenore. Get a complete, submission-ready
            package for your PEO — same session, no follow-up required.
          </motion.p>
          <motion.div {...fadeUp(0.4)}>
            <Link
              to="/start"
              className="inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground font-medium px-8 py-3.5 rounded-lg hover:bg-primary/90 transition-colors text-base"
            >
              Get Your Quote →
            </Link>
          </motion.div>
          <motion.div {...fadeUp(0.5)} className="flex items-center justify-center gap-6 mt-8 text-sm text-muted-foreground">
            <span>No account required</span>
            <span className="text-border">·</span>
            <span>15–20 minutes</span>
            <span className="text-border">·</span>
            <span>Manuscript ready same session</span>
          </motion.div>
        </div>

        <motion.div
          className="absolute bottom-20 right-10 opacity-[0.03]"
          animate={{ y: [0, -15, 0] }}
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
        >
          <RavenIcon className="w-64 h-64 text-foreground" />
        </motion.div>
      </section>


      {/* Commiseration */}
      <section className="py-24 relative z-10">
        <div className="container mx-auto px-6 max-w-2xl text-center">
          <motion.div {...sectionFade} className="space-y-4 mb-8">
            <p className="font-display text-xl md:text-2xl italic text-foreground/80">
              "Submitted the census. Got it back — incomplete."
            </p>
            <p className="font-display text-xl md:text-2xl italic text-foreground/80">
              "Answered the same question. Then answered it again."
            </p>
            <p className="font-display text-xl md:text-2xl italic text-foreground/80">
              "Waited three weeks. The quote had the wrong class codes."
            </p>
          </motion.div>
          <motion.p {...sectionFade} className="text-muted-foreground text-sm leading-relaxed">
            If any of those felt personal, you're in the right place.
            <br />
            Lenore asks the questions upfront — so the quote comes back clean.
          </motion.p>
        </div>
      </section>

      {/* Who This Is For */}
      <section className="py-16 relative z-10">
        <div className="container mx-auto px-6 max-w-2xl">
          <motion.div {...sectionFade} className="space-y-3 text-muted-foreground text-sm">
            <p className="pl-4">— Business owners who've been through this before and want it faster.</p>
            <p className="pl-4">— Brokers who need to move before the client loses patience.</p>
            <p className="pl-4">— CPAs doing HR due diligence and need a number before the close.</p>
            <p className="pl-4">— PE associates running comps on a target before the deal moves.</p>
          </motion.div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-24 border-t border-border relative z-10">
        <div className="container mx-auto px-6 max-w-4xl">
          <motion.h2 {...sectionFade} className="font-display text-3xl md:text-4xl font-bold text-center mb-16">
            Three steps. One document.
          </motion.h2>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                step: "①",
                title: "The Chamber",
                desc: "Lenore walks you through the intake. Upload what you have — census, declarations page, loss runs — and she extracts what she needs. One question at a time for anything that's missing.",
              },
              {
                step: "②",
                title: "The Pre-Screen",
                desc: "Lenore resolves the things that normally cause a quote to bounce back: class code ambiguity, dependent data gaps, workers' comp questions that usually take three email threads to answer. Done in the conversation.",
              },
              {
                step: "③",
                title: "The Manuscript",
                desc: "A clean, complete submission package. Ready for PEO underwriting. Download it. Send it. Done.",
              },
            ].map((item, i) => (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="bg-card border border-border rounded-xl p-8 hover:border-primary/30 transition-colors"
              >
                <span className="text-primary font-mono text-lg mb-4 block">{item.step}</span>
                <h3 className="font-display text-xl font-bold mb-3">{item.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Data Note */}
      <section className="py-16 relative z-10">
        <div className="container mx-auto px-6 max-w-2xl">
          <motion.div {...sectionFade} className="bg-card border border-border rounded-xl p-8">
            <h3 className="font-display text-lg font-bold mb-3">About your information</h3>
            <p className="text-muted-foreground text-sm leading-relaxed">
              What Lenore collects — company info, headcount, job titles, payroll,
              workers' comp history — is standard employer HR data. The same information
              you'd share with any broker or HR advisor. It's not health data until it
              goes to a carrier. We use it to build your submission and nothing else.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-20 relative z-10" style={{ backgroundColor: "hsl(var(--secondary) / 0.1)" }}>
        <div className="container mx-auto px-6 max-w-2xl text-center">
          <p className="text-muted-foreground text-sm mb-6">
            The things underwriters always ask about —
            <br />
            Lenore asks them first.
          </p>
          <Link
            to="/start"
            className="inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground font-medium px-8 py-3.5 rounded-lg hover:bg-primary/90 transition-colors text-base"
          >
            Get Your Quote →
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-12 relative z-10">
        <div className="container mx-auto px-6 max-w-4xl">
          <div className="flex flex-col items-center gap-4">
            <div className="flex items-center gap-2">
              <RavenIcon className="w-5 h-5 text-primary" />
              <span className="font-display text-sm">Edgar Allan Advisory</span>
            </div>
            <p className="font-display text-sm italic text-muted-foreground">
              "Nevermore will HR slow you down."
            </p>
            <div className="flex items-center gap-6 text-sm text-muted-foreground">
              <a href="#how-it-works" className="hover:text-foreground transition-colors">How It Works</a>
              <Link to="/start" className="hover:text-foreground transition-colors">Get Your Quote</Link>
            </div>
            <p className="text-xs text-muted-foreground mt-4">© Edgar Allan Advisory.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
