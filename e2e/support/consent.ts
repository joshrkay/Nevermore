import { expect, type APIRequestContext, type Page } from "@playwright/test";
import { INTAKE_CONSENT_AGREEMENT, INTAKE_CONSENT_VERSION, intakeConsentText } from "../../src/data/intakeConsent";
import { GATEWAY_URL } from "../stack/config.mjs";

/**
 * Agrees to the intake consent (US-6.2), which the Chamber shows before it opens anything for an account that
 * hasn't agreed to the wording in force. Call it after the first visit to /start in a browser context; later
 * visits by the same guest go straight to the Chamber.
 */
export async function agreeToIntakeConsent(page: Page) {
  await expect(page.getByRole("heading", { name: "Before you start" })).toBeVisible();
  // Nothing of the Chamber is on the page until the agreement is recorded.
  await expect(page.getByPlaceholder("Type a message...")).toHaveCount(0);
  await page.getByRole("checkbox", { name: INTAKE_CONSENT_AGREEMENT }).check();
  await page.getByRole("button", { name: "Agree and start", exact: true }).click();
}

/**
 * Records the intake consent for a caller over REST, as the gate does, so a test that creates intakes through
 * the gateway directly isn't refused (EA004). `headers` carry the caller's apikey and bearer token.
 */
export async function agreeToIntakeConsentOverRest(request: APIRequestContext, headers: Record<string, string>) {
  const agreed = await request.post(`${GATEWAY_URL}/rest/v1/rpc/record_intake_consent`, {
    headers: { ...headers, "Content-Type": "application/json" },
    data: { p_version: INTAKE_CONSENT_VERSION, p_text: intakeConsentText() },
  });
  expect(agreed).toBeOK();
}
