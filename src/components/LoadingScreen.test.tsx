import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import LoadingScreen from "./LoadingScreen";

describe("LoadingScreen", () => {
  it("is a named status region that says what is loading", () => {
    render(<LoadingScreen label="Opening your intake" />);
    expect(screen.getByRole("status", { name: "Opening your intake" })).toHaveTextContent("Opening your intake");
  });

  it("says Loading when nothing more specific is given", () => {
    render(<LoadingScreen />);
    expect(screen.getByRole("status", { name: "Loading" })).toBeInTheDocument();
  });
});
