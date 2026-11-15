# A submission, not a draft, gets its account, contact and opportunity

Status: accepted (founder, 2026-11-14, D-192). Amends CRM-Q1.1's "every intake belongs to one opportunity". Builds on D-101 (every intake an employer starts belongs to the default firm) and ADR 0006 (the FEIN is typed into the workspace only).

## Context

CRM-Q1.1 asks that no quote request exist without an opportunity, no opportunity without an account, and that every intake belong to one opportunity, with the database refusing anything else. An intake an agent starts through New quote (Epic 5) has its account first, so the rule holds for it from the start. An intake an employer starts does not: when it begins the business has no name yet, and the prospect may be a guest who has not verified an email.

Three moments were weighed for making the chain of an employer's intake:

1. **When the intake starts.** The rule holds for every intake, but every new draft makes a placeholder account ("New business") that is renamed later or left behind when the draft is abandoned or expires, and the duplicate match has nothing to match on.
2. **The first time the employer names the business.** Better data, but the chain then appears in the middle of a conversation with Lenore, for drafts nobody at the firm reads, and a name typed early is often corrected before certifying.
3. **When the intake is first certified and becomes a submission.** The business, its state and the prospect are certified, and this is the moment the firm starts working the intake.

## Decision

We chose 3. The database rule is: every submission, and every quote request, sits on one opportunity. An intake an employer started has no opportunity until its first certification, which makes the account (or, when the duplicate match finds one, a new account marked as a possible duplicate), the contact from the prospect and the opportunity in the same transaction as the certification. Certifying again changes nothing about the chain. An intake started by an agent belongs to its opportunity from the start.

## Consequences

- A draft an employer abandons leaves nothing in the CRM.
- "Every intake belongs to one opportunity" holds for every submission and every agent-started intake, not for an employer's uncertified draft. The SQL tests prove that a submission or a quote request cannot exist without an opportunity, and that a draft can.
- The existing submissions are brought in on the same rule (CRM-Q1.3).
