/** ISO calendar date, YYYY-MM-DD. */
export type IsoDate = string;

export interface DateRange {
  start: IsoDate;
  end: IsoDate;
}

export interface DailyEngagement {
  date: IsoDate;
  impressions: number;
  engagements: number;
}

export interface DailyFollowers {
  date: IsoDate;
  newFollowers: number;
}

export interface PostMetrics {
  /** Normalised post URL — the dedupe key across exports. */
  url: string;
  publishedOn: IsoDate | null;
  impressions: number | null;
  engagements: number | null;
}

export interface DemographicEntry {
  /** e.g. "Job titles", "Locations", "Industries". */
  category: string;
  value: string;
  /** Share of the audience, 0–1. */
  share: number;
}

/** Everything we could read from ONE LinkedIn Analytics → Content export. */
export interface ParsedExport {
  period: DateRange | null;
  summary: {
    impressions: number | null;
    membersReached: number | null;
  };
  daily: DailyEngagement[];
  followers: {
    total: number | null;
    totalAsOf: IsoDate | null;
    daily: DailyFollowers[];
  };
  posts: PostMetrics[];
  demographics: DemographicEntry[];
  /** Sections that were missing or unreadable. Shown to the user, never fatal. */
  warnings: string[];
}
