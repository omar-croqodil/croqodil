import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Safely extracts and parses JSON from a string that might contain text or markdown.
 */
export function extractAndParseJSON(str: string): any | null {
  if (!str) return null;

  try {
    // 1. Try to find JSON inside markdown code blocks
    const mdMatch = str.match(/```json\s*([\s\S]*?)\s*```/);
    if (mdMatch) {
      try {
        return JSON.parse(mdMatch[1]);
      } catch (e) {
        // Fall through if markdown block is malformed
      }
    }

    // 2. Try to find the largest balanced block starting with { and ending with }
    let firstBrace = str.indexOf('{');
    let lastBrace = str.lastIndexOf('}');

    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      const candidate = str.substring(firstBrace, lastBrace + 1);
      try {
        return JSON.parse(candidate);
      } catch (e) {
        // Fall through to smarter cleaning
      }
    }

    return null;
  } catch (error) {
    console.error("Critical error in extractAndParseJSON:", error);
    return null;
  }
}
