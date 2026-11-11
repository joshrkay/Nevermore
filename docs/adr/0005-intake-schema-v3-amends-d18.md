# Intake schema v3 amends D18; D21 stands

D18 (2026-11-03) gave workers' comp four flat fields and said "no locations structure: locations stay derived from `hq_state`, `states` and the census rows' `work_state` and `zip_code`". Epic K's research (what PEOs and their carriers ask on their own forms) showed that underwriters need more than that, so intake schema v3 goes past D18 in three places:

- Workers' comp gains two tables beside the four fields: the owners and officers, and five policy years of loss history. Payroll by class code and state is worked out from the census and stored nowhere.
- The employer gains a street address, and each employee a worksite, a home state, and whether they work remotely or travel. There is still no list of locations: a worksite is a name on a census row, not a record of its own.
- Benefits and payroll gain a table each: the current medical plans and the unemployment tax rate per state.

D21 is unchanged: the census still comes only from an uploaded file, the Census tab stays read-only, and named dependents are still not captured (K-2.3 is not built). Every v3 answer is optional, so a v2 intake opens and certifies unchanged, and each group of answers arrived in its own migration after `20261111090000`.
