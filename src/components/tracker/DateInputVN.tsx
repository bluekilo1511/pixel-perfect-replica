import { useEffect, useRef, useState } from "react";
import { formatDateVN, parseDateVN } from "@/lib/tracker/exams";
import { Input } from "@/components/ui/input";

/**
 * Vietnamese date input: user types dd/mm/yyyy, parent keeps YYYY-MM-DD.
 * Typing auto-inserts the slashes; an invalid day/month reverts on blur.
 */
export function DateInputVN({
  value,
  onChange,
  className,
  ariaLabel,
  placeholder = "dd/mm/yyyy",
  max,
}: {
  value: string;
  onChange: (iso: string) => void;
  className?: string;
  ariaLabel?: string;
  placeholder?: string;
  /** Optional ISO upper bound (e.g. today) — later dates are rejected. */
  max?: string;
}) {
  const [text, setText] = useState(() => formatDateVN(value));
  const lastValue = useRef(value);
  useEffect(() => {
    if (value !== lastValue.current) {
      lastValue.current = value;
      setText(formatDateVN(value));
    }
  }, [value]);
  const handleChange = (raw: string) => {
    const digits = raw.replace(/\D/g, "").slice(0, 8);
    let out = digits;
    if (digits.length > 4) out = `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
    else if (digits.length > 2) out = `${digits.slice(0, 2)}/${digits.slice(2)}`;
    setText(out);
    const iso = parseDateVN(out);
    if (iso && max && iso > max) return;
    if (iso) {
      lastValue.current = iso;
      onChange(iso);
    } else if (!out) {
      lastValue.current = "";
      onChange("");
    }
  };
  return (
    <Input
      inputMode="numeric"
      className={className}
      value={text}
      placeholder={placeholder}
      title="Nhập ngày kiểu Việt Nam dd/mm/yyyy"
      aria-label={ariaLabel}
      onChange={(e) => handleChange(e.target.value)}
      onBlur={() => setText(formatDateVN(lastValue.current))}
    />
  );
}
