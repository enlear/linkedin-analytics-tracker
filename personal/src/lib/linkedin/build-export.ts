import * as XLSX from "xlsx";
import type { DateRange, DemographicEntry, IsoDate } from "./types";

// Writes a workbook in the same layout as LinkedIn's Analytics → Content
// export. Used for the in-app demo (so the demo exercises the real parser)
// and as the fixture builder in tests. All data passed in here is synthetic.

export type DateStyle = "mdy" | "dmy" | "iso" | "excel";

export interface ExportSpec {
  period: DateRange;
  impressions: number;
  membersReached: number;
  daily: { date: IsoDate; impressions: number; engagements: number }[];
  totalFollowers: number;
  newFollowers: { date: IsoDate; newFollowers: number }[];
  topByEngagements: { url: string; publishedOn: IsoDate; engagements: number }[];
  topByImpressions: { url: string; publishedOn: IsoDate; impressions: number }[];
  demographics: DemographicEntry[];
}

export interface BuildOptions {
  dateStyle?: DateStyle;
  /** Rename or drop (null) sheets to simulate other export variants. */
  sheetNames?: Partial<Record<keyof typeof DEFAULT_SHEETS, string | null>>;
  /** Write shares as "5%" text instead of 0.05 numbers. */
  sharesAsText?: boolean;
}

const DEFAULT_SHEETS = {
  discovery: "DISCOVERY",
  engagement: "ENGAGEMENT",
  topPosts: "TOP POSTS",
  followers: "FOLLOWERS",
  demographics: "DEMOGRAPHICS",
};

export function buildExportWorkbook(spec: ExportSpec, opts: BuildOptions = {}): XLSX.WorkBook {
  const fmt = (d: IsoDate) => formatDate(d, opts.dateStyle ?? "mdy");
  const names = { ...DEFAULT_SHEETS, ...opts.sheetNames };
  const wb = XLSX.utils.book_new();
  const add = (key: keyof typeof DEFAULT_SHEETS, rows: unknown[][]) => {
    const name = names[key];
    if (name) XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), name);
  };

  add("discovery", [
    ["Overall Performance", `${fmt(spec.period.start)} - ${fmt(spec.period.end)}`],
    ["Impressions", spec.impressions],
    ["Members reached", spec.membersReached],
  ]);

  add("engagement", [
    ["Date", "Impressions", "Engagements"],
    ...spec.daily.map((d) => [fmt(d.date), d.impressions, d.engagements]),
  ]);

  const postRows = Math.max(spec.topByEngagements.length, spec.topByImpressions.length);
  add("topPosts", [
    ["Maximum of 50 posts available to include in this list"],
    [],
    ["Post URL", "Post publish date", "Engagements", null, "Post URL", "Post publish date", "Impressions"],
    ...Array.from({ length: postRows }, (_, i) => {
      const e = spec.topByEngagements[i];
      const m = spec.topByImpressions[i];
      return [
        e?.url ?? null,
        e ? fmt(e.publishedOn) : null,
        e?.engagements ?? null,
        null,
        m?.url ?? null,
        m ? fmt(m.publishedOn) : null,
        m?.impressions ?? null,
      ];
    }),
  ]);

  add("followers", [
    [`Total followers on ${fmt(spec.period.end)}:`, spec.totalFollowers],
    [],
    ["Date", "New followers"],
    ...spec.newFollowers.map((d) => [fmt(d.date), d.newFollowers]),
  ]);

  add("demographics", [
    ["Top Demographics", "Value", "Percentage"],
    ...spec.demographics.map((d) => [
      d.category,
      d.value,
      opts.sharesAsText ? (d.share < 0.01 ? "< 1%" : `${Math.round(d.share * 100)}%`) : d.share,
    ]),
  ]);

  return wb;
}

export function workbookToBytes(wb: XLSX.WorkBook): Uint8Array {
  return new Uint8Array(XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer);
}

function formatDate(iso: IsoDate, style: DateStyle): string | number {
  const [y, m, d] = iso.split("-").map(Number);
  switch (style) {
    case "iso":
      return iso;
    case "dmy":
      return `${d}/${m}/${y}`;
    case "excel":
      // Days since 1899-12-30, Excel's epoch.
      return Date.UTC(y, m - 1, d) / 86_400_000 + 25_569;
    case "mdy":
      return `${m}/${d}/${y}`;
  }
}

