import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BrowserRouter } from "react-router-dom";
import { ProspectCard, FeedbackProvider, Modal } from "../components/ui";
import { createProspect } from "../lib/models";
describe("Toegankelijke bediening", () => {
  it("maakt een geldige tel-link en bedrijfsnavigatie", () => {
    const p = createProspect({
      companyName: "Fictief Browserbedrijf",
      phone: "0612345678",
    });
    render(
      <BrowserRouter>
        <FeedbackProvider>
          <ProspectCard p={p} />
        </FeedbackProvider>
      </BrowserRouter>,
    );
    expect(screen.getByRole("link", { name: "0612345678" })).toHaveAttribute(
      "href",
      "tel:+31612345678",
    );
    expect(
      screen.getByRole("link", { name: "Fictief Browserbedrijf" }),
    ).toHaveAttribute("href", `/prospects/${p.id}`);
  });
  it("maakt geen belknop voor een onveilig of kort telefoonnummer", () => {
    render(
      <BrowserRouter>
        <ProspectCard
          p={createProspect({ companyName: "Fictief", phone: "112" })}
        />
      </BrowserRouter>,
    );
    expect(screen.queryByRole("link", { name: "112" })).not.toBeInTheDocument();
    expect(screen.getByText("Telefoonnummer controleren")).toBeInTheDocument();
  });
  it("sluit een toegankelijk dialoog met Escape", async () => {
    const close = vi.fn();
    render(
      <Modal title="Testdialoog" open onClose={close}>
        <label>
          Naam
          <input />
        </label>
      </Modal>,
    );
    expect(
      screen.getByRole("dialog", { name: "Testdialoog" }),
    ).toBeInTheDocument();
    await userEvent.keyboard("{Escape}");
    expect(close).toHaveBeenCalled();
  });
});
