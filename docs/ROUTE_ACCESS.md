# Route access

Every route in `src/App.tsx`, who can open it, and what protects the data behind it (plan F-0.3). The UI guards
only decide what to render. The database decides what anyone can read or change, so an address on its own shows
nobody anything they couldn't already read. `src/routeAccess.test.ts` fails when a route in `App.tsx` is missing
from the table below, or when the table lists a route `App.tsx` no longer has.

There are two guards: `RequireAuth` (`src/components/RequireAuth.tsx`) and `RequireAdvisor`
(`src/components/RequireAdvisor.tsx`). There is no `ProtectedRoute`.

| Route | Who can open it | UI guard | What protects the data |
|---|---|---|---|
| `/` | Anyone | None | Nothing to protect: marketing copy only |
| `/login` | Anyone | None | Supabase Auth |
| `/auth/callback` | Anyone arriving from an email link | None. `AuthRedirectGate` sends an email-link result that landed on another page here first | Supabase Auth checks the token in the link |
| `/start` | Any signed-in account, guests included. A signed-out visitor is given a guest session (after a Turnstile check when `VITE_TURNSTILE_SITE_KEY` is set), or is sent to `/login` if one can't be created. `?session=<intake id>` opens a given intake | `RequireAuth`, then `IntakeConsentGate`: nothing of the Chamber renders until the account has agreed to the intake consent | Row security: a prospect reads and changes only their own intakes, documents and files. The database refuses a new intake or document without consent (`EA004`), a second open draft (`EA009`), and a certification from a guest or without the required answers |
| `/profile` | Any signed-in account, guests included (as `/start`) | `RequireAuth` | Row security on `profiles`: an account reads and changes only its own (advisors can read every profile) |
| `/privacy` | Anyone | None | Nothing to protect: public policy rendered from `src/data/dataPolicy.ts` and `src/data/legal.ts` |
| `/terms` | Anyone | None | Nothing to protect: public terms |
| `/manuscript` | A signed-in account, with `?session=<intake id>`. Signed out, the page asks the visitor to sign in; with no `?session=` it says there is nothing to show | None (the page checks for a user itself) | Row security on `chamber_sessions`: only the intake's owner and advisors get a row. Anyone else is told it wasn't found, the same answer as for an intake that doesn't exist |
| `/manuscript/demo` | Anyone | None | Nothing to protect: it renders the invented sample and reads nothing from the database |
| `/manuscript/:reference` | As `/manuscript`, by File ID (`EAA-YYYY-NNNN`) | None (the page checks for a user itself) | As `/manuscript`. A reference that isn't a File ID never reaches the database |
| `/advisor` | An advisor or admin account, never a guest | `RequireAdvisor`: signed out or a guest goes to the advisor sign-in; any other account is told advisor access is required | `advisor_list_submissions()` refuses anyone without the role (`42501`). See `docs/ADVISOR_ACCESS.md` |
| `/advisor/submissions/:id` | An advisor or admin account | `RequireAdvisor` | Row security on every table it reads; advisor-only functions for every write (`docs/ADVISOR_ACCESS.md`) |
| `/advisor/outbox` | An advisor or admin account | `RequireAdvisor` | `advisor_list_outbox_events()`, `advisor_outbox_summary()` and `advisor_requeue_outbox_event()` refuse anyone without the role (`42501`); the list never carries addresses or email content (`docs/NOTIFICATIONS.md`) |
| `*` | Anyone | None | Nothing to protect: the not-found page |

## Adding a route

1. Add it to `src/App.tsx` with the guard it needs: `RequireAuth` for anything that belongs to a prospect,
   `RequireAdvisor` for advisor tools.
2. Make sure the database, not the guard, refuses everyone who shouldn't see its data: row security on what it
   reads, and a role check in every function it calls.
3. Add a row here. `npm test` fails until you do.
