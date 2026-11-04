import { Link } from "react-router-dom";
import LegalPageLayout from "@/components/LegalPageLayout";
import { DATA_CLASSES, RETENTION, RETENTION_RULES, SENSITIVITY, type Sensitivity } from "@/data/dataPolicy";
import { PRIVACY_CONTACT, PRIVACY_CONTACT_PENDING, PRIVACY_POLICY_VERSION, SERVICE_PROVIDERS } from "@/data/legal";

// The Privacy Policy (US-6.2). What it says about collection and retention is rendered from
// src/data/dataPolicy.ts, the same policy the database enforces, so the page can't drift from it.
// DRAFT until counsel approves it (src/data/legal.ts, docs/LEGAL_REVIEW.md).

const LEVELS: Sensitivity[] = ["restricted", "confidential", "internal"];

const PrivacyPage = () => (
  <LegalPageLayout title="Privacy Policy" version={PRIVACY_POLICY_VERSION}>
    <section aria-labelledby="privacy-who">
      <h2 id="privacy-who">Who we are</h2>
      <p>
        Edgar Allan Advisory prepares PEO underwriting packets. You tell Lenore, our AI intake assistant, about your
        company and upload what you have; you review and certify the answers; and you leave with a packet (the
        Manuscript) to send to the PEO you choose.
      </p>
      <p className="mt-3">
        We are not a PEO, an insurance carrier or an insurance agency. We don't submit your packet or request a quote
        for you: you send it yourself. A PEO shown in the product is listed for comparison only; naming it doesn't mean
        it endorses, sponsors or works with us.
      </p>
    </section>

    <section aria-labelledby="privacy-collect">
      <h2 id="privacy-collect">What we collect</h2>
      <p className="mb-4">
        We sort what we hold by how sensitive it is. The more sensitive it is, the fewer people can see it and the
        stricter the rules for handling it.
      </p>
      <div className="space-y-6">
        {LEVELS.map((level) => {
          const classes = DATA_CLASSES.filter((c) => c.sensitivity === level);
          if (classes.length === 0) return null;
          return (
            <div key={level} className="bg-card border border-border rounded-xl p-5">
              <h3 className="font-display text-lg font-bold mb-1">{SENSITIVITY[level].label}</h3>
              <p className="mb-3">{SENSITIVITY[level].meaning}</p>
              <ul className="space-y-2">
                {classes.map((c) => (
                  <li key={c.id}>
                    <span className="font-medium text-foreground">{c.label}.</span> {c.examples}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
      <p className="mt-4">
        Please leave out Social Security numbers, bank account details and medical records. The packet doesn't need
        them, and we don't read Social Security numbers or bank details from uploaded files.
      </p>
    </section>

    <section aria-labelledby="privacy-use">
      <h2 id="privacy-use">How we use it</h2>
      <ul className="list-disc pl-5 space-y-2">
        <li>To prepare your packet from the answers and documents you give us.</li>
        <li>
          To let an AI assistant read what you type, say and upload so it can fill in your answers. Nothing it captures
          counts until you confirm or correct it, and you review every answer before you certify.
        </li>
        <li>To let our advisors review your submission with you, and to contact you about it.</li>
        <li>To send you sign-in codes and a confirmation when you submit.</li>
        <li>To keep the service secure and working: preventing abuse, and spotting errors and failed uploads.</li>
      </ul>
      <p className="mt-3">We don't sell your information or your employees' information.</p>
    </section>

    <section aria-labelledby="privacy-share">
      <h2 id="privacy-share">Who sees it</h2>
      <p>
        You, and Edgar Allan Advisory's advisors. Your packet reaches a PEO only when you send it there. These
        services handle intake information for us, to run the product:
      </p>
      <div className="overflow-x-auto mt-4">
        <table className="w-full text-left border border-border rounded-lg">
          <thead className="bg-muted/50">
            <tr>
              <th scope="col" className="p-3 font-medium">Service</th>
              <th scope="col" className="p-3 font-medium">What it does</th>
              <th scope="col" className="p-3 font-medium">What it handles</th>
            </tr>
          </thead>
          <tbody>
            {SERVICE_PROVIDERS.map((p) => (
              <tr key={p.name} className="border-t border-border align-top">
                <th scope="row" className="p-3 font-medium text-foreground">{p.name}</th>
                <td className="p-3 text-muted-foreground">{p.role}</td>
                <td className="p-3 text-muted-foreground">{p.handles}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>

    <section aria-labelledby="privacy-retention">
      <h2 id="privacy-retention">How long we keep it</h2>
      <p className="mb-4">
        We keep information only as long as these rules allow. Scheduled jobs in our database apply them; a
        submitted record is reviewed by an administrator before it is deleted.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-left border border-border rounded-lg">
          <thead className="bg-muted/50">
            <tr>
              <th scope="col" className="p-3 font-medium">What</th>
              <th scope="col" className="p-3 font-medium">Kept for</th>
              <th scope="col" className="p-3 font-medium">Then</th>
            </tr>
          </thead>
          <tbody>
            {RETENTION_RULES.map((rule) => (
              <tr key={rule.record} className="border-t border-border align-top">
                <th scope="row" className="p-3 font-medium text-foreground">{rule.record}</th>
                <td className="p-3 text-muted-foreground">{rule.period}</td>
                <td className="p-3 text-muted-foreground">{rule.then}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>

    <section aria-labelledby="privacy-delete">
      <h2 id="privacy-delete">Deleting your information</h2>
      <ul className="list-disc pl-5 space-y-2">
        <li>
          Choosing "Start over" in the Chamber closes a draft you haven't certified. It is deleted{" "}
          {RETENTION.closedDraftDays} days later.
        </li>
        <li>While an intake is open you can remove any document you uploaded.</li>
        <li>
          You can ask us to delete an intake, certified or not, or your whole account, at any time. We confirm the
          request comes from you, then delete the intake's answers, conversation, documents, certifications and our
          advisors' notes about it. Stored files are removed before the records that point to them.
        </li>
        <li>
          We keep a record that a deletion happened (when, why and how much was removed), never what was deleted.
          Deleted information can remain in our database backups until those backups expire.
        </li>
      </ul>
    </section>

    <section aria-labelledby="privacy-security">
      <h2 id="privacy-security">How we protect it</h2>
      <ul className="list-disc pl-5 space-y-2">
        <li>Uploaded files and generated packets are kept in private storage, never at a public address.</li>
        <li>
          Who can see what is enforced by our database: you see only your own intakes, and only our advisors see
          anyone else's.
        </li>
        <li>When an advisor opens a file, the link expires after 60 seconds.</li>
        <li>
          Dates of birth are masked by default on the Manuscript, and our advisors' copies keep them masked unless the
          advisor chooses otherwise, which is recorded.
        </li>
        <li>
          We record your agreement before an intake starts, and the exact wording you certify, so there is always a
          record of what you agreed to.
        </li>
        <li>Error and failure monitoring records codes and counts, never your answers.</li>
      </ul>
    </section>

    <section aria-labelledby="privacy-employees">
      <h2 id="privacy-employees">Your employees' information</h2>
      <p>
        The census and payroll information you share is about your employees, not you. By starting an intake you
        confirm you're authorized by your company to share it for preparing this packet. We use it only for that,
        and handle it at our highest level of care.
      </p>
    </section>

    <section aria-labelledby="privacy-changes">
      <h2 id="privacy-changes">Changes to this policy</h2>
      <p>
        When this policy changes, the version and date at the top change with it. If the wording you agree to
        before an intake changes, we ask you to agree again before you continue.
      </p>
    </section>

    <section aria-labelledby="privacy-contact">
      <h2 id="privacy-contact">Contact</h2>
      <p>
        {PRIVACY_CONTACT ? (
          <>
            For privacy questions and deletion requests, write to{" "}
            <a href={`mailto:${PRIVACY_CONTACT}`} className="underline underline-offset-2 hover:text-foreground">
              {PRIVACY_CONTACT}
            </a>
            .
          </>
        ) : (
          PRIVACY_CONTACT_PENDING
        )}
      </p>
      <p className="mt-3">
        See also our{" "}
        <Link to="/terms" className="underline underline-offset-2 hover:text-foreground">
          Terms of Use
        </Link>
        .
      </p>
    </section>
  </LegalPageLayout>
);

export default PrivacyPage;
