import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merge Tailwind class names safely.
 * Resolves conflicts (e.g. "px-2 px-4" -> "px-4") and de-dupes.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
