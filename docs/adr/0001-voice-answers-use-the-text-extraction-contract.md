# Voice answers use the text extraction contract

Lenore's voice agent can write answers into its own replies as `<extract>` JSON, and it used to. We ignore those tags. Instead, each finished thing the prospect says in a voice call goes through `chamber-extract`, the same function, prompt and schema validation as typed chat. The browser then tells the voice agent which fields are still open, by label only. We chose this so there is one extraction contract, versioned in the repo, validated on the server, and logged per intake. The `<extract>` path lived in the voice agent's prompt outside the repo. It skipped the server's schema check, let the agent mark its own answers confirmed or corrected, and could overwrite good answers with nulls.

## Considered Options

- **Keep `<extract>` and harden it in the browser.** Rejected: the contract would stay unversioned in the voice provider's config, and two extraction contracts would drift apart.
- **Have the voice agent speak `chamber-extract`'s text reply.** Rejected: an AI call before every spoken turn adds delay, and the agent loses its own turn-taking.

## Consequences

- Every prospect utterance in a voice call costs one AI call, counted against the same quotas as typed chat.
- The voice agent no longer writes answers. Its prompt only governs conversation, and it lives in the repo with a version.
- The census and dependents lost their only conversational writer. The census now comes from uploaded files only (see the plan, D21).
