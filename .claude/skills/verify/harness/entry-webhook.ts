// Launch wrapper for the real resend-webhook function: nothing is redirected, since it only talks to the database.
await import(new URL("../../../../supabase/functions/resend-webhook/index.ts", import.meta.url).href);
