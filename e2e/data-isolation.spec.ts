import { expect, test, type APIRequestContext } from "@playwright/test";
import { ANON_KEY, GATEWAY_URL } from "./stack/config.mjs";

// Data isolation over HTTP (US-6.3, docs/SECURITY_REVIEW.md): the same requests the browser's Supabase
// client sends, through the gateway's stand-ins for Supabase Auth and PostgREST, against the real migrations.
// supabase/tests/data_isolation.sql covers every table, caller and function in SQL; this shows the API answers
// the same way: one guest, knowing another guest's intake id, reads, changes and removes nothing of it, with
// their own token, with only the public key, or with a forged token.

const REST = `${GATEWAY_URL}/rest/v1`;

interface Guest {
  id: string;
  token: string;
}

const headers = (token: string | null, extra: Record<string, string> = {}) => ({
  apikey: ANON_KEY,
  Authorization: `Bearer ${token ?? ANON_KEY}`,
  "Content-Type": "application/json",
  ...extra,
});
const representation = { Prefer: "return=representation" };

async function signInAsGuest(request: APIRequestContext): Promise<Guest> {
  const res = await request.post(`${GATEWAY_URL}/auth/v1/signup`, { headers: headers(null), data: {} });
  expect(res.status()).toBe(200);
  const body = (await res.json()) as { access_token: string; user: { id: string; is_anonymous: boolean } };
  expect(body.user.is_anonymous).toBe(true);
  return { id: body.user.id, token: body.access_token };
}

/** Agrees to the wording in force and starts an intake, as the Chamber does for a new guest. */
async function startIntake(request: APIRequestContext, guest: Guest, company: string): Promise<string> {
  const version = await request.post(`${REST}/rpc/intake_consent_version`, { headers: headers(guest.token), data: {} });
  expect(version.status()).toBe(200);
  const consent = await request.post(`${REST}/rpc/record_intake_consent`, {
    headers: headers(guest.token),
    data: { p_version: await version.json(), p_text: "I agree to how my information is used." },
  });
  expect(consent.status()).toBe(200);
  const created = await request.post(`${REST}/chamber_sessions`, {
    headers: headers(guest.token, representation),
    data: {
      user_id: guest.id,
      chamber_data: { company_name: company },
      transcript: [{ id: "m1", sender: "user", text: "We have 12 staff in Fresno" }],
    },
  });
  expect(created.status()).toBe(201);
  const [row] = (await created.json()) as { id: string }[];
  return row.id;
}

test("a guest who knows another guest's intake id gets nothing of it over the API", async ({ request }) => {
  const a = await signInAsGuest(request);
  const b = await signInAsGuest(request);
  const intake = await startIntake(request, a, "Isolation Co");
  // B is a real guest with an intake of their own (and so the consent a document upload needs).
  await startIntake(request, b, "Other Co");
  const byId = `${REST}/chamber_sessions?id=eq.${intake}`;

  await test.step("the owner reads their own intake (the control)", async () => {
    const res = await request.get(`${byId}&select=id,chamber_data,transcript`, { headers: headers(a.token) });
    expect(res.status()).toBe(200);
    expect(await res.json()).toEqual([
      expect.objectContaining({ id: intake, chamber_data: { company_name: "Isolation Co" } }),
    ]);
  });

  // Another guest's token, the public key alone, and a token signed with the wrong secret.
  const forged = `${a.token.split(".").slice(0, 2).join(".")}.forged-signature`;
  for (const [who, token] of [["another guest", b.token], ["a signed-out caller", null]] as const) {
    await test.step(`${who} reads, changes and removes nothing`, async () => {
      const read = await request.get(`${byId}&select=id,chamber_data,transcript,field_provenance`, { headers: headers(token) });
      expect(read.status()).toBe(200);
      expect(await read.json()).toEqual([]);

      const changed = await request.patch(byId, {
        headers: headers(token, representation),
        data: { chamber_data: { company_name: "Hijacked" }, transcript: [] },
      });
      expect(changed.status()).toBe(200);
      expect(await changed.json()).toEqual([]);

      const removed = await request.delete(byId, { headers: headers(token, representation) });
      expect(removed.status()).toBe(200);
      expect(await removed.json()).toEqual([]);

      const docs = await request.get(`${REST}/documents?session_id=eq.${intake}&select=id`, { headers: headers(token) });
      expect(docs.status()).toBe(200);
      expect(await docs.json()).toEqual([]);
    });
  }

  await test.step("another guest can't attach a document to it or close it", async () => {
    const attached = await request.post(`${REST}/documents`, {
      headers: headers(b.token, representation),
      data: { user_id: b.id, session_id: intake, file_name: "x.csv", file_size: "1 KB", storage_path: `${b.id}/${intake}/x.csv` },
    });
    expect(attached.status()).toBe(403);

    const archived = await request.post(`${REST}/rpc/archive_chamber_session`, { headers: headers(b.token), data: { p_session_id: intake } });
    // PT404: the same answer as for an id that doesn't exist, so it doesn't say the intake is there.
    expect(archived.status()).toBe(404);
  });

  await test.step("a forged token is refused outright", async () => {
    const res = await request.get(`${byId}&select=id`, { headers: headers(forged) });
    expect(res.status()).toBe(401);
  });

  await test.step("the intake is exactly as its owner left it", async () => {
    const res = await request.get(`${byId}&select=chamber_data,transcript`, { headers: headers(a.token) });
    expect(await res.json()).toEqual([
      { chamber_data: { company_name: "Isolation Co" }, transcript: [{ id: "m1", sender: "user", text: "We have 12 staff in Fresno" }] },
    ]);
  });
});
