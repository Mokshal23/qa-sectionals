export type CalculatorOperator = "add" | "subtract" | "multiply" | "divide";
export type CalculatorKey =
  | "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9"
  | "." | "clear" | "backspace" | "sign" | "percent" | "sqrt" | "equals"
  | CalculatorOperator;

export type CalculatorState = {
  display: string;
  storedValue: number | null;
  operator: CalculatorOperator | null;
  waitingForOperand: boolean;
  error: boolean;
};

export const initialCalculatorState: CalculatorState = {
  display: "0",
  storedValue: null,
  operator: null,
  waitingForOperand: false,
  error: false,
};

function formatResult(value: number): string {
  if (!Number.isFinite(value)) return "Error";
  if (Math.abs(value) < 1e-12) return "0";
  return Number(value.toPrecision(12)).toString();
}

function errorState(): CalculatorState {
  return { ...initialCalculatorState, display: "Error", waitingForOperand: true, error: true };
}

function operate(operator: CalculatorOperator, left: number, right: number): number | null {
  switch (operator) {
    case "add": return left + right;
    case "subtract": return left - right;
    case "multiply": return left * right;
    case "divide": return right === 0 ? null : left / right;
  }
}

function isCalculatorOperator(key: CalculatorKey): key is CalculatorOperator {
  return key === "add" || key === "subtract" || key === "multiply" || key === "divide";
}

export function pressCalculatorKey(state: CalculatorState, key: CalculatorKey): CalculatorState {
  if (key === "clear") return initialCalculatorState;

  if (/^\d$/.test(key)) {
    const base = state.error ? initialCalculatorState : state;
    const display = base.waitingForOperand || base.display === "0"
      ? key
      : base.display === "-0" ? "-" + key : base.display + key;
    return { ...base, display, waitingForOperand: false, error: false };
  }

  if (state.error) return state;

  if (key === ".") {
    if (state.waitingForOperand) return { ...state, display: "0.", waitingForOperand: false };
    if (state.display.includes(".")) return state;
    return { ...state, display: state.display + "." };
  }

  if (key === "backspace") {
    if (state.waitingForOperand) return { ...state, display: "0", waitingForOperand: false };
    const shortened = state.display.length > 1 ? state.display.slice(0, -1) : "0";
    return { ...state, display: shortened === "-" ? "0" : shortened };
  }

  const current = Number(state.display);
  if (!Number.isFinite(current)) return errorState();

  if (key === "sign") {
    if (state.waitingForOperand && state.operator) {
      return { ...state, display: "-0", waitingForOperand: false };
    }
    if (state.display === "0") return { ...state, display: "-0", waitingForOperand: false };
    return { ...state, display: formatResult(-current), waitingForOperand: false };
  }

  if (key === "percent") return { ...state, display: formatResult(current / 100), waitingForOperand: false };
  if (key === "sqrt") return current < 0 ? errorState() : { ...state, display: formatResult(Math.sqrt(current)), waitingForOperand: false };

  if (key === "equals") {
    if (!state.operator || state.storedValue === null || state.waitingForOperand) return state;
    const result = operate(state.operator, state.storedValue, current);
    return result === null ? errorState() : { ...initialCalculatorState, display: formatResult(result), waitingForOperand: true };
  }

  if (!isCalculatorOperator(key)) return state;
  if (state.operator && state.storedValue !== null && !state.waitingForOperand) {
    const result = operate(state.operator, state.storedValue, current);
    if (result === null) return errorState();
    return { ...state, display: formatResult(result), storedValue: result, operator: key, waitingForOperand: true };
  }
  return { ...state, storedValue: current, operator: key, waitingForOperand: true };
}
