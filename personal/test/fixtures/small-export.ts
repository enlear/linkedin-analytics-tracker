import type { ExportSpec } from "@/lib/linkedin/build-export";

// Tiny, fully synthetic export. Numbers are made up; URLs use example IDs.
export const SMALL_EXPORT: ExportSpec = {
  period: { start: "2025-03-01", end: "2025-03-14" },
  impressions: 1400,
  membersReached: 610,
  daily: Array.from({ length: 14 }, (_, i) => ({
    date: `2025-03-${String(i + 1).padStart(2, "0")}`,
    impressions: 100,
    engagements: i % 2 === 0 ? 4 : 2,
  })),
  totalFollowers: 500,
  newFollowers: Array.from({ length: 14 }, (_, i) => ({
    date: `2025-03-${String(i + 1).padStart(2, "0")}`,
    newFollowers: 1,
  })),
  topByEngagements: [
    { url: "https://www.linkedin.com/feed/update/urn:li:activity:1001/?utm_source=share", publishedOn: "2025-03-04", engagements: 30 },
    { url: "https://www.linkedin.com/feed/update/urn:li:activity:1002", publishedOn: "2025-03-11", engagements: 12 },
  ],
  topByImpressions: [
    { url: "https://www.linkedin.com/feed/update/urn:li:activity:1001", publishedOn: "2025-03-04", impressions: 900 },
    { url: "https://www.linkedin.com/feed/update/urn:li:activity:1003", publishedOn: "2025-03-06", impressions: 300 },
  ],
  demographics: [
    { category: "Job titles", value: "Engineer", share: 0.2 },
    { category: "Job titles", value: "Designer", share: 0.005 },
    { category: "Locations", value: "Example City", share: 0.1 },
  ],
};
