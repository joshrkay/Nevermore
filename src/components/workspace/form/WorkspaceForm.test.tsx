import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { createMemoryRouter, RouterProvider, useNavigate } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Field, nameRule, SaveRefused, useWorkspaceForm, WorkspaceForm } from ".";

// A form in a dialog, the way the record forms that come later (new account, add contact) will use these pieces. The pages that
// use the pieces today are inline, so the dialog's own ways of closing are proved here.
const schema = z.object({ name: nameRule("Enter the account name.") });

const save = vi.fn();
const DialogForm = () => {
  const [open, setOpen] = useState(true);
  const api = useWorkspaceForm({ schema, defaultValues: { name: "" }, save: (v) => save(v), onSaved: () => setOpen(false), onCancel: () => setOpen(false) });
  return (
    <>
      <p>{open ? "Form open" : "Form closed"}</p>
      <Dialog open={open} onOpenChange={(next) => { if (!next) api.requestClose(() => setOpen(false)); }}>
        <DialogContent>
          <DialogTitle>New account</DialogTitle>
          <DialogDescription>Add an account</DialogDescription>
          <WorkspaceForm api={api} aria-label="New account">
            <Field name="name" label="Account name" required>{(field) => <Input {...field} />}</Field>
          </WorkspaceForm>
        </DialogContent>
      </Dialog>
    </>
  );
};

describe("a workspace form in a dialog", () => {
  it("closes on Escape without asking when nothing was typed", async () => {
    render(<DialogForm />);
    const user = userEvent.setup();
    await user.keyboard("{Escape}");
    expect(await screen.findByText("Form closed")).toBeInTheDocument();
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("asks on Escape when something was typed, and stays open on Keep editing", async () => {
    render(<DialogForm />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Account name"), "Harborview");
    await user.keyboard("{Escape}");
    const ask = await screen.findByRole("alertdialog");
    await user.click(within(ask).getByRole("button", { name: "Keep editing" }));
    expect(screen.getByText("Form open")).toBeInTheDocument();
    expect(screen.getByLabelText("Account name")).toHaveValue("Harborview");
    await user.keyboard("{Escape}");
    await user.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Discard changes" }));
    expect(await screen.findByText("Form closed")).toBeInTheDocument();
  });

  it("asks when Cancel is pressed with typing in the form, and closes after a save without asking", async () => {
    save.mockReset().mockResolvedValue(undefined);
    render(<DialogForm />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Account name"), "Harborview");
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    await user.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Keep editing" }));
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("Form closed")).toBeInTheDocument();
    expect(save).toHaveBeenCalledWith({ name: "Harborview" });
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  // The place CRM-S2.4a uses for its "someone else changed this" refusal: a save that is refused with a reason keeps the form open.
  it("keeps the dialog open and says why when a save is refused with a reason", async () => {
    save.mockReset().mockRejectedValue(new SaveRefused("Someone else changed this account."));
    render(<DialogForm />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Account name"), "Harborview");
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("Someone else changed this account.")).toHaveAttribute("role", "alert");
    expect(screen.getByText("Form open")).toBeInTheDocument();
    expect(screen.getByLabelText("Account name")).toHaveValue("Harborview");
    await waitFor(() => expect(screen.getByRole("button", { name: "Save" })).toBeEnabled());
  });
});

// A new record's form usually goes to the record's page the moment it is saved. That move must not be asked about.
describe("a workspace form that moves on when it is saved", () => {
  const NavigatingForm = () => {
    const navigate = useNavigate();
    const api = useWorkspaceForm({ schema, defaultValues: { name: "" }, save: async () => undefined, onSaved: () => navigate("/account/1") });
    return (
      <WorkspaceForm api={api} aria-label="New account">
        <Field name="name" label="Account name" required>{(field) => <Input {...field} />}</Field>
      </WorkspaceForm>
    );
  };

  it("goes straight on after a successful save, with no question", async () => {
    const router = createMemoryRouter(
      [{ path: "/", element: <NavigatingForm /> }, { path: "/account/1", element: <p>Account page</p> }],
      { initialEntries: ["/"] },
    );
    render(<RouterProvider router={router} />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Account name"), "Harborview");
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("Account page")).toBeInTheDocument();
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });
});
