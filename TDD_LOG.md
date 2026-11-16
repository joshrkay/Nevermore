# TDD log: slice 6.7, M-2.2 (send to several PEOs at once, #201)

The `tdd` skill was the lane's first tool call. Seams (D-13, agreed): (2) component tests of the form and the submission page. No SQL changed:
each PEO's send is 6.6's `send_to_peo` / `attach_peo_link` unchanged, called once per PEO.

One test, seen red, then only its code, seen green.

1. `SendToSeveralPeos` "ticks each ready PEO and leaves one that isn't ready unticked, saying what it is missing": red `Failed to resolve import "./SendToSeveralPeos"`; green.
2. `SendToSeveralPeos` "sends each chosen PEO its own message, to its own people only, with its own greeting over the one note": red `Unable to find a label with the text of: Your note`; green.
3. `SendToSeveralPeos` "issues each PEO its own link from its own plan, for its own quote request, so a PEO that isn't ready is sent its open items": red `promise rejected "Error: Not yet" instead of resolving`; green (the link issuer shared with 6.6's card as `src/lib/peoLinkIssuer.ts`).
4. `SendToSeveralPeos` "reviews each chosen PEO before anything goes: its recipients, its greeting, its files and its gaps": red `Unable to find role="article"`; green.
5. `SendToSeveralPeos` "stops a PEO the employer hasn't authorized, sends the rest, and says sent or not sent for each, with the reason": red `expect(element).toHaveTextContent()` (no "Won't be sent" on TriNet); green.
6. `SendToSeveralPeos` "stops a PEO whose profile has no contact address, sends the rest, and says why": red `expect(element).toHaveTextContent()` (no "Won't be sent" on Oasis); green.
7. `SendToSeveralPeos` "keeps sending after one PEO's send is refused, and gives that PEO the refusal's own words": red `Unable to find role="list" and name "What was sent"` (the refusal ended the run); green.
8. `SendToSeveralPeos` "with no mailbox, sends nothing to any PEO and offers to connect one": red `Unable to find role="dialog"`; green (6.1's `useFirstSend` and `MailboxForWriting`).
9. `AdvisorSubmissionPage` "offers to send several PEOs at once, each listed PEO with a profile, the ready ones ticked": red `Unable to find an accessible element with the role "button" and name "Send to several PEOs"`; green (in What each PEO still needs).
10. `SendToSeveralPeos` "stops a PEO whose contacts couldn't be loaded, says so, and sends the rest": red `expect(element).toHaveTextContent()` (no "Won't be sent" on Oasis); green.
11. `SendToSeveralPeos` "closes, and opens again at the choosing step with each PEO's contacts read afresh": red `Unable to find an accessible element with the role "button" and name "Close"`; green.

## Mutations (after the cycles)

Each rule of `SendToSeveralPeos.tsx` broken in turn, its test file run (`scratchpad/mutate.py`): 13 mutations. Two survived the first run and each
got a test, then all 13 went red:

- every PEO ticked by default: killed. Eligibility checks left out of "ready": **survived** (TriNet was not ready for its missing items anyway);
  test 12 "leaves a PEO unticked that has everything it needs to quote but fails an eligibility check" added, now killed.
- every PEO's contacts on each send; no greeting; authorization not checked; no-contact not stopped; a refusal ending the run; the mailbox check
  skipped; one PEO's plan for every link; failed contacts not stopped; open items hidden in the review; onSent never called: each killed.
- Close keeping the last opening's reads: **survived**; test 13 "forgets the last opening's reads when closed" added, now killed.
- On the page: `SendToSeveralPeos` out of What each PEO still needs makes cycle 9's page test red (it was red before the code).

12. (mutation gap) "leaves a PEO unticked that has everything it needs to quote but fails an eligibility check": written after the mutation, which it kills.
13. (mutation gap) "forgets the last opening's reads when closed": written after the mutation, which it kills.
