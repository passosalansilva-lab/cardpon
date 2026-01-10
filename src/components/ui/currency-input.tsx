import * as React from "react";
import { cn } from "@/lib/utils";

export interface CurrencyInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value"> {
  value: string | number;
  onChange: (value: string) => void;
  /** Whether to show the R$ prefix */
  showPrefix?: boolean;
}

/**
 * Formats a numeric string to Brazilian Real currency format
 * e.g., "1234.56" -> "1.234,56"
 */
function formatToBRL(value: string | number): string {
  // Convert to string and remove non-numeric characters
  let numericValue = String(value).replace(/[^\d]/g, "");

  if (!numericValue) return "";

  // Pad with zeros if less than 3 digits (to ensure at least 0,00)
  numericValue = numericValue.padStart(3, "0");

  // Split into integer and decimal parts
  const integerPart = numericValue.slice(0, -2);
  const decimalPart = numericValue.slice(-2);

  // Remove leading zeros from integer part, but keep at least one digit
  const cleanedInteger = integerPart.replace(/^0+/, "") || "0";

  // Add thousands separators
  const withThousands = cleanedInteger.replace(/\B(?=(\d{3})+(?!\d))/g, ".");

  return `${withThousands},${decimalPart}`;
}

/**
 * Converts a formatted BRL string back to a numeric string
 * e.g., "1.234,56" -> "1234.56"
 */
function parseFromBRL(formatted: string): string {
  if (!formatted) return "";

  // Remove all non-numeric characters except comma
  const cleaned = formatted.replace(/[^\d,]/g, "");
  
  // Replace comma with dot for decimal
  const normalized = cleaned.replace(",", ".");

  // Parse as float and return as string
  const parsed = parseFloat(normalized);
  
  if (isNaN(parsed)) return "";
  
  return parsed.toFixed(2);
}

const CurrencyInput = React.forwardRef<HTMLInputElement, CurrencyInputProps>(
  ({ className, value, onChange, showPrefix = true, ...props }, ref) => {
    const [displayValue, setDisplayValue] = React.useState(() => formatToBRL(value));

    // Update display value when external value changes
    React.useEffect(() => {
      if (value !== undefined && value !== null && value !== "") {
        // Convert numeric value to cents for formatting
        const numericValue = typeof value === "number" ? value : parseFloat(value);
        if (!isNaN(numericValue)) {
          const cents = Math.round(numericValue * 100);
          setDisplayValue(formatToBRL(cents));
        }
      } else {
        setDisplayValue("");
      }
    }, [value]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const rawValue = e.target.value;
      
      // Extract only digits
      const digits = rawValue.replace(/\D/g, "");
      
      if (!digits) {
        setDisplayValue("");
        onChange("");
        return;
      }

      // Format for display
      const formatted = formatToBRL(digits);
      setDisplayValue(formatted);

      // Parse back to numeric value for the form
      const numericValue = parseFromBRL(formatted);
      onChange(numericValue);
    };

    return (
      <div className="relative">
        {showPrefix && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
            R$
          </span>
        )}
        <input
          type="text"
          inputMode="numeric"
          className={cn(
            "flex h-10 w-full rounded-md border border-input bg-background py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
            showPrefix ? "pl-10 pr-3" : "px-3",
            className
          )}
          ref={ref}
          value={displayValue}
          onChange={handleChange}
          {...props}
        />
      </div>
    );
  }
);
CurrencyInput.displayName = "CurrencyInput";

export { CurrencyInput, formatToBRL, parseFromBRL };
