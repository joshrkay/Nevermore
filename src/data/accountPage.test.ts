import { describe, expect, it } from "vitest";
import type { ActivityRow } from "@/lib/accountPageApi";
import { activityIsOfKind, activityWords, addressLines, editOf, employeesWords, formatBytes, formatDay, formOf, initialsOf, locationOf, sourceWords, statesOf, valueWords } from "./accountPage";

const entry = (over: Partial<ActivityRow> = {}): ActivityRow => ({
  type: "change", entryKey: "e1", at: "2026-11-01T10:00:00+00:00", changeId: "c1", kind: "changed", who: "dana@example.com", whoKind: "member", field: "employees", from: 40, to: 45,
  recordTable: "accounts", recordId: "a1", recordName: "Harborview", ...over,
});

describe("the words of an account's page", () => {
  it("words a history entry: a creation, a change, a contact's, a list, nothing", () => {
    expect(activityWords(entry({ kind: "created", field: null, from: null, to: null }))).toBe("Account created");
    expect(activityWords(entry())).toBe("Employees changed from 40 to 45");
    expect(activityWords(entry({ field: "trade_name", from: null, to: "Harborview Dental" }))).toBe("Trade name changed from nothing to Harborview Dental");
    expect(activityWords(entry({ field: "states_of_operation", from: ["OR"], to: ["OR", "WA"] }))).toBe("States of operation changed from OR to OR, WA");
    expect(activityWords(entry({ recordTable: "contacts", recordName: "Elena Marsh", field: "is_main", from: false, to: true }))).toBe("Elena Marsh: Main contact changed from no to yes");
    expect(activityWords(entry({ recordTable: "contacts", recordName: "Elena Marsh", kind: "created", field: null }))).toBe("Elena Marsh added as a contact");
    expect(valueWords("")).toBe("nothing");
    expect(valueWords([])).toBe("nothing");
  });

  it("offers the kinds there are: every entry is a change today", () => {
    expect(activityIsOfKind(entry(), "all")).toBe(true);
    expect(activityIsOfKind(entry(), "change")).toBe(true);
  });

  it("reads a location, an address, employees, a source and initials", () => {
    expect(locationOf({ city: "Portland", state: "OR" })).toBe("Portland, OR");
    expect(locationOf({ city: null, state: "OR" })).toBe("OR");
    expect(locationOf({ city: null, state: null })).toBeNull();
    expect(addressLines({ street: "410 SW Alder St", city: "Portland", state: "OR", postalCode: "97204" })).toEqual(["410 SW Alder St", "Portland, OR 97204"]);
    expect(addressLines({ street: null, city: null, state: null, postalCode: null })).toEqual([]);
    expect(employeesWords(1)).toBe("1 employee");
    expect(employeesWords(1200)).toBe("1,200 employees");
    expect(employeesWords(null)).toBeNull();
    expect(sourceWords("added_by_hand", null)).toBe("Added by hand");
    expect(sourceWords("employer_intake", "Kline CPA")).toBe("Employer's intake · Kline CPA");
    expect(initialsOf("Harborview Dental Group")).toBe("HD");
    expect(initialsOf("Acme")).toBe("AC");
  });

  it("reads a date as that day wherever the person is, and a size in a unit", () => {
    expect(formatDay("2026-10-29")).toBe("Oct 29, 2026");
    expect(formatDay("not a date")).toBe("not a date");
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(2048)).toBe("2 KB");
    expect(formatBytes(3 * 1024 * 1024)).toBe("3.0 MB");
  });

  it("turns what is typed for the states of operation into capital letters, each once, in the order typed", () => {
    expect(statesOf("wa, or  WA;tx")).toEqual(["WA", "OR", "TX"]);
    expect(statesOf("")).toEqual([]);
  });

  it("round-trips the form: the database's fields to text and back, a blank to a blank and no employees to null", () => {
    const fields = {
      name: "Harborview", tradeName: null, website: "h.example", phone: null, street: null, city: "Portland", state: "OR", postalCode: null, industry: null,
      employees: 45, statesOfOperation: ["OR", "WA"], currentProvider: null,
    };
    const form = formOf(fields);
    expect(form).toMatchObject({ trade_name: "", employees: "45", states_of_operation: "OR, WA" });
    expect(editOf(form)).toEqual({ ...fields, tradeName: "", phone: "", street: "", postalCode: "", industry: "", currentProvider: "" });
    expect(editOf({ ...form, employees: " " }).employees).toBeNull();
  });
});
