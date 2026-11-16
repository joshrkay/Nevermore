// The page a contact opens from a file link in an agent's message, /f#<token> (story CRM-E1.2b, slice 6.3; D-605). The edge function faked.
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import FileLinkPage, { type FileLinkApi } from "./FileLinkPage";

const saved = vi.hoisted(() => [] as { name: string; size: number }[]);
vi.mock("@/lib/downloadFile", () => ({ downloadBlob: (blob: Blob, name: string) => saved.push({ name, size: blob.size }) }));

const TOKEN = "Abc123_-Abc123_-Abc123_-Abc123_-Abc123_-xyz";

const renderAt = (api: FileLinkApi, path = `/f#${TOKEN}`) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/f" element={<FileLinkPage api={api} />} />
      </Routes>
    </MemoryRouter>,
  );

describe("FileLinkPage", () => {
  // Catches: a download that asks with anything but the token after # (the part of the link no request carries), a file saved under another name, or a
  // link that no longer works shown as anything but the one page that names nobody.
  it("downloads the file with the token from the link, under its name; a link that no longer works says so", async () => {
    const user = userEvent.setup();
    const api: FileLinkApi = { download: vi.fn(async () => ({ blob: new Blob(["PK"]), name: "census.xlsx" })) };
    renderAt(api);
    await user.click(screen.getByRole("button", { name: "Download the file" }));
    expect(api.download).toHaveBeenCalledWith(TOKEN);
    expect(saved).toEqual([{ name: "census.xlsx", size: 2 }]);

    const goneApi: FileLinkApi = { download: vi.fn(async () => null) };
    renderAt(goneApi);
    await user.click(screen.getAllByRole("button", { name: "Download the file" })[1]);
    expect(await screen.findByRole("heading", { name: "This link no longer works" })).toBeInTheDocument();
  });
});
