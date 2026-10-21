// Launch wrapper: redirect only the hard-coded api.resend.com URL to the fake; everything else (incl. the function source) is untouched.
const realFetch = globalThis.fetch;
globalThis.fetch = (input: Request | URL | string, init?: RequestInit) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  return url.startsWith("https://api.resend.com/")
    ? realFetch(url.replace("https://api.resend.com", "http://127.0.0.1:54400"), init)
    : realFetch(input as never, init);
};
await import(new URL("../../../../supabase/functions/dispatch-outbox/index.ts", import.meta.url).href);
