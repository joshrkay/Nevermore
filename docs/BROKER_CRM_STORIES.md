# The broker's CRM: user stories

| | |
|---|---|
| **Date** | 2026-11-13 |
| **What this is** | The stories and acceptance criteria for the broker's workspace: leads, accounts, contacts, opportunities, quotes, email, reports and settings, with every page's states and every table's behaviour |
| **Status** | For the founder to challenge. Nothing here is built or decided |
| **Design** | `docs/research/2026-11-12-broker-workspace.md`. Screens: the "Broker workspace screens" canvas; screen numbers below are that canvas's |
| **Builds on** | `docs/QUOTING_PLATFORM_STORIES.md`: Epic P (firms), Epic M (sending), Epic N (what comes back), Epic Q (tracking brokers). A story here that needs one of those says so |

**How to read a story.** `ID Title. Size · Who · needs`. Size is S (days) or M (a week or two), for comparing
stories, not for dates. Who is FE, BE or FS (both). AC is the acceptance criteria: each line can be tested.

**Words.** Existing terms mean what `GLOSSARY.md` says. In screens and in this document a **quote** is the
glossary's **quote request** (one PEO's handling of one opportunity) together with the **quote** that PEO
returns. An **agent** is a member of a firm (the stories' **broker**). The five records are lead, account,
contact, opportunity and quote. These need glossary entries before any code (QP-D3).

---

## 1. Rules that hold on every page

### CRM-S1 The shell

**CRM-S1.1 The menu.** S · FE · needs P-1.4
As an agent, I want the same menu on every page so I always know where I am.
- AC: the menu down the left holds, in order: New quote, Home, Quotes, Inbox, Leads, Accounts, Reports; Settings and the signed-in person sit at the bottom.
- AC: the firm's name and firm address show at the top. The current section is marked, including on a record opened from it (an opportunity marks Accounts).
- AC: Quotes, Inbox and Leads each show a count: open quotes, unread mail, open leads. A count refreshes on focus and every 60 seconds.
- AC: at phone width the menu collapses to a button that opens it over the page; every item stays reachable.
- AC: every page has its own title and address, so the browser's back button and a copied link both work.

**CRM-S1.2 Search everywhere.** M · FS · needs CRM-S5.1
As an agent, I want one search box that finds any record.
- AC: a search in the menu matches leads, accounts, contacts, opportunities and quotes by name, business, email, phone, web domain, File ID and PEO.
- AC: results are grouped by kind, at most five per kind with "see all", and show only records the person may see.
- AC: it never matches on an intake's answers, a census, or an email's body.
- AC: nothing typed: the last five records the person opened. No match: "Nothing matches" and a way to create a lead or an account with that name.

### CRM-S2 Page states (screens 32 to 34)

Every page and every panel on a page has these states. A page's own section below says only what differs.

**CRM-S2.1 Loading.** S · FE
- AC: the page's frame (menu, title, tabs, toolbar, column headers) shows at once; only the data area shows placeholders.
- AC: a table shows eight grey rows shaped like its columns; a record shows grey lines where each field and list will be. Nothing jumps when the data arrives.
- AC: placeholders are announced to a screen reader once as "Loading accounts" (or the page's name), not row by row.
- AC: after ten seconds a line under the title says "This is taking longer than usual" with a "Try again" button. Controls that need the data are disabled until it arrives; the menu and New quote are not.

**CRM-S2.2 Empty.** S · FE
- AC: there are two kinds, never confused. **Nothing yet**: the firm or person has no records of this kind. **Nothing matches**: records exist but the filters, view or search exclude them all.
- AC: nothing yet shows one sentence saying what belongs here and one primary action that creates the first one; where import applies, a second action to import.
- AC: nothing matches keeps the toolbar and column headers, says "No accounts match these filters" (or the page's noun), names the filters in force and offers "Clear filters". It never offers to create a record.
- AC: an empty list inside a record (no contacts on an account) is one line with its add action, and keeps its heading and count of zero.

**CRM-S2.3 Something went wrong.** S · FE
- AC: a failed load shows, in the data area, what couldn't be loaded and a "Try again" button. Filters, sort and the view are kept.
- AC: when one panel of a record fails, the others still show; the failed one says so and retries on its own button.
- AC: a failed save keeps what the person typed, says what failed in plain words next to the form's buttons, and never closes the form.
- AC: a record that no longer exists or that the person may not see reads "This account isn't available" with a link back to the list. It says the same in both cases.

**CRM-S2.4 Out of date.** S · FE
- AC: lists refresh on focus and every 60 seconds, as the queue does today (D44), without moving the scroll position or clearing a selection.
- AC: if someone else changed a record while a person was editing it, saving says so, shows their change beside the person's, and lets them keep either. Nothing is overwritten silently.
- AC: with no connection, a banner says so; pages already loaded stay readable; saving is disabled with the reason.

### CRM-S3 Tables

These hold for the Leads, Accounts and Quotes tables, the Inbox, and every list inside a record.

**CRM-S3.1 Columns.** S · FE
- AC: each table has default columns (listed with the table). "Columns" lets a person show, hide and reorder them, including the firm's custom fields.
- AC: the first column (the record's name) can't be hidden and stays in view when the table scrolls sideways.
- AC: the choice is kept per person per table and per saved view.

**CRM-S3.2 Sort.** S · FS
- AC: clicking a column header sorts by it; clicking again reverses; the header shows the direction. One column at a time.
- AC: every column sorts except those marked "no sort" with the table. Text sorts ignoring case; empty values sort last in both directions; dates sort by date, not by their text.
- AC: each table has a default sort (listed with the table). The sort is kept with the saved view and is part of the page's address.

**CRM-S3.3 Filter.** M · FS
- AC: filters sit in a row above the table. Each table lists its filters; "Add filter" offers every other field, custom fields included.
- AC: by kind of field: text (contains, is, is empty), number (is, more than, less than, between), date (on, before, after, between, in the next or last N days), one choice and several choices (is any of, is none of, is empty), yes or no, person (is any of, "me", "my team").
- AC: filters combine with "and". Each shows as a chip with its value and can be removed; "Clear filters" removes all.
- AC: the count above the table is of what matches. Filters are part of the page's address, so a filtered table can be bookmarked and sent to a colleague, who sees the same filters over their own visibility.

**CRM-S3.4 Saved views.** S · FS
- AC: tabs across the top of a table are views: a name, filters, sort and columns. Each table ships with the views listed with it.
- AC: a person can save the current filters as their own view, rename it and delete it. An owner can share a view with the firm. Built-in views can't be deleted.
- AC: each view's tab shows its count.

**CRM-S3.5 Pages.** S · FS
- AC: 50 rows a page, with "1 to 50 of 375", Previous and Next. Changing a filter or the sort goes back to the first page.

**CRM-S3.6 Selecting rows.** S · FE
- AC: each row has a checkbox; the header's checkbox selects the page. With the whole page selected, a line offers "Select all 375 that match".
- AC: with any row selected, a bar replaces the toolbar: how many are selected, the table's bulk actions, and "Clear".
- AC: the selection survives sorting and a refresh, and is cleared by changing a filter or the view.

**CRM-S3.7 Bulk edit.** M · FS (screens 35, 36) · needs CRM-S3.6
As an agent, I want to change many records at once.
- AC: each table lists its bulk actions. The ones every table has: change owner, set a field, add or remove a label, export the selection.
- AC: "Set a field" offers any optional standard or custom field of that record. It never offers the name, a required field, or a field the product works out (stage, status, renewal, last activity).
- AC: before anything changes, a dialog says exactly what will happen: "Change owner to Marcus Hale on 42 accounts". Rows the person may not change are counted and named as skipped, with the reason.
- AC: nothing is half done: the change applies to every allowed row or to none.
- AC: afterwards a message says what changed with "Undo", which puts every row back as it was, for ten minutes or until the person leaves the page.
- AC: every bulk change is one entry in each record's history: who, when, what from and what to.
- AC: the most rows one bulk action takes is 1,000. Over that, the dialog says so and asks the person to narrow the selection.
- AC: an agent can bulk-change only records they own; a lead, their team's; an owner, the firm's.

**CRM-S3.8 Export.** S · FS
- AC: "Export" downloads a CSV of the rows that match the filters (or the selection), with the columns showing, custom fields included, in the order shown.
- AC: it holds only records the person may see, and never an intake's answers, a census or a FEIN.
- AC: each export is recorded: who, when, which table, how many rows.

### CRM-S4 Forms

**CRM-S4.1 Creating and editing.** S · FE
- AC: required fields are marked "Required" in words. The rules: every record needs a name; a contact also needs an email or a phone number; an opportunity needs its account. Everything else is optional.
- AC: an error is shown under its field, in words, when the person leaves the field or presses save; the first field in error takes the focus. Save is never disabled to signal an error.
- AC: an email must look like one; a phone keeps what was typed and is shown in one format; a state is one of the fifty and DC; a date is picked or typed.
- AC: closing a form with unsaved changes asks first.
- AC: a record's page edits in place: "Edit" turns the details into fields, "Save" and "Cancel" turn them back.

**CRM-S4.2 Spotting a duplicate.** S · FS
- AC: while creating a lead or an account, a match on web domain, on name and state, or on a contact's email shows a warning naming the record and its owner, with a link. The person can still save.
- AC: a match the person may not see says only that one exists and who to ask.

**CRM-S4.3 Merging.** M · FS
- AC: two accounts, two contacts or two leads can be merged. The person picks which value to keep for each field that differs.
- AC: everything attached to the one removed moves to the one kept: contacts, opportunities, quotes, emails, notes, tasks, files and history. Nothing is lost and the merge is recorded on the kept record.
- AC: two accounts that each hold an intake can be merged; both intakes stay, each on its own opportunity.

### CRM-S5 Who sees what

**CRM-S5.1 Visibility by level.** M · BE · needs P-1.1
- AC: an agent sees the leads, accounts, opportunities, quotes and email they own; a team lead, their team's and everything under it; an owner, the firm's. A firm can switch this to "everyone sees everything".
- AC: a contact, an opportunity and a quote are seen by whoever may see their account.
- AC: the database enforces it on every table and function. The SQL isolation tests hold a second firm, and a second agent in the first, that can read nothing they shouldn't.
- AC: changing a record's owner changes who sees it at once.

**CRM-S5.2 The history of a record.** S · BE
- AC: every record keeps who created it and when, and every change: who, when, the field, from and to. The history can't be edited.
- AC: the history holds the firm's own fields only. An intake's answers keep their own history as today.

---

## 2. Home (screen 1)

**CRM-H1 What needs me.** M · FS · needs CRM-S5.1
As an agent, I want to open the product and see what to do.
- AC: "Needs you" lists, newest first: new mail from a PEO or a contact, an intake certified, a quote expiring within seven days, an intake with nothing new for ten days, a task due today or overdue, a lead with no activity for seven days.
- AC: each line names the kind, the account, what it is about with a link to that record, when, and the owner. Opening the record clears a "new mail" line for everyone who can see it, as threads do today.
- AC: "Mine" and "My team" (a lead) or "Everyone" (an owner) switch whose work is shown; an agent sees only "Mine".
- AC: five counts across the top each open the list they count: open leads, open opportunities, quotes waiting on a PEO, renewals in the next 120 days, won this quarter.
- AC: "Renewals coming up" lists the next 120 days, soonest first; "Open opportunities by stage" counts each stage and opens the Accounts table filtered to it.

| State | When | What shows |
|---|---|---|
| Loading | First load | The five count boxes and the three panels' headings, each with grey lines |
| Nothing yet | A new firm with no records | "Start with a quote or bring in your book", with New quote and Import as buttons, and the three steps to a first quote |
| Nothing needs you | Records exist, nothing is due | "You're caught up" in the Needs you panel; the counts and other panels as usual |
| One panel failed | A panel's data didn't load | That panel says so with "Try again"; the rest show |

---

## 3. Leads (screens 14, 15, 21, 22)

### The table

| | |
|---|---|
| **Default columns** | Lead (name and title), Business (with city, state, employees), Email and phone, Status, Source, Last activity, Owner |
| **Other columns** | Created, State, Employees, Current provider, Label, every custom field on leads |
| **Default sort** | Last activity, newest first. No sort: Email and phone |
| **Views** | Open (new and working), New, Working, Converted, Not a fit |
| **Filters shown** | Owner, Source. Add filter: status, state, employees, created, last activity, label, custom fields |
| **Search** | Name, business, email, phone |
| **Row action** | Convert |
| **Bulk actions** | Change owner, change status (new or working), mark not a fit (one reason for all), set a field, add or remove a label, delete, export |

**CRM-L1.1 The leads table.** M · FS · needs CRM-S3.x, CRM-S5.1
- AC: the table behaves as section 1 says, with the columns, views, filters and actions above.
- AC: "Converted" and "Not a fit" leads can be read but not changed, except that a "Not a fit" lead can be reopened.
- AC: bulk delete asks for confirmation naming the count, and moves leads to a bin an owner can restore from for 30 days. A converted lead can't be deleted.

| State | When | What shows |
|---|---|---|
| Loading | | Headings, views and eight grey rows |
| Nothing yet | The firm has no leads | "Leads are people you aren't quoting yet", with New lead and Import |
| Nothing matches | Filters exclude all | "No leads match these filters", the filters named, Clear filters |
| Rows selected | One or more ticked | The bulk bar in place of the toolbar |

**CRM-L1.2 Create a lead.** S · FS (screen 21)
- AC: the form holds name (required: the person's, or the business's when no person is known), title, business, email, phone, state, employees, current PEO or payroll provider, source, owner, a note, and the firm's custom fields.
- AC: the owner defaults to the person creating it; the source to "Added by hand".
- AC: "Save and add another" saves and clears the form, keeping owner and source.
- AC: a lead also arrives from an import (CRM-X4), a linked CRM, a referral partner's link, and the firm's public link when the visitor asks for contact and starts no intake. Each records its source.

**CRM-L1.3 Lead statuses.** S · BE
- AC: a lead is New, Working, Converted or Not a fit. A new lead is New; it becomes Working the first time an agent emails it, logs a call or changes it, or when an agent sets it.
- AC: "Not a fit" needs a reason from a short list (too small, wrong industry, not interested, bad contact details, other) and keeps the lead and its history.
- AC: Converted is set only by converting. Every status change is in the history.

### The lead's page (screen 15)

**CRM-L2.1 A lead's page.** M · FS
- AC: the header shows the name, status, business, location, employees, source and owner, with Email, Log a call, Not a fit and Convert.
- AC: a status bar shows New, Working, Converted with the date each began.
- AC: the page shows the details (standard then custom fields), the emails with a place to write one, and the calls, notes and tasks, newest first.
- AC: a "Converting makes" panel names the account, contact and opportunity it would create.

| State | When | What shows |
|---|---|---|
| Loading | | Header and panel headings with grey lines |
| No emails | None sent or received | "No emails yet" and the place to write one |
| No mailbox | The agent hasn't connected one | The place to write is replaced by "Connect your email to write from here" with the connect button |
| No activity | No calls, notes or tasks | "Nothing logged yet" with Add a note and Add a task |
| Converted | The lead was converted | A banner linking to the account, contact and opportunity; the page is read-only |
| Not a fit | | A banner with the reason and "Reopen" |

**CRM-L2.2 Convert a lead.** M · FS (screen 22)
As an agent, I want a lead I'm now quoting to become an account.
- AC: converting offers "Create account" with the lead's business, or "Use an existing account" with any possible matches listed first.
- AC: it creates or reuses the account, creates a contact from the lead's person (name required, and an email or a phone), and, unless unticked, an opportunity with a name and target start the agent can change.
- AC: a lead with a business and no person converts to an account with no contact, and says so.
- AC: the lead's emails, calls, notes, tasks and custom-field values move to the account and contact; values go to the same-named field where the account or contact has one.
- AC: it is one step: all of it happens or none. The lead becomes Converted and links to what it made.
- AC: "Convert and start a quote" does the same and opens New quote at the intake (CRM-Q2.2).

---

## 4. Accounts and contacts (screens 16, 17, 18, 23, 24)

### The accounts table

| | |
|---|---|
| **Default columns** | Account (with city and state, and a Client mark), Main contact (with email or phone), Opportunity (stage and target start of the open one), Quotes (back of sent, and the nearest expiry), Renewal, Employees, Owner, Last activity |
| **Other columns** | Status, Website, Industry, States of operation, Current provider, Source, Created, Label, every custom field on accounts |
| **Default sort** | Last activity, newest first. No sort: Main contact |
| **Views** | All accounts, Open opportunities, Waiting on quotes, Renewing in 120 days, Clients |
| **Filters shown** | Owner, State, Employees. Add filter: status, opportunity stage, renewal date, industry, source, last activity, label, custom fields |
| **Search** | Account name, trade name, web domain, a contact's name or email |
| **Bulk actions** | Change owner, set a field, add or remove a label, merge (exactly two), archive, export |

**CRM-A1.1 The accounts table.** M · FS · needs CRM-S3.x, CRM-S5.1
- AC: the table behaves as section 1 says, with the columns, views, filters and actions above.
- AC: the Opportunity and Quotes columns are for the account's open opportunity; with more than one open, the one with the nearest target start, and "+1 more".
- AC: an account can be archived, never deleted, when it holds an intake; an archived account leaves every view but "Archived" and can be restored. An account with no intake, quote or email can be deleted by its owner.
- AC: changing an account's owner offers to change the owner of its open opportunities too.

| State | When | What shows |
|---|---|---|
| Loading | | Headings, views and eight grey rows |
| Nothing yet | The firm has no accounts | "Accounts are the businesses you quote for", with New quote, New account and Import |
| Nothing matches | Filters exclude all | "No accounts match these filters", the filters named, Clear filters |
| Rows selected | | The bulk bar in place of the toolbar |

**CRM-A1.2 Create an account.** S · FS (screen 23)
- AC: the form holds account name (required), trade name, website, phone, address, industry, employees, states of operation, current PEO or payroll provider, renewal date, owner and the firm's custom fields.
- AC: "Save and add a contact" saves and opens the contact form on the new account.
- AC: an account is also created by converting a lead (CRM-L2.2), by an import (CRM-X4) and by a quote (CRM-Q1.1).

**CRM-A1.3 What an account's status is.** S · BE
- AC: an account is a Prospect until an opportunity on it is won; then a Client while a placement is current; a Former client when none is. Nobody sets it.

### The account's page (screen 17)

**CRM-A2.1 An account's page.** M · FS
As an agent, I want everything about a business in one place.
- AC: the header shows the name, status, industry, location, employees, website and owner, with Email, Log a call, Add a task and New opportunity.
- AC: tabs: Overview, Contacts, Opportunities, Quotes, Renewals, Activity, Files, each with its count.
- AC: Overview shows the details down one side (standard fields, then the firm's) and, beside them, each list's first five rows with "see all": contacts, opportunities, quotes, renewals, recent activity.
- AC: every name in a list opens that record: a contact, an opportunity, a quote.
- AC: Files lists what was uploaded to the account by the firm and, from its intakes, only files that have passed the virus check; a file's own access rule still holds.

| State | When | What shows |
|---|---|---|
| Loading | | Header, tabs and each list's heading with grey rows |
| A new account | No contacts, opportunities or quotes | Each list is one line with its add action: "No contacts yet. Add a contact", "No opportunities yet. New opportunity or New quote" |
| No quotes | Opportunities exist, none sent | "No quotes yet. Quotes appear when an opportunity is sent to a PEO" |
| No renewals | | "No renewal on file. Add a renewal" |
| A list failed | | That list says so with Try again |
| Archived | | A banner with Restore; nothing can be added |

**CRM-A2.2 Add a contact to an account.** S · FS (screen 24)
- AC: "Add contact" on an account opens the form with the account filled in. First name, last name (required), title, email, phone, mobile, owner, "Main contact", "Do not email", custom fields. An email or a phone is required.
- AC: an account has at most one main contact; ticking it on one unticks the other, and says so.
- AC: a contact whose email is already on another contact shows the duplicate warning (CRM-S4.2).
- AC: a contact can be moved to another account by its owner; its emails and history go with it.

**CRM-A2.3 Add an opportunity to an account.** S · FS (screen 25)
- AC: "New opportunity" on an account opens the form with the account filled in: name (offered as the start month and "PEO search"), target start, employees in this search, main contact (from the account's), expected close, value, source, stage, owner, next step.
- AC: an account can hold any number of opportunities, and more than one open at once.
- AC: "Start from last year's certified answers" is offered when an earlier opportunity on the account holds a certified intake; it starts the new intake with those answers, all to be certified again.
- AC: "Save and start the quote" saves and opens New quote at the intake.

**CRM-A2.4 Renewals on an account.** S · FS
- AC: a renewal is what renews (a PEO placement, or the employer's current plan), with whom, and the date. One is created from a won opportunity's placement; others are added by hand.
- AC: a renewal shows how many days away it is and which opportunity, if any, is working it; "Start the renewal" creates that opportunity (CRM-A2.3).
- AC: a renewal within 120 days shows on Home and in the "Renewing in 120 days" view.

### The contact's page (screen 18)

**CRM-C1.1 A contact's page.** M · FS
- AC: the header shows the name, whether they are the main contact, title, account (linked), email and phone, with Email, Log a call and Add a task.
- AC: the page shows the details, the opportunities they are on, the emails with them (newest first, with a place to write), and calls, notes and tasks.
- AC: "Do not email" hides the place to write and says why.

| State | When | What shows |
|---|---|---|
| Loading | | Header and panel headings with grey lines |
| No email address | The contact has only a phone | "No email address on file. Add one to write from here" |
| No emails | | "No emails yet" and the place to write |
| No mailbox | | "Connect your email to write from here" |
| No opportunities | | "Not on an opportunity yet" |

---

## 5. Opportunities (screens 19, 26)

**CRM-O1.1 An opportunity's page.** M · FS
- AC: a trail leads back: Accounts / the account / the opportunity.
- AC: the header shows the name, stage, target start, employees, main contact and owner, with Email the contact, Mark won or lost, and Send to a PEO.
- AC: a stage bar shows every stage and marks the current one.
- AC: the page shows its quotes (one row per PEO: status, sent, admin fee, expires, what it still needs, emails), its intake (File ID, certified by and when, version, census size, open items, PEOs authorized), its activity, its details and its contacts.
- AC: "Compare" opens the comparison of its quotes (N-3.1).

| State | When | What shows |
|---|---|---|
| Loading | | Header, stage bar and panel headings with grey rows |
| No intake | Qualifying | The intake panel reads "No intake yet" with "Start the quote"; the quotes panel reads "Quotes appear once the intake is certified and sent" |
| Intake under way | Not certified | The intake panel shows who is filling it in, how many answers, and "Remind" |
| Certified, nothing sent | | The quotes panel reads "Ready to send" with "Choose PEOs" |
| Won or lost | | A banner with the outcome, the quote taken or the reason, and "Reopen" |

**CRM-O1.2 What an opportunity's stage is.** M · BE
- AC: the stages are Qualifying, Intake under way, Ready to send, In market, Quoted, Won, Lost.
- AC: an agent sets the stage only while there is no intake (Qualifying), and Won or Lost at the end. In between it follows the intake's **pipeline stage**:

| Pipeline stage today | Opportunity stage |
|---|---|
| No intake | Qualifying |
| Draft, submitted, under review, information requested | Intake under way |
| Ready for market | Ready to send |
| Sent to PEOs | In market |
| Quoted | Quoted |
| Won | Won |
| Lost, archived | Lost |

- AC: the page says, under the stage, what would move it on: "Waiting for Lucia to certify", "Send to a PEO to move to In market".
- AC: every stage change is in the opportunity's history with who or what caused it.

**CRM-O1.3 Mark won or lost.** S · FS (screen 26) · needs Q-4.1
- AC: Won asks which quote the employer took (only quoted ones are offered), the start date, the renewal date, the broker of record and the expected commission.
- AC: marking it won marks that quote chosen, closes the opportunity's other open quotes with the reason "the employer went elsewhere", makes the account a Client, and adds a renewal to the account. The dialog says each of these before it happens.
- AC: Lost asks for a reason from a short list (stayed with current provider, price, went direct, no decision, other) and closes every open quote.
- AC: either can be reopened by the owner; reopening undoes the account's status and the renewal, and leaves closed quotes closed.

---

## 6. Quotes (screens 2, 4 to 13)

### One chain, always

**CRM-Q1.1 A quote always has an account, a contact and an opportunity.** M · BE · needs P-1.1
As an agent, I want anything that is quoted to be in the CRM without my filing it.
- AC: no quote exists without an opportunity, no opportunity without an account, and every intake belongs to one opportunity. The database refuses anything else.
- AC: whichever way a quote starts, the chain is made in the same step:
  - **New quote** (CRM-Q2.1): the agent picks or creates the account and its contact; the opportunity is created with it.
  - **The firm's link**: an employer who starts an intake from a firm's link gets an account from the business they name, a contact from themselves, and an opportunity, owned by the agent whose link it was.
  - **From a lead**: converting creates all three (CRM-L2.2).
  - **A quote recorded by hand** on an opportunity: the chain already exists.
- AC: before creating an account the product looks for one, by web domain, by name and state, or by the contact's email. One clear match that the agent may see is offered first; the agent chooses. Nothing is merged by guesswork.
- AC: when an employer starts from the firm's link and a match exists, the intake is held on a new account marked "Possible duplicate of …" for the agent to merge or keep (CRM-S4.3). The employer is never asked.
- AC: the same step run twice makes one chain, not two.

**CRM-Q1.2 What the intake learns goes back to the account.** S · BE
- AC: on each certification, the account's empty fields are filled from the certified answers: legal name, address, states of operation, employees, industry, current provider. The person who certified becomes a contact if they aren't one.
- AC: where the account already holds a different value, the account is not changed; the difference is shown on the account as "The intake says 23" with "Use it".
- AC: the FEIN, the census and anything about an employee never leave the intake (`docs/adr/0006`).

**CRM-Q1.3 Bring the existing submissions in.** S · BE · needs P-1.1
- AC: every submission that exists when this ships gets an account, a contact from its prospect, an opportunity and its quote requests as quotes, in the firm Edgar Allan Advisory, owned by nobody until assigned.
- AC: the migration can be run twice without making a second copy, and reports how many of each it made.

### New quote

**CRM-Q2.1 Step 1, the account.** S · FS (screen 4)
- AC: New quote is in the menu on every page and opens the flow over the page the agent was on; "Save and close" returns there.
- AC: the agent types a business name and sees accounts that could be it. They pick one, or keep "New account" and enter its name (required), state and employees, and a contact: name (required) and an email or a phone.
- AC: picking an existing account offers its contacts and its open opportunity, if it has one, to continue.
- AC: started from an account, an opportunity or a converted lead, step 1 is already done and the flow opens at step 2.
- AC: the steps across the top show what is done, where the agent is and what is left; a done step can be reopened.

**CRM-Q2.2 Step 2, the intake with Lenore.** M · FS (screen 5) · needs P-2.2, P-2.4
- AC: the step is the intake as it is built: Lenore's conversation and voice on one side, the ten tabs on the other.
- AC: what the account holds is written in as the agent's entry before the agent types anything.
- AC: the agent can tell Lenore what they know, paste it, upload the census and documents, and type on any tab but FEIN and Certify & sign. Each answer is recorded as the agent's, never as the employer's confirmed answer.
- AC: "Invite the contact to finish and certify" emails the contact a link to the firm's address. "The contact does it all" sends the same link with nothing entered.
- AC: the step shows how many answers are in, who entered them, and what is still needed before it can be certified.

**CRM-Q2.3 What the employer sees.** M · FS (screen 6) · needs P-2.1, M-1.1
- AC: the employer opens the firm's address, sees the firm's name and who invited them, and that the firm can see their answers.
- AC: every answer the agent entered is marked "Your broker entered this" and can be changed.
- AC: on Certify & sign the employer signs the certification and names, by ticking, each PEO their packet may go to. The wording of both is counsel's.
- AC: only the employer can certify; the database refuses a certification from a member of a firm.

**CRM-Q2.4 Step 3, certified.** S · FS (screen 7)
- AC: until the employer certifies, the step reads "Waiting for Lucia to certify" with when she was invited, when she last opened it, and "Remind".
- AC: once certified it shows who certified, when, the version, the File ID and the open items; what the employer changed from the agent's entries; which PEOs they authorized; and the packet, the census, the workers' compensation application data and the answers as JSON to download.
- AC: a later certification shows as a new version and says which quotes were sent on the older one.

**CRM-Q2.5 Step 4, choose PEOs.** S · FS (screen 8) · needs Epic L
- AC: each listed PEO shows whether the employer fits it (fits, doesn't, can't tell yet, with the reason), what it still needs, whether the employer authorized it, and the firm's contact there.
- AC: a PEO the employer hasn't authorized can't be ticked; "Ask" sends the employer an information request to add it.
- AC: a PEO that fails a fit check can still be ticked, with the warning shown.

**CRM-Q2.6 Step 5, review and send.** M · FS (screens 9, 10) · needs M-2.1, M-4.x
- AC: one email per PEO, each shown before sending: from the agent's own address, to that PEO's contact, a subject and message the agent can edit, and that PEO's files in its own layout.
- AC: the first time an agent sends, they are asked to connect Google or Microsoft, send only, or to skip and send from their own mail with the quote's reply address in CC.
- AC: sending creates one quote per PEO with status Sent, moves the opportunity to In market, and writes the registration record (Q-2.1).
- AC: a PEO that still needs something can be sent to; the email names what is missing.
- AC: if one send fails the others still go; the failed one stays Not sent with the reason and "Try again".

| State of New quote | What shows |
|---|---|
| Loading a step | The steps bar and the step's headings with grey lines |
| Left half done | It is listed under Quotes, "Not sent yet", and reopens at the step it was on |
| No PEOs listed | Step 4 reads "No PEOs are listed yet" and says who to ask |
| No PEO authorized | Step 4's Continue is disabled with "Lucia hasn't authorized a PEO yet" and "Ask Lucia" |
| Mailbox disconnected | Step 5 shows "Your email is no longer connected" with Reconnect and "Send from my own mail" |

### What a quote's status means

**CRM-Q3.1 Quote statuses and what moves them.** M · BE · needs N-1.2

| Status | What it means | What moves it there | What else happens |
|---|---|---|---|
| **Not sent** | A PEO is chosen; nothing has gone | The agent ticks the PEO in step 4 | Listed under "Not sent yet"; not a quote request yet |
| **Sent** | The packet went; the PEO hasn't answered | Sending in step 5, or the agent recording a send made outside the product | The opportunity becomes In market. The wait is counted in days |
| **Acknowledged** | The PEO said it has it | The agent accepts a suggestion on a reply, or sets it | The wait keeps counting |
| **Question open** | The PEO asked for something | The agent accepts a suggestion, or sets it | Shows on Home under Needs you. Answering it, or sending again, returns it to Sent |
| **Quoted** | The PEO returned a quote | The agent records the quote (CRM-Q3.3) | The opportunity becomes Quoted. The expiry is tracked; seven days before, it shows on Home |
| **Declined** | The PEO won't take the employer | The agent records the decline with a reason and the PEO's words | The opportunity stays where its other quotes put it |
| **Closed** | Nothing more is expected | The agent closes it; the employer withdraws that PEO; the quote expires; the opportunity is won on another quote, or lost | Sending again reopens it as Sent |

- AC: an arriving email never changes a status on its own. It can only suggest (N-1.1).
- AC: a quoted quote that the employer took is marked **Chosen** when its opportunity is won.
- AC: every change records who or what made it, and when. Nobody can rewrite that record.
- AC: an opportunity's stage is In market while any quote is Sent, Acknowledged or Question open and none is Quoted; Quoted once one is.

**CRM-Q3.2 A quote's page.** M · FS (screen 11) · needs M-3.x
- AC: a trail leads back: Accounts / the account / the opportunity / the PEO.
- AC: the header shows the PEO, the status with the days waiting, when it was sent and from which version, with Record the quote, Record a decline and Close.
- AC: the page shows the emails with that PEO newest first, with a place to reply from the agent's address; the details (PEO contact, status, sent, version, what it still needs, the reply address); the quote's figures; and what was sent.
- AC: an attachment can be opened only after it passes the virus check; one that fails is blocked and the rest of the message stays readable.

| State | When | What shows |
|---|---|---|
| Loading | | Header and panel headings with grey lines |
| No reply yet | Sent, nothing back | The thread shows what was sent and "No reply yet · waiting 6 days" |
| No quote recorded | Not yet quoted | The quote panel reads "Not yet" on each line |
| Sent outside the product | The agent recorded a send | The thread says so, with the reply address to copy |
| Closed | | A banner with why, and "Send again" |

**CRM-Q3.3 Record a quote.** M · FS (screen 12) · needs N-2.1, N-2.3
- AC: "Record the quote" shows the PEO's email and document beside a form: admin fee and its basis, one-off fees, proposed start, expiry and a note.
- AC: where the product read a figure from the email or the document, the field is filled and says where it came from. Nothing is saved until the agent saves.
- AC: saving sets the quote to Quoted and shows it in the comparison.
- AC: a quote can be added to an opportunity by hand, for a PEO that answered by phone or portal: the agent picks the PEO, enters the figures and may upload the document. It creates the quote on that opportunity with status Quoted and a note that it was entered by hand.

**CRM-Q3.4 Add a quote to an opportunity.** S · FS
- AC: "Send to another PEO" on an opportunity opens step 4 with the PEOs already sent to marked.
- AC: a PEO can be added at any stage before Won or Lost. A second send to the same PEO continues its quote with the new version, as today.

### The quotes table (screen 2)

| | |
|---|---|
| **Default columns** | Account (with target start), PEO, Status (with days waiting), Sent, Admin fee, Expires, Emails (with a new-mail mark), Owner |
| **Other columns** | Opportunity, version sent, what it still needs, proposed start, last message, File ID |
| **Default sort** | Needs me first: new mail, then expiring soonest, then longest wait |
| **Views** | Open, Not sent yet, Waiting on a PEO, Quoted, Declined, Closed |
| **Filters shown** | Owner, PEO. Add filter: status, sent date, expiry, days waiting, account, has new mail |
| **Search** | Account, PEO, File ID |
| **Bulk actions** | Change owner (changes the opportunity's), close (one reason for all), export |

**CRM-Q4.1 The quotes table.** M · FS · needs CRM-S3.x
- AC: one row per PEO per opportunity, and one row per New quote left half done.
- AC: the account opens the opportunity; the PEO opens the quote.
- AC: status, figures and dates can't be bulk-edited; each is recorded on its own quote.

| State | When | What shows |
|---|---|---|
| Loading | | Headings, views and eight grey rows |
| Nothing yet | The firm has sent no quotes | "Your quotes will be listed here", with New quote, and the three steps of a quote |
| Nothing matches | | "No quotes match these filters", Clear filters |

**CRM-Q4.2 Compare quotes.** M · FE (screen 13) · needs N-3.1
- AC: one column per PEO, one row per line of the quote, the same lines for every PEO; what a quote leaves out reads "Not quoted", never zero.
- AC: a quote not yet back shows its status in its column.
- AC: Download as PDF, Email it to the contact (QP-D2 decides whether), and Mark the one chosen, which opens Mark won (CRM-O1.3).

| State | When | What shows |
|---|---|---|
| No quotes back | All still waiting | "No quotes are back yet" with each PEO's status and days waiting |
| One quote back | | The comparison with one filled column, and a note that there is nothing to compare it with yet |

---

## 7. Email and the inbox (screens 3, 9)

**CRM-E1.1 Connect a mailbox.** S · FS · needs M-4.1, M-4.3
- AC: an agent connects Google or Microsoft from the first send, from any place to write, and from Settings. Permission is to send only (`docs/adr/0005`).
- AC: a connected mailbox shows its address and "Connected", and can be disconnected, which deletes the token.
- AC: if the provider takes the permission back, the next place to write says so with Reconnect.

**CRM-E1.2 Write to a contact or a lead.** M · FS · needs M-2.1
- AC: a place to write is on a contact's page, a lead's page and, as "Email", on an account and an opportunity (where it asks which contact).
- AC: the message goes out through the agent's mailbox, from their address, and is in their Sent folder.
- AC: each conversation has its own reply address, first in Reply-To with the agent's second, so a reply reaches both the record and the agent's inbox.
- AC: a file can be attached from the account's files, only if it has passed the virus check and the agent may open it. A packet or a census can't be attached to a message to anyone but the employer it belongs to.
- AC: a contact marked "Do not email" can't be written to.

**CRM-E1.3 Replies come back.** M · BE · needs M-3.2
- AC: a reply to a conversation's address joins that conversation, whoever sent it; a sender not seen before is marked new and offered as a contact on that account.
- AC: mail to an address that no longer belongs to a record goes to the **holding list**, as today.
- AC: a message is stored once and shown on every record it belongs to: mail with a PEO on its quote; mail with a contact on the contact; both also on the opportunity and the account.

**CRM-E1.4 The inbox.** M · FS · needs CRM-E1.3
As an agent, I want to see everything coming and going.
- AC: the inbox lists every email on the person's quotes, contacts and leads, both directions, newest first: who, what it is about (linked), the first line, its kind, and when.
- AC: views: All, New, From PEOs, From contacts and leads, Sent. Filters: owner, account. Search matches sender, subject and account, never the body.
- AC: opening a message opens it on its record and clears its "new" mark for everyone who can see it.
- AC: it is a view of the product's own threads. It never shows, reads or searches the agent's mailbox.

| State | When | What shows |
|---|---|---|
| Loading | | Headings, views and eight grey rows |
| Nothing yet | No mail on any record | "Emails with PEOs, contacts and leads will be listed here" |
| No mailbox | The agent hasn't connected one | A banner, "Connect your email to send from here", above whatever mail there is |
| Nothing new | The New view is empty | "Nothing new" |

**CRM-E1.5 Calls, notes and tasks.** S · FS (screen 27)
- AC: a call, a note or a task can be logged on a lead, an account, a contact or an opportunity. A call records who with, about what, when, the outcome and what was said; a task, what, for whom and when due.
- AC: logging a call can add a follow-up task in the same step.
- AC: a task is open or done; a task due today or overdue shows on Home for the person it is for. Notes can't be edited after a day; they can be added to.

---

## 8. Reports (screen 31)

**CRM-R1.1 The reports page.** M · FS · needs CRM-S5.1
As an owner or a lead, I want to see how the firm is doing without building a report.
- AC: Reports is in the menu. It holds the six reports below, each a panel with a headline figure, a chart and a table.
- AC: one set of controls applies to all: a period (this month, this quarter, this year, last 12 months, or two dates), whose work (me, my team, a named agent, everyone the person may see), and the source.
- AC: a person sees figures only for records they may see; an agent sees their own.
- AC: every figure opens the list of records it counts, in the right table with the right filters.
- AC: each table can be exported as a CSV. Figures are counts, sums and durations; no report holds an intake's answers or anything about an employee.
- AC: there is no report builder to start with.

| Report | What it shows | How each figure is worked out |
|---|---|---|
| **Pipeline** | Open opportunities by stage, and their value | Count and sum of value of opportunities not won or lost, by current stage, as of now |
| **Quotes** | Sent, back, declined; days to a first quote; by PEO | Sent: quotes first sent in the period. Back: of those, the ones quoted. Days: the median from first send to the quote being recorded. One row per PEO |
| **Won and lost** | Won, lost, win rate; by owner, source and PEO chosen; lost by reason | Opportunities marked won or lost in the period. Win rate is won over won plus lost |
| **Leads** | Created, converted, not a fit; conversion rate; days to convert; by source | Leads created in the period, and what became of them since. Days: the median from created to converted |
| **Renewals** | Due by month for the next 12; how many are being worked; how last period's ended | Renewals by date. Worked: has an opportunity. Ended: re-placed, stayed, or left |
| **Activity** | Emails sent, emails received, calls, tasks done, by person | Counts in the period by the person who did them |

**CRM-R1.2 Money.** S · FS · needs Q-4.1
- AC: a seventh panel, shown to owners only, sums expected and received commission by month and by PEO from placements.

**CRM-R1.3 What a report is not.** S · BE
- AC: a report is worked out when it is opened, from the records as they are; it is never a stored copy.
- AC: figures about an agent are seen by that agent, the leads above them and owners, and nobody else.

| State | When | What shows |
|---|---|---|
| Loading | | The controls and each panel's heading, with a grey block where the chart will be |
| Nothing yet | A new firm | "Reports fill in as you quote", and each panel shows what it will count |
| Nothing in this period | The period holds no records | Each panel reads "Nothing in this period" and keeps its headings; the controls stay |
| One report failed | | That panel says so with Try again |

---

## 9. Settings (screens 20, 28, 29, 30)

Settings is one section with three parts: team members, email and fields. Only owners see team members and
fields; everyone sees email.

**CRM-X1.1 Team members.** M · FS (screens 20, 29) · needs P-1.2
- AC: a table of members: name, email, role, team, what they can see, how many accounts they own, and whether they are active or invited.
- AC: an owner invites by email with a role (agent, team lead, owner) and a team; the invitation can be sent again or withdrawn until accepted.
- AC: an owner changes a member's role or team, creates a team, names its lead, and puts a team inside another.
- AC: removing a member ends their access at once. Their leads, accounts and opportunities are listed for the owner to reassign in bulk; nothing is deleted.
- AC: the firm always has at least one owner.

| State | When | What shows |
|---|---|---|
| One member | A new firm | The owner's own row and "Invite your first member" |
| Invitation not accepted | | The row reads "Invited Nov 10" with Send again and Withdraw |
| A removed member with records | | A banner: "74 accounts need a new owner" with Reassign |

**CRM-X2.1 Email.** S · FS (screen 20)
- AC: each person sees their own mailbox (CRM-E1.1) and edits their signature, which is added to every message they send from the product.
- AC: an owner also sees how many members have connected, and can remind those who haven't.

**CRM-X3.1 Fields.** M · FS (screens 20, 30)
- AC: for each of leads, accounts, contacts and opportunities, a table lists every field: its name, kind, whether it is standard or the firm's, and whether it is required.
- AC: an owner adds a field: the table, a name, a kind (text, long text, number, money, date, yes or no, one choice, several choices, link, phone, email), choices where the kind needs them, and whether it shows as a column and a filter. The form shows how the field will look.
- AC: a firm may add 30 fields per table. Custom fields are optional.
- AC: renaming keeps values. A field is archived, never deleted: it leaves forms and tables, and its values are kept. Removing a choice leaves it on the records that have it.
- AC: a field can't be named for a tax ID, a census or anything about an employee; the form refuses and says why.
- AC: quotes take no custom fields. Custom fields never enter an intake or anything sent to a PEO.

**CRM-X4.1 Import.** M · FS (screen 28)
- AC: an owner or a lead uploads a CSV of up to 10,000 rows, chooses leads or accounts with contacts, and matches each column to a field, to a new custom field, or to "Don't import". The product proposes a match for each column.
- AC: before importing, a review says how many rows will create a record, how many will update one that exists (matched as in CRM-S4.2), and which rows can't be imported and why.
- AC: the owner of each row comes from a column matched to a member, or is the person importing.
- AC: an import is one batch: it is listed with who ran it and when, and can be undone as a whole for 30 days, which removes what it created and puts back what it changed.
- AC: an import never contacts anyone.

| State | When | What shows |
|---|---|---|
| A file that can't be read | Not a CSV, or no header row | What is wrong and what a file needs |
| Rows in error | Some rows fail the rules | They are listed with the reason and can be downloaded, fixed and imported again |
| Importing | A large file | Progress by rows, and the person can leave the page |

---

## 10. Order of work

| Slice | Stories | What an agent can do at the end | Needs |
|---|---|---|---|
| **1. The chain** | CRM-Q1.1, CRM-Q1.3, CRM-S5.1, CRM-S1.1 | Every existing and new submission sits on an account, a contact and an opportunity, seen only by its firm | P-1.1 |
| **2. Accounts** | CRM-S2.x, CRM-S3.1 to S3.5, CRM-S4.1, CRM-A1.x, CRM-A2.x, CRM-C1.1, CRM-O1.1, CRM-O1.2 | Work from the accounts table down to a quote | Slice 1 |
| **3. New quote** | CRM-Q2.1 to Q2.5, CRM-Q4.1, CRM-Q1.2, CRM-Q3.2 | Start with a quote and have the records made for them | P-2.1, P-2.2 |
| **4. Leads and import** | CRM-L1.x, CRM-L2.x, CRM-X4.1, CRM-S4.2 | Bring a book in and work leads to accounts | Slice 2 |
| **5. Bulk and the rest of tables** | CRM-S3.6 to S3.8, CRM-S4.3, CRM-S1.2 | Change many records at once, export, merge, search | Slice 2 |
| **6. Send and email** | CRM-Q2.6, CRM-E1.x, CRM-Q3.1 | Send from the product and see every email both ways | M-2.1, M-4.x |
| **7. What comes back** | CRM-Q3.3, CRM-Q3.4, CRM-Q4.2, CRM-O1.3, CRM-A2.4 | Record, compare, win, and track the renewal | Epic N, Q-4.1 |
| **8. Reports and settings** | CRM-R1.x, CRM-X1.1, CRM-X2.1, CRM-X3.1, CRM-H1 | See how the firm is doing and run it | Slices 2 to 7 |

## 11. Questions these stories leave open

1. **Does a status change by itself?** CRM-Q3.1 keeps today's rule that mail only suggests and an agent decides. The founder asked for information to "come back into the CRM"; if a quote should be recorded with no person checking it, that is a different and riskier story.
2. **Does an opportunity's stage move by itself?** CRM-O1.2 has it follow the pipeline stage, which advisors move by hand today (D44). Making the first send and the first quote move it automatically changes D44.
3. **Bulk email.** Left out on purpose: writing to many contacts at once brings the marketing-email rules with it.
4. **Deleting.** Accounts with an intake can only be archived, because the intake is the employer's. Whether a firm can ask for an account and its intakes to be erased is for counsel (QP-D4).
5. **A firm under a firm**, still open from the design.
