import { describe, expect, it } from "vitest";
import { createChatMessage } from "./chat";
import { hasAnnouncedReady, READY_MESSAGE, shouldAnnounceReady } from "./followUp";

describe("READY_MESSAGE", () => {
  // QA F4: being ready to certify needs three answers, so Lenore never says she has everything when she says it.
  it("tells the prospect they can certify without saying the intake is finished", () => {
    expect(READY_MESSAGE).toMatch(/certify/);
    expect(READY_MESSAGE).toMatch(/keep going/);
    expect(READY_MESSAGE).not.toMatch(/that's everything|that is everything|is complete|have everything/i);
  });

  it("counts Lenore's earlier words for it, so an intake that heard them doesn't hear it again", () => {
    const earlier = createChatMessage(
      "lenore",
      "That's everything The Manuscript needs. You can review your answers and certify now on the Review tab. If you have a few more minutes, I have some questions that help underwriters.",
    );
    expect(hasAnnouncedReady([earlier])).toBe(true);
    expect(shouldAnnounceReady(false, true, false, [earlier])).toBe(false);
    expect(hasAnnouncedReady([createChatMessage("lenore", READY_MESSAGE)])).toBe(true);
    // Only Lenore says it: the prospect quoting it doesn't count.
    expect(hasAnnouncedReady([createChatMessage("user", READY_MESSAGE)])).toBe(false);
  });
});
