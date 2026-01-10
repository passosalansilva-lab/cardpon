import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Converts a hex color to RGB values
 */
export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null;
}

/**
 * Calculates the relative luminance of a color
 * Returns a value between 0 (darkest) and 1 (lightest)
 */
export function getLuminance(hex: string): number {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0.5;
  
  const { r, g, b } = rgb;
  // Using the relative luminance formula
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

/**
 * Returns true if the color is considered "light" (should use dark text)
 * Returns false if the color is considered "dark" (should use light text)
 */
export function isLightColor(hex: string): boolean {
  return getLuminance(hex) > 0.5;
}
