import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import InformationRequestNotice from "./InformationRequestNotice";

describe("InformationRequestNotice", () => {
  it("shows the advisor's words, the answers it is about by label, and opens Review", () => {
    const onOpenReview = vi.fn();
    render(
      <InformationRequestNotice
        request={{ message: "Please confirm your pay frequency.\nAnd the census.", fields: ["pay_frequency", "census"], requestedAt: "2026-11-05T12:00:00Z", extraQuestions: [] }}
        onOpenReview={onOpenReview}
      />,
    );
    expect(screen.getByRole("heading", { name: /Your advisor asked for more information on November 5/ })).toBeInTheDocument();
    expect(screen.getByText(/Please confirm your pay frequency\.\s+And the census\./)).toBeInTheDocument();
    expect(screen.getByText("About: Pay frequency, Employee census")).toBeInTheDocument();
    expect(screen.getByText(/then certify again on the Certify & sign tab/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Open Review" }));
    expect(onOpenReview).toHaveBeenCalledTimes(1);
  });

  it("says when it asks a PEO's own questions too, and where they are", () => {
    render(<InformationRequestNotice request={{ message: "A few more things.", fields: [], requestedAt: "2026-11-05T12:00:00Z",
      extraQuestions: [{ peo_id: 3, key: "vehicles", question: "Do employees drive for work?" }, { peo_id: 3, key: "fleet", question: "How many vans?" }] }} onOpenReview={() => {}} />);
    expect(screen.getByText("And 2 extra questions, on the PEO Match tab.")).toBeInTheDocument();
  });

  it("names no answers when the request is about none", () => {
    render(<InformationRequestNotice request={{ message: "Send the loss runs.", fields: [], requestedAt: "2026-11-05T12:00:00Z", extraQuestions: [] }} onOpenReview={() => {}} />);
    expect(screen.queryByText(/^About:/)).not.toBeInTheDocument();
  });
});