// ---------------------------------------------------------------------------
// Demo data — a plausible 90 days for a fictional creator.
// ---------------------------------------------------------------------------

export function createDemoSpec(endDate: Date = new Date(), days = 90): ExportSpec {
  const rand = mulberry32(42);
  const end = Date.UTC(endDate.getUTCFullYear(), endDate.getUTCMonth(), endDate.getUTCDate());
  const iso = (t: number) => new Date(t).toISOString().slice(0, 10);
  const dates = Array.from({ length: days }, (_, i) => iso(end - (days - 1 - i) * 86_400_000));

  // Posting ~2x a week, mostly Tue/Thu; a post lifts the next few days.
  const postDays = dates.filter((d) => {
    const dow = new Date(d).getUTCDay();
    return (dow === 2 || dow === 4) && rand() < 0.8;
  });
  const boost = new Map<IsoDate, number>();
  for (const d of postDays) {
    const t = Date.parse(d);
    const size = 400 + rand() * 2600;
    for (let k = 0; k < 4; k++) {
      const day = iso(t + k * 86_400_000);
      boost.set(day, (boost.get(day) ?? 0) + size / 2 ** k);
    }
  }

  const daily = dates.map((date, i) => {
    const weekend = [0, 6].includes(new Date(date).getUTCDay());
    const impressions = Math.round((weekend ? 60 : 140) + i * 1.5 + rand() * 80 + (boost.get(date) ?? 0));
    return { date, impressions, engagements: Math.round(impressions * (0.02 + rand() * 0.03)) };
  });

  const posts = postDays.map((publishedOn, i) => {
    const impressions = Math.round(800 + rand() * 9000);
    return {
      url: `https://www.linkedin.com/feed/update/urn:li:activity:demo${String(i + 1).padStart(4, "0")}`,
      publishedOn,
      impressions,
      engagements: Math.round(impressions * (0.015 + rand() * 0.05)),
    };
  });
  const top = (key: "impressions" | "engagements") =>
    [...posts].sort((a, b) => b[key] - a[key]).slice(0, 50);

  const newFollowers = dates.map((date) => ({
    date,
    newFollowers: Math.round(rand() * 6 + (boost.get(date) ?? 0) / 300),
  }));
  const gained = newFollowers.reduce((s, d) => s + d.newFollowers, 0);

  const demo = (category: string, values: [string, number][]) =>
    values.map(([value, share]) => ({ category, value, share }));

  const totalImpressions = daily.reduce((s, d) => s + d.impressions, 0);
  return {
    period: { start: dates[0], end: dates[dates.length - 1] },
    impressions: totalImpressions,
    membersReached: Math.round(totalImpressions * 0.38),
    daily,
    totalFollowers: 2400 + gained,
    newFollowers,
    topByEngagements: top("engagements").map(({ url, publishedOn, engagements }) => ({ url, publishedOn, engagements })),
    topByImpressions: top("impressions").map(({ url, publishedOn, impressions }) => ({ url, publishedOn, impressions })),
    demographics: [
      ...demo("Job titles", [["Software Engineer", 0.12], ["Product Manager", 0.07], ["Founder", 0.05], ["Data Scientist", 0.04], ["Designer", 0.03]]),
      ...demo("Locations", [["Greater London", 0.09], ["Berlin", 0.06], ["New York City Metropolitan Area", 0.05], ["Bengaluru", 0.04], ["Colombo", 0.03]]),
      ...demo("Industries", [["Software Development", 0.31], ["IT Services and IT Consulting", 0.14], ["Financial Services", 0.06], ["Higher Education", 0.04]]),
      ...demo("Seniority", [["Senior", 0.34], ["Entry", 0.22], ["Manager", 0.11], ["Director", 0.06]]),
      ...demo("Company size", [["10,001+ employees", 0.21], ["1001-5000 employees", 0.14], ["51-200 employees", 0.12], ["11-50 employees", 0.1]]),
    ],
  };
}

export function createDemoExport(): Uint8Array {
  return workbookToBytes(buildExportWorkbook(createDemoSpec()));
}

/** Small seeded PRNG so the demo looks the same on every load. */
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ (t + t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
