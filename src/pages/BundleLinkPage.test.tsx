// The page a PEO opens from the link in an advisor's send, /b/:token (slice 6.6b; ADR 0003; D-609). The edge function faked.
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import BundleLinkPage, { type BundleLinkApi } from "./BundleLinkPage";

const saved = vi.hoisted(() => [] as { name: string; size: number }[]);
vi.mock("@/lib/downloadFile", () => ({ downloadBlob: (blob: Blob, name: string) => saved.push({ name, size: blob.size }) }));

const TOKEN = "Abc123_-Abc123_-Abc123_-Abc123_-Abc123_-xyz";
const OPEN = {
  state: "open" as const,
  company_name: "Reyes Bakery LLC",
  file_id: "EAA-2026-0042",
  version: 3,
  peo: "Insperity",
  expires_at: "2026-12-16T15:00:00+00:00",
  files: [
    { n: 1, name: "EAA-2026-0042-packet-v3.pdf", what: "The packet, as certified, dates of birth masked" },
    { n: 2, name: "EAA-2026-0042-answers-v3.json", what: "The certified answers as JSON" },
  ],
  open_items: ["FEIN", "Workers' comp loss runs"],
};

function renderAt(api: BundleLinkApi, path = `/b/${TOKEN}`) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/b/:token" element={<BundleLinkPage api={api} />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("BundleLinkPage", () => {
  // Catches: a page that leaves out what ADR 0003 says it shows (the employer as certified, the File ID and version, the PEO, the day it stops
  // working, each file with its own download, the open items), or asks with anything but the token from the link.
  it("shows the employer, File ID and version, the PEO, the day it stops working, each file with its own Download, and the open items", async () => {
    const api: BundleLinkApi = { open: vi.fn(async () => OPEN), download: vi.fn() };
    renderAt(api);
    expect(await screen.findByRole("heading", { name: "Reyes Bakery LLC" })).toBeInTheDocument();
    expect(api.open).toHaveBeenCalledWith(TOKEN);
    expect(screen.getByText("File ID EAA-2026-0042, version 3, for Insperity")).toBeInTheDocument();
    expect(screen.getByText("This link stops working on December 16, 2026.")).toBeInTheDocument();
    expect(screen.getByText("EAA-2026-0042-packet-v3.pdf")).toBeInTheDocument();
    expect(screen.getByText("The certified answers as JSON")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /^Download/ })).toHaveLength(2);
    expect(screen.getByRole("list", { name: "Open items" })).toHaveTextContent("FEINWorkers' comp loss runs");
  });

  // Catches: an expired, revoked, unknown or malformed link that names the employer, says which of those it is, or shows a blank page.
  it("shows one page, naming no employer, when the link no longer works", async () => {
    const api: BundleLinkApi = { open: vi.fn(async () => null), download: vi.fn() };
    renderAt(api, "/b/not-a-token");
    expect(await screen.findByRole("heading", { name: "This link no longer works" })).toBeInTheDocument();
    expect(screen.getByText("Ask the person who sent it for a new one.")).toBeInTheDocument();
    expect(screen.queryByText(/Reyes/)).not.toBeInTheDocument();
  });

  // Catches: a Download that asks for the wrong file, saves it under another name, or fails silently when the link stopped working meanwhile.
  it("downloads one file by its number and saves it under its name; a link gone meanwhile says so", async () => {
    const download = vi.fn(async (_t: string, n: number) => (n === 2 ? new Blob(["{}"]) : null));
    renderAt({ open: vi.fn(async () => OPEN), download });
    await userEvent.click(await screen.findByRole("button", { name: "Download EAA-2026-0042-answers-v3.json" }));
    expect(download).toHaveBeenCalledWith(TOKEN, 2);
    expect(saved).toEqual([{ name: "EAA-2026-0042-answers-v3.json", size: 2 }]);
    await userEvent.click(screen.getByRole("button", { name: "Download EAA-2026-0042-packet-v3.pdf" }));
    expect(await screen.findByRole("heading", { name: "This link no longer works" })).toBeInTheDocument();
  });

  // Catches: a failure on our side shown as "This link no longer works", so a PEO holding a live link gives up on it.
  it("says to try again, not that the link is gone, when the page can't be loaded", async () => {
    renderAt({ open: vi.fn(async () => { throw new Error("500"); }), download: vi.fn() });
    expect(await screen.findByRole("heading", { name: "We couldn't load this page" })).toBeInTheDocument();
    expect(screen.queryByText("This link no longer works")).not.toBeInTheDocument();
  });
});
