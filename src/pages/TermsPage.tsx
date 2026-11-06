import { Link } from "react-router-dom";
import LegalPageLayout from "@/components/LegalPageLayout";
import { COUNSEL_PLACEHOLDER, PRIVACY_CONTACT, PRIVACY_CONTACT_PENDING, TERMS_VERSION } from "@/data/legal";

// The Terms of Use (US-6.2). DRAFT until counsel approves it (src/data/legal.ts, docs/LEGAL_REVIEW.md). The
// bracketed sections (COUNSEL_PLACEHOLDER) are for counsel to write; the review lists them so none ships unfilled.

const TermsPage = () => (
  <LegalPageLayout title="Terms of Use" version={TERMS_VERSION}>
    <section aria-labelledby="terms-role">
      <h2 id="terms-role">Who we are and what we do</h2>
      <p>
        Nevermore, a service of Edgar Allan Advisory, prepares PEO underwriting packets. In these terms, "we", "us" and
        "our" mean Edgar Allan Advisory. Through this site you give us information about your company, review and
        certify it, and download a packet to send to the PEO you choose.
      </p>
      <p className="mt-3">
        We are not a PEO, an insurance carrier or an insurance agency. A PEO shown in the product is listed for
        comparison only; naming it doesn't mean it endorses, sponsors or works with us.
      </p>
    </section>

    <section aria-labelledby="terms-not">
      <h2 id="terms-not">What we don't do</h2>
      <ul className="list-disc pl-5 space-y-2">
        <li>We don't submit your packet to a PEO or request a quote for you. You send it yourself.</li>
        <li>
          Nothing in the product is a quote, an offer of coverage, or a promise that a PEO will accept your company or
          price it in any particular way. Those decisions are the PEO's.
        </li>
        <li>The PEO comparison shows sourced facts. It doesn't rank PEOs or recommend one.</li>
      </ul>
    </section>

    <section aria-labelledby="terms-who">
      <h2 id="terms-who">Who may use it</h2>
      <p>
        You may use the intake only for a company you're authorized to act for, and only if you're authorized to
        share its information, including its employees' personal information, for preparing an underwriting packet.
        Certifying an intake requires a verified email address.
      </p>
    </section>

    <section aria-labelledby="terms-accuracy">
      <h2 id="terms-accuracy">Your information and its accuracy</h2>
      <ul className="list-disc pl-5 space-y-2">
        <li>
          Lenore, our AI intake assistant, fills in answers from what you type, say and upload. She can misread or
          misunderstand, so every answer is yours to confirm or correct.
        </li>
        <li>
          When you certify, you confirm that the information is accurate and complete to the best of your knowledge.
          The packet reflects what you certified.
        </li>
        <li>
          If your answers change after you certify, the certification no longer applies and you certify again before
          a new packet is made.
        </li>
      </ul>
    </section>

    <section aria-labelledby="terms-use">
      <h2 id="terms-use">Acceptable use</h2>
      <p>Don't:</p>
      <ul className="list-disc pl-5 space-y-2 mt-2">
        <li>share information you're not authorized to share, or information about a company you don't act for;</li>
        <li>upload Social Security numbers, bank account details or medical records (the packet doesn't need them);</li>
        <li>upload files that contain malware, or try to reach information that isn't yours;</li>
        <li>overload, probe or automate requests against the service, or try to get around its limits;</li>
        <li>use the service for anything unlawful.</li>
      </ul>
      <p className="mt-3">We may suspend access, or close an intake, that breaks these rules.</p>
    </section>

    <section aria-labelledby="terms-packet">
      <h2 id="terms-packet">Your packet</h2>
      <p>
        The information you provide, and the packet made from it, are yours to use and send to any PEO you choose. We
        keep a copy only as our{" "}
        <Link to="/privacy" className="underline underline-offset-2 hover:text-foreground">
          Privacy Policy
        </Link>{" "}
        describes. The site itself, its design and Lenore are ours.
      </p>
    </section>

    <section aria-labelledby="terms-availability">
      <h2 id="terms-availability">Availability</h2>
      <p>
        We work to keep the service available and your answers saved, but we can't promise it will always be
        available or error-free. An intake you don't certify expires after a period without changes, as the Privacy
        Policy explains. Voice conversations are an optional beta; typing always works.
      </p>
    </section>

    <section aria-labelledby="terms-disclaimers">
      <h2 id="terms-disclaimers">Disclaimers</h2>
      <p>{COUNSEL_PLACEHOLDER}</p>
    </section>

    <section aria-labelledby="terms-liability">
      <h2 id="terms-liability">Limitation of liability</h2>
      <p>{COUNSEL_PLACEHOLDER}</p>
    </section>

    <section aria-labelledby="terms-law">
      <h2 id="terms-law">Governing law</h2>
      <p>{COUNSEL_PLACEHOLDER}</p>
    </section>

    <section aria-labelledby="terms-disputes">
      <h2 id="terms-disputes">Disputes and arbitration</h2>
      <p>{COUNSEL_PLACEHOLDER}</p>
    </section>

    <section aria-labelledby="terms-changes">
      <h2 id="terms-changes">Changes to these terms</h2>
      <p>
        When these terms change, the version and date at the top change with them. Continuing to use the service
        after a change means you accept the new terms.
      </p>
    </section>

    <section aria-labelledby="terms-contact">
      <h2 id="terms-contact">Contact</h2>
      <p>
        {PRIVACY_CONTACT ? (
          <>
            Questions about these terms:{" "}
            <a href={`mailto:${PRIVACY_CONTACT}`} className="underline underline-offset-2 hover:text-foreground">
              {PRIVACY_CONTACT}
            </a>
            .
          </>
        ) : (
          PRIVACY_CONTACT_PENDING
        )}
      </p>
    </section>
  </LegalPageLayout>
);

export default TermsPage;
