import type { ChamberData } from "./chamberTypes";

export interface PEOScore {
  name: string;
  score: number;
  label: string;
  rationale: string;
  pepmRange: string;
  strengths: string[];
}

interface ScoringFactor {
  weight: number;
  score: (data: ChamberData) => number; // 0–100
  rationale: (data: ChamberData) => string;
}

const PEO_PROFILES: Record<string, {
  factors: Record<string, ScoringFactor>;
  basePepmLow: number;
  basePepmHigh: number;
  strengths: string[];
}> = {
  TriNet: {
    strengths: ["CA-heavy groups", "Creative industries", "Virgin medical groups", "Benefits administration"],
    basePepmLow: 150,
    basePepmHigh: 220,
    factors: {
      caPresence: {
        weight: 25,
        score: (d) => {
          const caRatio = d.states.filter(s => s === "CA").length / Math.max(d.states.length, 1);
          if (d.hq_state === "CA") return 90 + caRatio * 10;
          if (d.states.includes("CA")) return 60 + caRatio * 20;
          return 30;
        },
        rationale: (d) => d.hq_state === "CA" ? "Strong CA compliance expertise" : "Capable multi-state support",
      },
      companySize: {
        weight: 20,
        score: (d) => {
          const count = d.employee_count ?? 0;
          if (count >= 5 && count <= 50) return 95;
          if (count > 50 && count <= 100) return 70;
          if (count > 100) return 40;
          return 50;
        },
        rationale: (d) => `Optimized for ${(d.employee_count ?? 0) <= 50 ? "small" : "mid-size"} groups`,
      },
      virginMedical: {
        weight: 20,
        score: (d) => d.virgin_medical === true ? 95 : 65,
        rationale: (d) => d.virgin_medical ? "Excellent at onboarding first-time coverage groups" : "Experienced with renewals and carrier transitions",
      },
      industry: {
        weight: 15,
        score: (d) => {
          const creative = /creative|design|agency|media|marketing|advertis/i;
          if (creative.test(d.industry ?? "")) return 95;
          const tech = /tech|software|saas|startup/i;
          if (tech.test(d.industry ?? "")) return 75;
          return 60;
        },
        rationale: (d) => /creative|design|agency|media|marketing/i.test(d.industry ?? "") ? "Specializes in creative agencies" : "Broad industry coverage",
      },
      benefits: {
        weight: 20,
        score: (d) => {
          let s = 70;
          if (d.has_401k) s += 10;
          if ((d.ancillary_benefits?.length ?? 0) > 2) s += 10;
          if (d.employer_contributes) s += 5;
          return Math.min(s, 100);
        },
        rationale: () => "Comprehensive benefits administration",
      },
    },
  },

  Justworks: {
    strengths: ["Transparent pricing", "Modern UX", "Simple onboarding", "Small teams"],
    basePepmLow: 59,
    basePepmHigh: 99,
    factors: {
      simplicity: {
        weight: 25,
        score: (d) => {
          const count = d.employee_count ?? 0;
          const stateCount = d.states.length;
          if (count <= 25 && stateCount <= 2) return 95;
          if (count <= 50 && stateCount <= 3) return 80;
          return 55;
        },
        rationale: (d) => (d.employee_count ?? 0) <= 25 ? "Ideal for lean teams with simple needs" : "Scales well to mid-size companies",
      },
      pricing: {
        weight: 25,
        score: (d) => {
          if ((d.employee_count ?? 0) <= 50) return 90;
          return 60;
        },
        rationale: () => "Flat, transparent per-employee pricing",
      },
      companySize: {
        weight: 20,
        score: (d) => {
          const count = d.employee_count ?? 0;
          if (count >= 2 && count <= 30) return 95;
          if (count <= 50) return 75;
          return 45;
        },
        rationale: (d) => `Strong fit for ${(d.employee_count ?? 0) <= 30 ? "small" : "growing"} teams`,
      },
      virginMedical: {
        weight: 15,
        score: (d) => d.virgin_medical ? 85 : 70,
        rationale: (d) => d.virgin_medical ? "Streamlined first-time benefits enrollment" : "Smooth carrier transition process",
      },
      techFit: {
        weight: 15,
        score: (d) => {
          if (/tech|software|saas|startup/i.test(d.industry ?? "")) return 90;
          return 65;
        },
        rationale: (d) => /tech|software|saas|startup/i.test(d.industry ?? "") ? "Popular with tech startups" : "Modern platform for any industry",
      },
    },
  },

  Rippling: {
    strengths: ["Automation", "IT + HR integration", "Multi-state payroll", "Technology companies"],
    basePepmLow: 35,
    basePepmHigh: 80,
    factors: {
      automation: {
        weight: 25,
        score: (d) => {
          let s = 70;
          if (d.uses_mobile_app) s += 10;
          if (d.uses_computer_timekeeping) s += 10;
          if (/tech|software|saas|startup|engineering/i.test(d.industry ?? "")) s += 10;
          return Math.min(s, 100);
        },
        rationale: () => "Best-in-class workflow automation",
      },
      multiState: {
        weight: 25,
        score: (d) => {
          const stateCount = d.states.length;
          if (stateCount >= 5) return 95;
          if (stateCount >= 3) return 85;
          if (stateCount >= 2) return 70;
          return 55;
        },
        rationale: (d) => d.states.length >= 3 ? "Excels at multi-state complexity" : "Handles multi-state payroll well",
      },
      companySize: {
        weight: 20,
        score: (d) => {
          const count = d.employee_count ?? 0;
          if (count >= 10 && count <= 200) return 90;
          if (count < 10) return 60;
          return 75;
        },
        rationale: () => "Scales from 10 to 2000+ employees",
      },
      techStack: {
        weight: 15,
        score: (d) => {
          if (/tech|software|saas|startup|engineering|ai/i.test(d.industry ?? "")) return 95;
          return 60;
        },
        rationale: (d) => /tech|software|saas/i.test(d.industry ?? "") ? "Built for technology companies" : "Strong platform for any industry",
      },
      contractors: {
        weight: 15,
        score: (d) => {
          if (d.has_1099 && d.ca_contractors) return 90;
          if (d.has_1099) return 80;
          return 60;
        },
        rationale: (d) => d.has_1099 ? "Handles 1099/W2 classification seamlessly" : "Clean contractor management",
      },
    },
  },

  "ADP TotalSource": {
    strengths: ["Enterprise-grade", "50+ employees", "Complex compliance", "Deep integrations"],
    basePepmLow: 100,
    basePepmHigh: 180,
    factors: {
      companySize: {
        weight: 30,
        score: (d) => {
          const count = d.employee_count ?? 0;
          if (count >= 50) return 95;
          if (count >= 25) return 75;
          if (count >= 15) return 60;
          return 35;
        },
        rationale: (d) => (d.employee_count ?? 0) >= 50 ? "Purpose-built for 50+ employee companies" : "Can serve smaller groups but not ideal",
      },
      compliance: {
        weight: 25,
        score: (d) => {
          let s = 60;
          if (d.states.length >= 3) s += 15;
          if (d.has_1099) s += 10;
          if (d.has_handbook) s += 5;
          if (d.multiple_entities) s += 10;
          return Math.min(s, 100);
        },
        rationale: () => "Industry-leading compliance infrastructure",
      },
      payroll: {
        weight: 25,
        score: (d) => {
          let s = 70;
          if (d.has_nonexempt) s += 10;
          if (d.shift_differentials) s += 10;
          if ((d.nonexempt_count ?? 0) > 10) s += 5;
          return Math.min(s, 100);
        },
        rationale: () => "Most robust payroll engine available",
      },
      multiEntity: {
        weight: 20,
        score: (d) => {
          if (d.multiple_entities && (d.fein_count ?? 0) > 1) return 95;
          if (d.multiple_entities) return 85;
          return 55;
        },
        rationale: (d) => d.multiple_entities ? "Handles multi-entity structures natively" : "Single-entity support",
      },
    },
  },

  Insperity: {
    strengths: ["Mid-market", "HR guidance", "White-glove service", "Benefits expertise"],
    basePepmLow: 120,
    basePepmHigh: 200,
    factors: {
      companySize: {
        weight: 25,
        score: (d) => {
          const count = d.employee_count ?? 0;
          if (count >= 15 && count <= 150) return 90;
          if (count >= 5 && count < 15) return 65;
          return 50;
        },
        rationale: (d) => (d.employee_count ?? 0) >= 15 ? "Sweet spot for mid-market companies" : "Can serve small groups",
      },
      hrNeeds: {
        weight: 25,
        score: (d) => {
          let s = 60;
          if ((d.hr_staff_count ?? 0) <= 1) s += 20;
          if (!d.has_handbook) s += 10;
          if (d.key_challenges && d.key_challenges.length > 10) s += 10;
          return Math.min(s, 100);
        },
        rationale: (d) => (d.hr_staff_count ?? 0) <= 1 ? "Dedicated HR business partner fills your HR gap" : "Supplements existing HR team",
      },
      benefits: {
        weight: 25,
        score: (d) => {
          let s = 65;
          if (d.has_401k) s += 10;
          if (d.employer_contributes) s += 10;
          if ((d.ancillary_benefits?.length ?? 0) > 1) s += 10;
          return Math.min(s, 100);
        },
        rationale: () => "Premium benefits packages with Fortune 500 buying power",
      },
      service: {
        weight: 25,
        score: () => 85,
        rationale: () => "White-glove service model with dedicated support team",
      },
    },
  },
};

