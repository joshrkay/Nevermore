import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Seam 2 (D-13): an owner keeps the firm's own opening text for its messages (BR-3.5), with the database faked at its API module.
const toast = { success: vi.fn(), error: vi.fn() };
vi.mock("sonner", () => ({ toast }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ signOut: vi.fn() }) }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
const loadFirmTemplates = vi.fn();
const saveFirmTemplate = vi.fn();
vi.mock("@/lib/templatesApi", () => ({
  loadFirmTemplates: (...a: unknown[]) => loadFirmTemplates(...a),
  saveFirmTemplate: (...a: unknown[]) => saveFirmTemplate(...a),
}));

const { MessageTemplates } = await import("./MessageTemplates");
const show = () => render(<MemoryRouter><MessageTemplates firmId="f1" /></MemoryRouter>);

describe("MessageTemplates", () => {
  beforeEach(() => {
    loadFirmTemplates.mockReset();
    saveFirmTemplate.mockReset();
    toast.success.mockReset();
  });

  // Break caught: a saved template not shown, one saved under the wrong kind, or Save offered with nothing changed.
  it("shows what the firm has, and saves a kind's text under that kind", async () => {
    loadFirmTemplates.mockResolvedValue({ follow_up: "Hi, checking in on {company}." });
    saveFirmTemplate.mockResolvedValue(undefined);
    show();
    const followUp = await screen.findByRole("form", { name: "Follow-up template" });
    expect(within(followUp).getByRole("textbox")).toHaveValue("Hi, checking in on {company}.");
    expect(within(followUp).getByRole("button", { name: "Save" })).toBeDisabled();
    const send = screen.getByRole("form", { name: "First send template" });
    expect(within(send).getByRole("textbox")).toHaveValue("");
    expect(within(send).queryByRole("button", { name: "Use ours again" })).not.toBeInTheDocument();
    fireEvent.change(within(send).getByRole("textbox"), { target: { value: "Hello, a new submission for you: {company}." } });
    fireEvent.click(within(send).getByRole("button", { name: "Save" }));
    await waitFor(() => expect(saveFirmTemplate).toHaveBeenCalledWith("f1", "send", "Hello, a new submission for you: {company}."));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("The first send template is saved."));
    expect(within(send).getByRole("button", { name: "Use ours again" })).toBeInTheDocument();
  });

  // Break caught: no way back to the product's own text, or a refusal swallowed.
  it("puts the product's text back, and says a refusal in the database's words", async () => {
    loadFirmTemplates.mockResolvedValue({ withdrawal: "Please close {company}." });
    saveFirmTemplate.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error("Only an owner of the firm can do that"));
    show();
    const form = await screen.findByRole("form", { name: "Withdrawal template" });
    fireEvent.click(within(form).getByRole("button", { name: "Use ours again" }));
    await waitFor(() => expect(saveFirmTemplate).toHaveBeenCalledWith("f1", "withdrawal", ""));
    await waitFor(() => expect(within(form).getByRole("textbox")).toHaveValue(""));
    expect(toast.success).toHaveBeenCalledWith("The withdrawal opens with our text again.");
    fireEvent.change(within(form).getByRole("textbox"), { target: { value: "Again" } });
    fireEvent.click(within(form).getByRole("button", { name: "Save" }));
    expect(await within(form).findByRole("alert")).toHaveTextContent("Only an owner of the firm can do that");
  });
});
