import { useRef, useState } from "react";
import { motion } from "framer-motion";
import { RavenIcon } from "@/components/RavenLogo";
import { CheckCircle, AlertTriangle, Download, Eye, EyeOff, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

const SAMPLE_DATA = {
  company: {
    name: "Meridian Creative Group LLC",
    ein: "82-XXXXXXX",
    einFull: "82-4719382",
    hq: "Costa Mesa, CA 92626",
    industry: "Marketing & Creative Services",
    years: "6",
    entity: "LLC",
    coverageStatus: "First-time — no prior employer health benefits",
    currentPayroll: "Gusto (payroll only)",
  },
  workforce: {
    totalW2: 28,
    fullTime: 24,
    partTime: 4,
    contractors1099: 2,
    k1Owners: 1,
    totalWorksite: 28,
    states: [
      { state: "California", count: 22, system: "WCIRB" },
      { state: "Texas", count: 6, system: "NCCI" },
    ],
  },
  census: [
    { id: 1, name: "Sarah Chen", dob: "04/12/1989", state: "CA", title: "Software Engineer", salary: "$118,000", wcCode: "8810", wcStatus: "verified" as const, tier: "EE+Family", status: "verified" as const },
    { id: 2, name: "Marcus Williams", dob: "07/22/1985", state: "CA", title: "Product Manager", salary: "$134,000", wcCode: "8810", wcStatus: "verified" as const, tier: "EE Only", status: "verified" as const },
    { id: 3, name: "Jennifer Park", dob: "11/03/1991", state: "TX", title: "Account Executive", salary: "$85,000", wcCode: "8742⚠", wcStatus: "flagged" as const, tier: "EE Only", status: "flagged" as const },
    { id: 4, name: "David Kim", dob: "06/15/1990", state: "CA", title: "Frontend Engineer", salary: "$115,000", wcCode: "8810", wcStatus: "verified" as const, tier: "EE+Spouse", status: "verified" as const },
    { id: 5, name: "Lisa Tanaka", dob: "09/12/1987", state: "CA", title: "Project Manager", salary: "$110,000", wcCode: "8810", wcStatus: "verified" as const, tier: "EE+Family", status: "verified" as const },
    { id: 6, name: "Elena Vasquez", dob: "06/18/1989", state: "TX", title: "Account Manager", salary: "$85,000", wcCode: "8810", wcStatus: "verified" as const, tier: "EE+Child", status: "verified" as const },
  ],
  dependents: [
    { tier: "Employee Only", count: 18, pct: "64%" },
    { tier: "Employee + Spouse", count: 5, pct: "18%" },
    { tier: "Employee + Child(ren)", count: 2, pct: "7%" },
    { tier: "Employee + Family", count: 3, pct: "11%" },
  ],
  workersComp: {
    carrier: "Travelers Insurance",
    expiration: "September 30, 2026",
    emr: "0.87",
    annualPayroll: "$2,640,000",
    claimsCount: "1 (closed)",
    openClaims: "0",
    cancellations: "None",
    classCodes: [
      { code: "8810", desc: "Clerical Office", payroll: "$1,920,000", count: 21 },
      { code: "8742", desc: "Outside Sales (field)", payroll: "$510,000", count: 5 },
      { code: "8820", desc: "Drafting / Design", payroll: "$210,000", count: 2 },
    ],
  },
  fileId: "EAA-2026-0847",
  date: new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }),
};

const SectionHeader = ({ children }: { children: React.ReactNode }) => (
  <h3 className="font-display text-lg font-bold mb-4 pl-4 border-l-4 border-primary">{children}</h3>
);

const DataRow = ({ label, value }: { label: string; value: string }) => (
  <div className="flex justify-between py-2 border-b border-border last:border-0">
    <span className="text-muted-foreground text-sm">{label}</span>
    <span className="font-mono text-sm text-foreground">{value}</span>
  </div>
);

