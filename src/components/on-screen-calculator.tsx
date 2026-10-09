"use client";

import { useState } from "react";
import { Calculator, X } from "lucide-react";
import { CalculatorKey, initialCalculatorState, pressCalculatorKey } from "@/lib/calculator";

const keys: Array<Array<{ label: string; value: CalculatorKey; className?: string }>> = [
  [
    { label: "C", value: "clear", className: "calculator-utility" },
    { label: "⌫", value: "backspace", className: "calculator-utility" },
    { label: "√", value: "sqrt", className: "calculator-utility" },
    { label: "÷", value: "divide", className: "calculator-operator" },
  ],
  [
    { label: "7", value: "7" }, { label: "8", value: "8" }, { label: "9", value: "9" },
    { label: "×", value: "multiply", className: "calculator-operator" },
  ],
  [
    { label: "4", value: "4" }, { label: "5", value: "5" }, { label: "6", value: "6" },
    { label: "−", value: "subtract", className: "calculator-operator" },
  ],
  [
    { label: "1", value: "1" }, { label: "2", value: "2" }, { label: "3", value: "3" },
    { label: "+", value: "add", className: "calculator-operator" },
  ],
  [
    { label: "%", value: "percent", className: "calculator-utility" },
    { label: "±", value: "sign", className: "calculator-utility" },
    { label: "0", value: "0" }, { label: ".", value: "." },
  ],
];

function CalculatorPanel({ onClose }: { onClose: () => void }) {
  const [state, setState] = useState(initialCalculatorState);
  return <section className="test-calculator" id="test-calculator" aria-label="On-screen calculator">
    <div className="test-calculator-heading"><div><span>QUANTROOM</span><strong>Calculator</strong></div><button type="button" aria-label="Close calculator" onClick={onClose}><X size={16}/></button></div>
    <output className="calculator-display" aria-label="Calculator display" aria-live="polite">{state.display}</output>
    <div className="calculator-keys">
      {keys.flat().map(({ label, value, className }) => <button type="button" key={value} className={className ?? ""} aria-label={label === "⌫" ? "Backspace" : label} onClick={() => setState((current) => pressCalculatorKey(current, value))}>{label}</button>)}
      <button type="button" className="calculator-equals" aria-label="Equals" onClick={() => setState((current) => pressCalculatorKey(current, "equals"))}>=</button>
    </div>
  </section>;
}

export function OnScreenCalculatorDock() {
  const [open, setOpen] = useState(false);
  return <div className="exam-calculator-dock">
    {open && <CalculatorPanel onClose={() => setOpen(false)}/>}
    <button type="button" className="exam-calculator-toggle" aria-expanded={open} aria-controls="test-calculator" onClick={() => setOpen((current) => !current)}>
      <Calculator size={17}/><span>{open ? "Close calculator" : "Calculator"}</span>
    </button>
  </div>;
}
