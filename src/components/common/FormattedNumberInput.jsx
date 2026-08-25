import React, { useState, useRef } from 'react';

/**
 * FormattedNumberInput V3.0
 * Custom numeric text input for currency & unit prices (supports DECIMALS).
 * - Formats number in Vietnamese locale (e.g. 15.000.000,5) when blurred.
 * - Shows raw text when focused for easy typing (supports '.' and ',').
 * - DISABLES mouse wheel scrolling (onWheel blur) to prevent accidental changes.
 * - DISABLES Up/Down arrow key value changes (onKeyDown preventDefault).
 * - Supports decimal values cleanly.
 */
export function FormattedNumberInput({ value, onChange, className, placeholder, style, disabled }) {
  const [focused, setFocused] = useState(false);
  const [tempText, setTempText] = useState("");
  const inputRef = useRef(null);
  const numVal = Number(value) || 0;

  const parseVal = (str) => {
    if (!str) return 0;
    const normalized = str.replace(/,/g, ".");
    const parts = normalized.split(".");
    if (parts.length > 2) {
      const integerPart = parts[0];
      const decimalPart = parts.slice(1).join("");
      const parsed = parseFloat(`${integerPart}.${decimalPart}`);
      return isNaN(parsed) ? 0 : parsed;
    }
    const parsed = parseFloat(normalized);
    return isNaN(parsed) ? 0 : parsed;
  };

  const formatDisplay = (val) => {
    if (val === 0 || isNaN(val)) return "";
    return val.toLocaleString("vi-VN", { maximumFractionDigits: 4 });
  };

  return (
    <input
      ref={inputRef}
      type="text"
      inputMode="decimal"
      className={className}
      placeholder={placeholder}
      disabled={disabled}
      value={focused ? tempText : formatDisplay(numVal)}
      style={{ textAlign: "right", ...style }}
      onFocus={() => {
        setFocused(true);
        setTempText(numVal === 0 ? "" : String(numVal));
      }}
      onBlur={() => {
        setFocused(false);
        const parsed = parseVal(tempText);
        onChange(parsed);
      }}
      onChange={e => {
        const raw = e.target.value;
        const cleaned = raw.replace(/[^0-9.,]/g, "");
        setTempText(cleaned);
        const parsed = parseVal(cleaned);
        onChange(parsed);
      }}
      onWheel={e => e.target.blur()}
      onKeyDown={e => {
        if (e.key === "ArrowUp" || e.key === "ArrowDown") {
          e.preventDefault();
        }
      }}
    />
  );
}

export function vatLabel(vatRate) {
  if (vatRate === -1) return "KCT";
  return (vatRate || 0) + "%";
}

export default FormattedNumberInput;
