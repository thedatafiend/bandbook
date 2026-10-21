import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { EditableKey } from "./editable-fields";

describe("EditableKey", () => {
  afterEach(() => {
    cleanup();
  });

  it("shows the current key", () => {
    render(
      <EditableKey value={{ tonic: 9, mode: "minor" }} suggestion={null} onSave={vi.fn()} />
    );
    expect(screen.getByTitle("Click to edit key")).toHaveTextContent("A minor");
  });

  it("prompts to set a key when none is set", () => {
    render(<EditableKey value={null} suggestion={null} onSave={vi.fn()} />);
    expect(screen.getByTitle("Click to edit key")).toHaveTextContent("Set key");
    expect(screen.queryByRole("button", { name: /Use detected key/ })).not.toBeInTheDocument();
  });

  it("offers the suggestion only when no key is set", () => {
    const { rerender } = render(
      <EditableKey value={null} suggestion={{ tonic: 7, mode: "major" }} onSave={vi.fn()} />
    );
    expect(screen.getByRole("button", { name: "Use detected key G major" })).toBeInTheDocument();

    rerender(
      <EditableKey
        value={{ tonic: 2, mode: "major" }}
        suggestion={{ tonic: 7, mode: "major" }}
        onSave={vi.fn()}
      />
    );
    expect(screen.queryByRole("button", { name: /Use detected key/ })).not.toBeInTheDocument();
  });

  it("saves the suggestion when accepted", async () => {
    const onSave = vi.fn().mockResolvedValue(true);
    render(<EditableKey value={null} suggestion={{ tonic: 7, mode: "major" }} onSave={onSave} />);
    fireEvent.click(screen.getByRole("button", { name: "Use detected key G major" }));
    await waitFor(() => expect(onSave).toHaveBeenCalledWith({ tonic: 7, mode: "major" }));
  });

  it("lists all 24 keys plus a clear option", () => {
    render(<EditableKey value={null} suggestion={null} onSave={vi.fn()} />);
    fireEvent.click(screen.getByTitle("Click to edit key"));
    expect(screen.getAllByRole("option")).toHaveLength(25);
  });

  it("saves a picked key and closes the picker", async () => {
    const onSave = vi.fn().mockResolvedValue(true);
    render(<EditableKey value={null} suggestion={null} onSave={onSave} />);
    fireEvent.click(screen.getByTitle("Click to edit key"));
    fireEvent.change(screen.getByLabelText("Key"), { target: { value: "1:minor" } });

    await waitFor(() => expect(onSave).toHaveBeenCalledWith({ tonic: 1, mode: "minor" }));
    await waitFor(() => expect(screen.queryByLabelText("Key")).not.toBeInTheDocument());
  });

  it("clears the key with the No key option", async () => {
    const onSave = vi.fn().mockResolvedValue(true);
    render(<EditableKey value={{ tonic: 0, mode: "major" }} suggestion={null} onSave={onSave} />);
    fireEvent.click(screen.getByTitle("Click to edit key"));
    fireEvent.change(screen.getByLabelText("Key"), { target: { value: "" } });
    await waitFor(() => expect(onSave).toHaveBeenCalledWith(null));
  });

  it("does not save when the same key is picked", async () => {
    const onSave = vi.fn();
    render(<EditableKey value={{ tonic: 0, mode: "major" }} suggestion={null} onSave={onSave} />);
    fireEvent.click(screen.getByTitle("Click to edit key"));
    fireEvent.change(screen.getByLabelText("Key"), { target: { value: "0:major" } });
    await waitFor(() => expect(screen.queryByLabelText("Key")).not.toBeInTheDocument());
    expect(onSave).not.toHaveBeenCalled();
  });

  it("shows an error and stays open when saving fails", async () => {
    const onSave = vi.fn().mockResolvedValue(false);
    render(<EditableKey value={null} suggestion={null} onSave={onSave} />);
    fireEvent.click(screen.getByTitle("Click to edit key"));
    fireEvent.change(screen.getByLabelText("Key"), { target: { value: "5:major" } });
    expect(await screen.findByText("Failed")).toBeInTheDocument();
    expect(screen.getByLabelText("Key")).toBeInTheDocument();
  });

  it("closes on Escape without saving", () => {
    const onSave = vi.fn();
    render(<EditableKey value={null} suggestion={null} onSave={onSave} />);
    fireEvent.click(screen.getByTitle("Click to edit key"));
    fireEvent.keyDown(screen.getByLabelText("Key"), { key: "Escape" });
    expect(screen.queryByLabelText("Key")).not.toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
  });
});