export function scorePEOs(data: ChamberData): PEOScore[] {
  const results: PEOScore[] = [];

  for (const [name, profile] of Object.entries(PEO_PROFILES)) {
    let totalScore = 0;
    const rationales: string[] = [];

    for (const [, factor] of Object.entries(profile.factors)) {
      const factorScore = Math.min(100, Math.max(0, factor.score(data)));
      totalScore += factorScore * (factor.weight / 100);
      if (factorScore >= 70) {
        rationales.push(factor.rationale(data));
      }
    }

    const finalScore = Math.round(totalScore);

    // Adjust PEPM based on employee count and complexity
    const count = data.employee_count ?? 10;
    const sizeMultiplier = count > 50 ? 0.85 : count > 25 ? 0.95 : 1.0;
    const pepmLow = Math.round(profile.basePepmLow * sizeMultiplier);
    const pepmHigh = Math.round(profile.basePepmHigh * sizeMultiplier);

    let label = "Possible Match";
    if (finalScore >= 85) label = "🪶 Best Match";
    else if (finalScore >= 75) label = "Strong Match";
    else if (finalScore >= 65) label = "Good Match";

    results.push({
      name,
      score: finalScore,
      label,
      rationale: rationales.slice(0, 3).join(". ") + ".",
      pepmRange: `$${pepmLow}–$${pepmHigh}`,
      strengths: profile.strengths,
    });
  }

  return results.sort((a, b) => b.score - a.score);
}
