import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? "/api") as string;

/**
 * Resolves a stored avatar_url value to a displayable URL:
 * - base64 (data:image/...) → used as-is
 * - object storage path (/objects/...) → resolved through /api/storage route
 * - external URL (https://...) → used as-is
 * - null/empty → null
 */
export function resolveAvatarUrl(avatarUrl: string | null | undefined): string | null {
  if (!avatarUrl) return null;
  if (avatarUrl.startsWith("data:")) return avatarUrl;
  if (avatarUrl.startsWith("/objects/")) return `${API_BASE}/storage${avatarUrl}`;
  return avatarUrl;
}
