/**
 * Component tests for MultiStockSelector.
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MultiStockSelector } from "@/components/MultiStockSelector";

describe("MultiStockSelector", () => {
  describe("rendering", () => {
    it("should render the component with title", () => {
      render(
        <MultiStockSelector
          selectedSymbols={[]}
          onChange={() => {}}
        />
      );

      expect(screen.getByText("Compare tickers")).toBeInTheDocument();
    });

    it("should show selected count", () => {
      render(
        <MultiStockSelector
          selectedSymbols={["AAPL", "MSFT"]}
          onChange={() => {}}
          maxSelected={4}
        />
      );

      // The count is displayed as "2 / 4" inside a badge
      expect(screen.getByText(/2.*\/.*4/)).toBeInTheDocument();
    });

    it("should render all stock options", () => {
      render(
        <MultiStockSelector
          selectedSymbols={[]}
          onChange={() => {}}
        />
      );

      // Check for some known stocks
      expect(screen.getByText("AAPL")).toBeInTheDocument();
      expect(screen.getByText("MSFT")).toBeInTheDocument();
      expect(screen.getByText("GOOGL")).toBeInTheDocument();
    });

    it("should check boxes for selected symbols", () => {
      render(
        <MultiStockSelector
          selectedSymbols={["AAPL", "MSFT"]}
          onChange={() => {}}
        />
      );

      const aaplCheckbox = screen.getByRole("checkbox", { name: /AAPL/i });
      const msftCheckbox = screen.getByRole("checkbox", { name: /MSFT/i });
      const googlCheckbox = screen.getByRole("checkbox", { name: /GOOGL/i });

      expect(aaplCheckbox).toBeChecked();
      expect(msftCheckbox).toBeChecked();
      expect(googlCheckbox).not.toBeChecked();
    });
  });

  describe("interactions", () => {
    it("should call onChange when selecting a stock", async () => {
      const user = userEvent.setup();
      const handleChange = vi.fn();

      render(
        <MultiStockSelector
          selectedSymbols={["AAPL"]}
          onChange={handleChange}
        />
      );

      const msftCheckbox = screen.getByRole("checkbox", { name: /MSFT/i });
      await user.click(msftCheckbox);

      expect(handleChange).toHaveBeenCalledWith(["AAPL", "MSFT"]);
    });

    it("should call onChange when deselecting a stock", async () => {
      const user = userEvent.setup();
      const handleChange = vi.fn();

      render(
        <MultiStockSelector
          selectedSymbols={["AAPL", "MSFT"]}
          onChange={handleChange}
        />
      );

      const aaplCheckbox = screen.getByRole("checkbox", { name: /AAPL/i });
      await user.click(aaplCheckbox);

      expect(handleChange).toHaveBeenCalledWith(["MSFT"]);
    });

    it("should not allow selection beyond maxSelected", async () => {
      const user = userEvent.setup();
      const handleChange = vi.fn();

      render(
        <MultiStockSelector
          selectedSymbols={["AAPL", "MSFT"]}
          onChange={handleChange}
          maxSelected={2}
        />
      );

      const googlCheckbox = screen.getByRole("checkbox", { name: /GOOGL/i });

      // The checkbox should be disabled when at max
      expect(googlCheckbox).toBeDisabled();

      await user.click(googlCheckbox);

      // onChange should not be called
      expect(handleChange).not.toHaveBeenCalled();
    });

    it("should allow deselection when at maxSelected", async () => {
      const user = userEvent.setup();
      const handleChange = vi.fn();

      render(
        <MultiStockSelector
          selectedSymbols={["AAPL", "MSFT"]}
          onChange={handleChange}
          maxSelected={2}
        />
      );

      const aaplCheckbox = screen.getByRole("checkbox", { name: /AAPL/i });

      // Selected checkboxes should not be disabled
      expect(aaplCheckbox).not.toBeDisabled();

      await user.click(aaplCheckbox);

      expect(handleChange).toHaveBeenCalledWith(["MSFT"]);
    });
  });

  describe("disabled state", () => {
    it("should disable all checkboxes when disabled prop is true", () => {
      render(
        <MultiStockSelector
          selectedSymbols={["AAPL"]}
          onChange={() => {}}
          disabled={true}
        />
      );

      const checkboxes = screen.getAllByRole("checkbox");
      checkboxes.forEach((checkbox) => {
        expect(checkbox).toBeDisabled();
      });
    });

    it("should not call onChange when disabled", async () => {
      const user = userEvent.setup();
      const handleChange = vi.fn();

      render(
        <MultiStockSelector
          selectedSymbols={["AAPL"]}
          onChange={handleChange}
          disabled={true}
        />
      );

      const msftCheckbox = screen.getByRole("checkbox", { name: /MSFT/i });

      // Force click even though disabled
      await user.click(msftCheckbox);

      expect(handleChange).not.toHaveBeenCalled();
    });
  });

  describe("default props", () => {
    it("should default maxSelected to 4", () => {
      render(
        <MultiStockSelector
          selectedSymbols={["AAPL", "MSFT", "GOOGL"]}
          onChange={() => {}}
        />
      );

      // The count is displayed as "3 / 4" inside a badge
      expect(screen.getByText(/3.*\/.*4/)).toBeInTheDocument();
    });
  });
});