const ManuscriptPage = () => {
  const manuscriptRef = useRef<HTMLDivElement>(null);
  const [showMasked, setShowMasked] = useState(true);
  const d = SAMPLE_DATA;

  const handleDownloadPDF = async () => {
    if (!manuscriptRef.current) return;
    const canvas = await html2canvas(manuscriptRef.current, {
      backgroundColor: "#07080D",
      scale: 2,
      useCORS: true,
    });
    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "letter" });
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
    let heightLeft = pdfHeight;
    let position = 0;
    pdf.addImage(imgData, "PNG", 0, position, pdfWidth, pdfHeight);
    heightLeft -= pdf.internal.pageSize.getHeight();
    while (heightLeft > 0) {
      position -= pdf.internal.pageSize.getHeight();
      pdf.addPage();
      pdf.addImage(imgData, "PNG", 0, position, pdfWidth, pdfHeight);
      heightLeft -= pdf.internal.pageSize.getHeight();
    }
    pdf.save(`The_Manuscript_${d.fileId}.pdf`);
  };

  const displayEIN = showMasked ? d.company.ein : d.company.einFull;

  return (
    <div className="min-h-screen bg-background">
      {/* Sticky actions bar */}
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-md border-b border-border">
        <div className="container mx-auto max-w-5xl px-6 h-14 flex items-center justify-between">
          <Link to="/start" className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1.5 transition-colors">
            <ArrowLeft className="w-4 h-4" /> Back to Review
          </Link>
          <div className="flex items-center gap-3">
            <button onClick={() => setShowMasked(!showMasked)}
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1.5 transition-colors">
              {showMasked ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              {showMasked ? "Data masked" : "Data visible"}
            </button>
            <button onClick={handleDownloadPDF}
              className="inline-flex items-center gap-2 text-sm bg-primary text-primary-foreground px-4 py-1.5 rounded-md hover:bg-primary/90 transition-colors">
              <Download className="w-4 h-4" /> Download The Manuscript (PDF)
            </button>
          </div>
        </div>
      </div>

      <div ref={manuscriptRef} className="container mx-auto max-w-5xl px-6 py-12 space-y-10">
        {/* Header */}
        <div className="bg-card border border-border rounded-xl p-8 md:p-10">
          <div className="flex items-start gap-4 mb-8">
            <RavenIcon className="w-10 h-10 text-primary flex-shrink-0" />
            <div>
              <h1 className="font-display text-3xl md:text-4xl font-bold tracking-tight">THE MANUSCRIPT</h1>
              <p className="text-muted-foreground text-sm mt-1">Edgar Allan Advisory · Certified Submission</p>
            </div>
          </div>
          <div className="border-t border-border pt-6 grid grid-cols-2 md:grid-cols-3 gap-y-4 gap-x-8 text-sm font-mono">
            <div><span className="text-muted-foreground text-xs block mb-0.5">SUBMITTED TO</span>TriNet Group, Inc. — Underwriting</div>
            <div><span className="text-muted-foreground text-xs block mb-0.5">PREPARED BY</span>Edgar Allan Advisory · Lenore</div>
            <div><span className="text-muted-foreground text-xs block mb-0.5">DATE</span>{d.date}</div>
            <div><span className="text-muted-foreground text-xs block mb-0.5">FILE ID</span><span className="text-primary">{d.fileId}</span></div>
            <div><span className="text-muted-foreground text-xs block mb-0.5">PROSPECT</span>{d.company.name}</div>
          </div>
        </div>

        {/* Certification Banner */}
        <div className="bg-primary rounded-xl p-6">
          <p className="font-mono text-xs text-primary-foreground/80 uppercase tracking-wider mb-2">■ Edgar Allan Advisory — Pre-Screened Submission</p>
          <p className="text-primary-foreground text-sm leading-relaxed">
            Items that commonly require underwriting follow-up have been
            resolved prior to submission. Ready for immediate review.
          </p>
        </div>

        {/* Section 1 — Company Profile */}
        <section>
          <SectionHeader>1 — Company Profile</SectionHeader>
          <div className="bg-card border border-border rounded-xl p-6">
            {[
              ["Legal Name", d.company.name],
              ["EIN", displayEIN],
              ["HQ", d.company.hq],
              ["Industry", d.company.industry],
              ["Entity", d.company.entity],
              ["Years Operating", d.company.years],
              ["Current HR/Payroll", d.company.currentPayroll],
              ["Coverage Status", d.company.coverageStatus],
            ].map(([k, v]) => <DataRow key={k} label={k} value={v} />)}
          </div>
        </section>

        {/* Section 2 — Workforce Summary */}
        <section>
          <SectionHeader>2 — Workforce Summary</SectionHeader>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-card border border-border rounded-xl p-6">
              {[
                ["W-2 Employees", d.workforce.totalW2],
                ["Full-Time", d.workforce.fullTime],
                ["Part-Time", d.workforce.partTime],
                ["1099 Contractors", d.workforce.contractors1099],
                ["K-1 Owners (excluded)", d.workforce.k1Owners],
                ["Eligible Worksite Employees", d.workforce.totalWorksite],
              ].map(([k, v]) => <DataRow key={String(k)} label={String(k)} value={String(v)} />)}
            </div>
            <div className="space-y-4">
              <div className="bg-card border border-border rounded-xl p-6">
                <p className="text-xs text-muted-foreground font-mono mb-3">STATE BREAKDOWN</p>
                <table className="w-full text-sm">
                  <thead><tr className="text-muted-foreground text-left"><th className="pb-2">State</th><th className="pb-2">Employees</th><th className="pb-2">W/C System</th></tr></thead>
                  <tbody>
                    {d.workforce.states.map((s) => (
                      <tr key={s.state} className="border-t border-border">
                        <td className="py-2 font-mono">{s.state}</td>
                        <td className="py-2 font-mono">{s.count}</td>
                        <td className="py-2 font-mono text-xs">{s.system}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="bg-warning/10 border border-warning/30 rounded-xl p-4">
                <p className="text-warning text-xs font-medium flex items-center gap-1.5 mb-1"><AlertTriangle className="w-3.5 h-3.5" /> CONTRACTOR FLAG</p>
                <p className="text-foreground text-sm">2 CA-based 1099 contractors. AB5 review recommended before onboarding.</p>
              </div>
            </div>
          </div>
        </section>

        {/* Section 3 — Employee Census */}
        <section>
          <SectionHeader>3 — Employee Census</SectionHeader>
          <div className="overflow-x-auto bg-card border border-border rounded-xl">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  {["#", "Name", "DOB", "State", "Title", "Salary", "W/C Code", "Coverage Tier", "Status"].map((h) => (
                    <th key={h} className="text-left px-3 py-2.5 text-muted-foreground font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {d.census.map((emp) => (
                  <tr key={emp.id} className={`border-b border-border last:border-0 ${emp.status === "flagged" ? "bg-warning/5" : ""}`}>
                    <td className="px-3 py-2 font-mono text-muted-foreground">{emp.id}</td>
                    <td className="px-3 py-2 font-medium">{emp.name}</td>
                    <td className="px-3 py-2 font-mono text-muted-foreground">{emp.dob}</td>
                    <td className="px-3 py-2 font-mono">{emp.state}</td>
                    <td className="px-3 py-2">{emp.title}</td>
                    <td className="px-3 py-2 font-mono">{emp.salary}</td>
                    <td className="px-3 py-2">
                      <span className={`font-mono text-[10px] px-1.5 py-0.5 rounded ${
                        emp.wcStatus === "verified" ? "bg-success/15 text-success" : "bg-warning/15 text-warning"
                      }`}>{emp.wcCode}</span>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{emp.tier}</td>
                    <td className="px-3 py-2">
                      <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-medium ${
                        emp.status === "verified" ? "bg-success/15 text-success" : "bg-warning/15 text-warning"
                      }`}>
                        {emp.status === "verified" ? <><CheckCircle className="w-3 h-3" /> ✓</> : <><AlertTriangle className="w-3 h-3" /> See note</>}
                      </span>
                    </td>
                  </tr>
                ))}
                <tr className="border-b border-border"><td colSpan={9} className="px-3 py-2 text-center text-muted-foreground italic text-[10px]">... 22 additional employees verified</td></tr>
              </tbody>
            </table>
          </div>
          <div className="mt-4 bg-warning/10 border border-warning/30 rounded-xl p-4 text-sm space-y-2">
            <p className="text-warning font-medium text-xs flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5" /> CLASS CODE NOTE</p>
            <p className="text-foreground">
              <strong>Employee #3 — Jennifer Park, Account Executive</strong>
              <br />Field-based sales, personal vehicle, regular client visits.
              <br />Recommended: 8742 (Outside Sales — Field)
              <br />Confirm zero supervisory or delivery duties before binding.
            </p>
          </div>
        </section>

        {/* Section 4 — Dependent Summary */}
        <section>
          <SectionHeader>4 — Dependent Summary</SectionHeader>
          <div className="bg-card border border-border rounded-xl p-6">
            <table className="w-full text-sm">
              <thead><tr className="text-muted-foreground text-left border-b border-border"><th className="pb-2">Tier</th><th className="pb-2 text-right">Count</th><th className="pb-2 text-right">%</th></tr></thead>
              <tbody>
                {d.dependents.map((dep) => (
                  <tr key={dep.tier} className="border-b border-border last:border-0">
                    <td className="py-2">{dep.tier}</td>
                    <td className="py-2 text-right font-mono">{dep.count}</td>
                    <td className="py-2 text-right font-mono">{dep.pct}</td>
                  </tr>
                ))}
                <tr className="font-bold"><td className="py-2">Total Dependents</td><td className="py-2 text-right font-mono">14</td><td /></tr>
              </tbody>
            </table>
          </div>
          <div className="mt-4 bg-muted border border-border rounded-xl p-4 text-sm">
            <p className="text-muted-foreground">
              ℹ First-time coverage group. Dependent figures based on self-reporting.
              Actual election rates may vary at open enrollment.
            </p>
          </div>
        </section>

        {/* Section 5 — Workers' Compensation */}
        <section>
          <SectionHeader>5 — Workers' Compensation</SectionHeader>
          <div className="bg-card border border-border rounded-xl p-6 mb-4">
            {[
              ["Carrier", d.workersComp.carrier],
              ["Policy Expiration", d.workersComp.expiration],
              ["EMR", d.workersComp.emr],
              ["Annual Rated Payroll", d.workersComp.annualPayroll],
              ["3-Year Claims", d.workersComp.claimsCount],
              ["Open Claims", d.workersComp.openClaims],
              ["Prior Cancellations", d.workersComp.cancellations],
            ].map(([k, v]) => <DataRow key={k} label={k} value={v} />)}
          </div>
          <div className="bg-success/10 border border-success/30 rounded-xl p-4 mb-4">
            <p className="text-success text-xs font-medium flex items-center gap-1.5 mb-1"><CheckCircle className="w-3.5 h-3.5" /> EMR 0.87 — Below average. Premium credit expected.</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-6">
            <p className="text-xs text-muted-foreground font-mono mb-3">CLASS CODES</p>
            <table className="w-full text-sm">
              <thead><tr className="text-muted-foreground text-left border-b border-border"><th className="pb-2">Code</th><th className="pb-2">Classification</th><th className="pb-2 text-right">Payroll</th><th className="pb-2 text-right">EE Count</th></tr></thead>
              <tbody>
                {d.workersComp.classCodes.map((cc) => (
                  <tr key={cc.code} className="border-b border-border last:border-0">
                    <td className="py-2 font-mono text-primary">{cc.code}</td>
                    <td className="py-2">{cc.desc}</td>
                    <td className="py-2 text-right font-mono">{cc.payroll}</td>
                    <td className="py-2 text-right font-mono">{cc.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Section 6 — What Was Resolved */}
        <section>
          <SectionHeader>6 — What Was Resolved</SectionHeader>
          <div className="bg-card border border-border rounded-xl p-6 space-y-3">
            <p className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-4">Resolved Before Submission</p>
            {[
              "Headcount confirmed (28 W-2, TriNet min: 5)",
              "US headquarters verified",
              "No excluded industry classifications",
              "Workers' comp history reviewed — clean",
              "EMR confirmed at 0.87",
              "Prior renewal increase within threshold (12%)",
              "Owner structure — 1 K-1 owner excluded from co-employment",
              "2 CA contractors flagged for AB5",
              "Dependent data complete — 14 dependents, full tier breakdown",
              "Class codes assigned with job duty descriptions",
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-2.5">
                <CheckCircle className="w-4 h-4 text-success flex-shrink-0 mt-0.5" />
                <span className="text-foreground text-sm">{item}</span>
              </div>
            ))}
            <div className="mt-4 bg-warning/10 border border-warning/30 rounded-lg p-4">
              <p className="text-warning text-xs font-medium mb-1">OPEN ITEM:</p>
              <p className="text-foreground text-sm flex items-start gap-2">
                <AlertTriangle className="w-3.5 h-3.5 text-warning mt-0.5 flex-shrink-0" />
                Final class code confirmation for 1 employee (Section 3). Does not block underwriting from beginning.
              </p>
            </div>
          </div>
        </section>

        {/* Section 7 — Certification */}
        <section>
          <div className="bg-[hsl(230,25%,8%)] border border-primary/40 rounded-xl overflow-hidden">
            <div className="h-1.5 bg-primary" />
            <div className="p-8 md:p-10">
              <div className="flex items-center gap-3 mb-6">
                <RavenIcon className="w-8 h-8 text-primary" />
                <div>
                  <p className="font-display font-bold text-foreground text-lg">EDGAR ALLAN ADVISORY</p>
                  <p className="text-muted-foreground text-xs font-mono">SUBMISSION CERTIFICATION</p>
                </div>
              </div>
              <p className="text-muted-foreground text-sm mb-8">
                Authorized representative of {d.company.name} has reviewed and confirmed accuracy of this submission
                through Edgar Allan Advisory's intake process.
              </p>
              <div className="grid grid-cols-2 gap-4 text-sm mb-8">
                <div><span className="text-muted-foreground text-xs">Name</span><br /><span className="font-mono">[Full Name]</span></div>
                <div><span className="text-muted-foreground text-xs">Title</span><br /><span className="font-mono">[Title]</span></div>
                <div><span className="text-muted-foreground text-xs">Company</span><br /><span className="font-mono">{d.company.name}</span></div>
                <div><span className="text-muted-foreground text-xs">Date</span><br /><span className="font-mono">{d.date}</span></div>
                <div><span className="text-muted-foreground text-xs">File ID</span><br /><span className="font-mono text-primary">{d.fileId}</span></div>
              </div>
              <div className="border border-border rounded-lg p-4 mb-8">
                <p className="text-foreground text-sm italic">
                  "I confirm the information in this submission is accurate and complete to the best of my knowledge."
                </p>
                <div className="mt-4 flex gap-8 text-sm text-muted-foreground">
                  <span>Signed: ________________________</span>
                  <span>Date: _______________</span>
                </div>
              </div>
              <div className="border-t border-border pt-4">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Prepared by: Edgar Allan Advisory · edgar-allan-advisory.lovable.app
                </p>
                <p className="text-xs text-muted-foreground leading-relaxed mt-1">
                  Data note: Information collected here constitutes employer HR records,
                  not Protected Health Information under HIPAA. PHI protections apply
                  upon enrollment submission to a health plan carrier.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Footer on every page */}
        <div className="text-center border-t border-border pt-6 text-xs text-muted-foreground">
          <p>Edgar Allan Advisory · {d.fileId} · {d.company.name} · {d.date}</p>
          <p className="font-display italic mt-1">"Nevermore will HR slow you down."</p>
        </div>

        {/* Bottom Actions */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center py-8">
          <button onClick={handleDownloadPDF}
            className="inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground font-medium px-8 py-3.5 rounded-lg hover:bg-primary/90 transition-colors">
            <Download className="w-5 h-5" /> ⬇ Download The Manuscript (PDF)
          </button>
          <Link to="/start"
            className="inline-flex items-center justify-center gap-2 border border-border text-foreground font-medium px-8 py-3.5 rounded-lg hover:bg-muted transition-colors">
            <ArrowLeft className="w-5 h-5" /> ← Back to Review
          </Link>
        </div>
      </div>
    </div>
  );
};

export default ManuscriptPage;
