// Post categories — client-safe types and constants. The server fetcher lives
// in `@/lib/data/post-categories` (it pulls in next/headers, which client
// components can't import).

export interface PostCategory {
  id: string;
  name: string;
  description: string | null;
  /** Multiplier for the Content dimension of the Performance Score. */
  weight: number;
  /** Archived categories are hidden from the upload picker but still score. */
  active: boolean;
}

/**
 * Weight for posts with no category — LinkedIn API syncs, or a category that
 * has since been deleted.
 */
export const DEFAULT_CATEGORY_WEIGHT = 1;

/** Bounds enforced by the admin editor. */
export const MIN_CATEGORY_WEIGHT = 0.1;
export const MAX_CATEGORY_WEIGHT = 10;

/**
 * Starter set, seeded by supabase/migrations and offered to admins as a
 * one-click restore in Settings if the table is ever empty. Fixed ids keep both
 * paths idempotent. test/db/schema.test.ts checks the seed matches this list.
 */
export const DEFAULT_CATEGORIES: PostCategory[] = [
  {
    id: "article",
    name: "Article",
    description: "A long-form article (blog, newsletter or LinkedIn article) shared on LinkedIn.",
    weight: 2,
    active: true,
  },
  {
    id: "direct-post",
    name: "Direct post",
    description: "A short, original post written directly on LinkedIn.",
    weight: 1.5,
    active: true,
  },
  {
    id: "event-update",
    name: "Event update",
    description: "Coverage of an event — announcements, highlights, or recaps.",
    weight: 1.25,
    active: true,
  },
  {
    id: "other",
    name: "Other",
    description: "Anything that doesn't fit the categories above.",
    weight: 1,
    active: true,
  },
];

/** Heaviest first, so the picker and admin list lead with the most valued type. */
export function sortCategories<T extends Pick<PostCategory, "weight" | "name">>(rows: T[]): T[] {
  return [...rows].sort((a, b) => b.weight - a.weight || a.name.localeCompare(b.name));
}
