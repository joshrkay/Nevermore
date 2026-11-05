import { describe, expect, it } from "vitest";
import { DRAFT_REMINDER_SETTING } from "./draftReminders";
import { DRAFT_REMINDER_SETTING as EMAIL_NAMES } from "../../supabase/functions/dispatch-outbox/messages";

describe("the draft reminder setting", () => {
  it("is named in the reminder email exactly as the prospect sees it", () => {
    expect(EMAIL_NAMES).toBe(DRAFT_REMINDER_SETTING);
  });
});
