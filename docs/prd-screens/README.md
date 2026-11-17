# The workspace mockups

The 36 images here are the "Broker workspace screens", drawn with sample data. They are the look the workspace follows
(`docs/BROKER_CRM_BUILD.md`, D-7), not a specification of what each screen contains and not the built product
(`docs/BROKER_CRM_PRD.md`).

**Which source wins.** Where a mockup disagrees with `docs/BROKER_CRM_BUILD.md`, the build doc wins: it says so at its
top ("Where this page and a story disagree, this page wins"), and its decisions are what the app is built and tested
against. Where a mockup disagrees with a story and the build doc is silent, the story wins. A mockup's sample figures
(names, counts, dollar amounts) are never a requirement, and two mockups of the same sample search need not agree with
each other.

The images are not regenerated when a decision changes. A difference between a mockup and the decisions is recorded
below instead, so nobody builds to the picture by mistake. Add a row here when a new one is found.

## Known differences

| Screen | What the mockup shows | What is true | Source |
|---|---|---|---|
| `19-opportunity.png` and `13-compare.png` | The same sample search (Harborview Dental Group, January 2027) with PEO B in two states: on 19 "Sent, 6 days" with the 2024 loss run still needed, on 13 **Quoted** at $118 per employee per month with a $1,500 setup fee ("2 of 3 quotes are back") | Sample data that was never made consistent. Neither screen is the truth: what a screen shows follows the quote request's status in the database. Build a screen from its own story, not from the other screen's figures | `BROKER_CRM_STORIES.md` CRM-O1.1, CRM-Q4.2 |
| `19-opportunity.png`, `01-main.png` | A stage bar (and Home's "Open opportunities by stage" cards) with no **Ready to send** | The stages are Qualifying, Intake under way, **Ready to send**, In market, Quoted, then Won or, for a lost one, Lost: six slots on the page's bar | D-415; `BROKER_CRM_STORIES.md` CRM-O1.2 |
| `26-won-lost.png` | "Expected commission, a year" as a free amount ($7,650) | The dialog takes a **Commission basis** (a share of the admin fee, dollars per employee per month, or a flat yearly amount) with its number, works out the yearly figure and shows the arithmetic, and lets the person overwrite the figure. Commission is optional | D-466 (CRM-O1.3a); `BROKER_CRM_STORIES.md` CRM-O1.3 says only "the expected commission", which D-466 refines |
| `19-opportunity.png` | An **Intake** kind in the opportunity's Activity ("Started by Dana from the account's details; Elena invited") | Built (joshrkay/Nevermore#237, D-1902): Intake rows for a member starting the intake, the client being invited and reminded, and each certification. The mockup's "from the account's details" is not drawn: the database records who started the intake, not from what | `BROKER_CRM_BUILD.md` D-1902 |
| `01-main.png`, `14-leads.png` | Tables cut off at the right edge ("40 mir", "In 4 da", "Yester"; "Dana Reye"), and a blank strip down the right of `14-leads.png` | The images themselves are cut off: in `01-main.png` the panel is narrower than its table, and `14-leads.png` has a blank strip down its right edge. Nothing in a story asks for a table to be clipped, so treat it as a fault of the capture, not a requirement. Whether the built tables clip at narrow widths was not checked here | joshrkay/Nevermore#238 |
