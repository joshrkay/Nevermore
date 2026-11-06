import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const auth = { user: { id: "u1", email: "a@b.co" } };
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => auth }));

const toast = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

const db = vi.hoisted(() => ({ update: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          single: async () => ({
            data: { company_name: "Acme", contact_name: "Jo", phone: "", employee_count: 5 },
            error: null,
          }),
        }),
      }),
      update: (values: unknown) => ({ eq: async () => db.update(values) }),
    }),
  },
}));

const { default: ProfilePage } = await import("./ProfilePage");

const save = async (phone: string) => {
  render(
    <MemoryRouter>
      <ProfilePage />
    </MemoryRouter>,
  );
  fireEvent.change(await screen.findByLabelText("Phone Number"), { target: { value: phone } });
  fireEvent.click(screen.getByRole("button", { name: /Save Changes/ }));
};

describe("ProfilePage save", () => {
  beforeEach(() => {
    toast.error.mockReset();
    toast.success.mockReset();
    db.update.mockReset();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("names the phone when the server refuses it", async () => {
    db.update.mockResolvedValue({
      error: { code: "EA001", details: "phone", hint: "must be a phone number such as (555) 123-4567" },
    });
    await save("call me");
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Enter a phone number such as (555) 123-4567"),
    );
  });

  it("keeps the generic message for any other failure", async () => {
    db.update.mockResolvedValue({ error: { code: "42501", details: null, hint: null } });
    await save("555-0100");
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Failed to save profile"));
  });

  it("caps the names at the length the database keeps", async () => {
    render(
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>,
    );
    expect(await screen.findByLabelText("Company Name")).toHaveAttribute("maxlength", "200");
    expect(screen.getByLabelText("Contact Name")).toHaveAttribute("maxlength", "200");
  });

  it("refuses an employee count that isn't a whole number, instead of saving part of it", async () => {
    render(
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>,
    );
    // parseInt("1e3") is 1: the count the person typed must be saved as typed, or not at all.
    fireEvent.change(await screen.findByLabelText("Employee Count"), { target: { value: "1e3" } });
    fireEvent.click(screen.getByRole("button", { name: /Save Changes/ }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Enter the employee count as a whole number, such as 25"));
    expect(db.update).not.toHaveBeenCalled();
  });

  it("confirms a successful save", async () => {
    db.update.mockResolvedValue({ error: null });
    await save("555-0100");
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Profile updated"));
  });
});
