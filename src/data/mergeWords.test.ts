import { describe, expect, it } from "vitest";
import { defaultMergeChoice, mergedWords, mergeMovesWords, mergeRecordName, mergeValueWords } from "@/data/mergeWords";

describe("what the merge screens say", () => {
  // Break caught: a blank shown as an empty cell (nothing to choose between), a list shown with its brackets, or an owner shown as an object.
  it("words a value", () => {
    expect(mergeValueWords("phone", null)).toBe("Blank");
    expect(mergeValueWords("phone", "  ")).toBe("Blank");
    expect(mergeValueWords("states_of_operation", ["OR", "WA"])).toBe("OR, WA");
    expect(mergeValueWords("states_of_operation", [])).toBe("Blank");
    expect(mergeValueWords("employees", 0)).toBe("0");
    expect(mergeValueWords("do_not_email", true)).toBe("Yes");
    expect(mergeValueWords("do_not_email", false)).toBe("No");
    expect(mergeValueWords("owner", { id: "u1", name: "Dana Reyes" })).toBe("Dana Reyes");
    expect(mergeValueWords("owner", null)).toBe("No owner");
  });

  // Break caught: a choice that starts somewhere other than what the database does for a field left alone (the screen says one thing and the merge does another).
  it("starts each choice where the database would leave it", () => {
    expect(defaultMergeChoice("phone", { phone: "1" }, { phone: "2" })).toBe("kept");
    expect(defaultMergeChoice("phone", { phone: null }, { phone: "2" })).toBe("removed");
    expect(defaultMergeChoice("phone", { phone: null }, { phone: null })).toBe("kept");
    expect(defaultMergeChoice("do_not_email", { do_not_email: false }, { do_not_email: true })).toBe("removed");
    expect(defaultMergeChoice("do_not_email", { do_not_email: true }, { do_not_email: false })).toBe("kept");
    expect(defaultMergeChoice("owner", { owner: null }, { owner: { id: "u", name: "A" } })).toBe("removed");
    expect(defaultMergeChoice("owner", { owner: { id: "u1", name: "A" } }, { owner: { id: "u2", name: "B" } })).toBe("kept");
  });

  it("names a record and says what moves and what happened", () => {
    expect(mergeRecordName("contact", { first_name: "Sam", last_name: "Reyes" })).toBe("Sam Reyes");
    expect(mergeRecordName("contact", { first_name: null, last_name: "Reyes" })).toBe("Reyes");
    expect(mergeRecordName("account", { name: "Harborview Marine" })).toBe("Harborview Marine");
    const lines = mergeMovesWords("account", { contacts: 2, opportunities: 1, intakes: 1, activities: 4, placements: 0, renewals: 0, labels: 1 }, "Harborview Marine");
    expect(lines[0]).toBe("2 contacts, 1 opportunity, 4 calls, notes and tasks, 1 label move to Harborview Marine.");
    expect(lines[1]).toBe("1 intake stays on its own opportunity.");
    expect(mergeMovesWords("contact", { activities: 0, opportunities_main_contact_of: 2 }, "Sam Reyes")[1]).toContain("2 opportunities name the contact that will be removed as the main contact");
    expect(mergedWords("account", "Harborview Marine", "Harborview Marine LLC", { contacts: 1, opportunities: 0, activities: 3 })).toBe("Harborview Marine LLC was merged into Harborview Marine. 1 contact, 3 calls, notes and tasks moved over.");
    expect(mergedWords("contact", "Sam Reyes", "S. Reyes", { activities: 0 })).toBe("S. Reyes was merged into Sam Reyes.");
  });
});
