import { describe, expect, it } from "vitest";
import { CalculatorKey, initialCalculatorState, pressCalculatorKey } from "./calculator";

function calculate(...keys: CalculatorKey[]) {
  return keys.reduce(pressCalculatorKey, initialCalculatorState);
}

describe("on-screen calculator", () => {
  it("calculates chained operations in the order entered", () => {
    expect(calculate("8", "add", "5", "multiply", "2", "equals").display).toBe("26");
  });

  it("handles decimal input and backspace", () => {
    expect(calculate("1", ".", "2", "3", "backspace").display).toBe("1.2");
  });

  it("supports percent, sign, and square root operations", () => {
    expect(calculate("2", "5", "percent").display).toBe("0.25");
    expect(calculate("2", "5", "sign").display).toBe("-25");
    expect(calculate("0", "sign", "3").display).toBe("-3");
    expect(calculate("9", "sqrt").display).toBe("3");
  });

  it("shows an error for division by zero and clears back to a usable state", () => {
    const error = calculate("8", "divide", "0", "equals");
    expect(error.display).toBe("Error");
    expect(pressCalculatorKey(error, "clear")).toEqual(initialCalculatorState);
    expect(pressCalculatorKey(error, "4").display).toBe("4");
  });
});
