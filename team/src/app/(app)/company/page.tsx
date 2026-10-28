import { redirect } from "next/navigation";
import { getOrBootstrapCurrentEmployee } from "@/lib/data/employee";
import {
  fetchCompanyMetricsForUpload,
  fetchCompanyPostsForUpload,
  fetchFacebookMetricsForUpload,
  fetchInstagramMetricsForUpload,
  fetchMetaConnection,
  fetchTiktokMetricsForUpload,
  listCompanyUploads,
  type CompanyDailyMetricRow,
  type CompanyPostRow,
  type CompanyUploadSummary,
  type FacebookDailyMetricRow,
  type InstagramDailyMetricRow,
  type MetaConnectionRow,
  type SocialPlatform,
  type TiktokDailyMetricRow,
} from "@/lib/data/company-analytics";
import { CompanyAnalyticsView } from "./company-view";

interface PageProps {
  searchParams: Promise<{ upload?: string; platform?: string }>;
}

const KNOWN_PLATFORMS: SocialPlatform[] = ["linkedin", "tiktok", "facebook", "instagram"];

function parsePlatform(raw: string | undefined): SocialPlatform {
  return KNOWN_PLATFORMS.includes(raw as SocialPlatform)
    ? (raw as SocialPlatform)
    : "linkedin";
}

// Server actions run in this page's function. The Facebook/Instagram fetches
// make several Graph API calls, so allow them more than the host's default time.
export const maxDuration = 60;

export default async function CompanyAnalyticsPage({ searchParams }: PageProps) {
  const me = await getOrBootstrapCurrentEmployee();
  if (!me) redirect("/login");
  if (me.role !== "admin") redirect("/dashboard");

  let allUploads: CompanyUploadSummary[] = [];
  let metrics: CompanyDailyMetricRow[] = [];
  let posts: CompanyPostRow[] = [];
  let previousMetrics: CompanyDailyMetricRow[] = [];
  let tiktokMetrics: TiktokDailyMetricRow[] = [];
  let previousTiktokMetrics: TiktokDailyMetricRow[] = [];
  let facebookMetrics: FacebookDailyMetricRow[] = [];
  let previousFacebookMetrics: FacebookDailyMetricRow[] = [];
  let instagramMetrics: InstagramDailyMetricRow[] = [];
  let previousInstagramMetrics: InstagramDailyMetricRow[] = [];
  let metaConnected = false;
  let instagramConnected = false;
  let previousLabel: string | null = null;
  let selectedId: string | undefined;
  let fetchError: string | null = null;

  const params = await searchParams;
  const platform = parsePlatform(params.platform);

  try {
    try {
      allUploads = await listCompanyUploads();
    } catch (e) {
      console.error("[company] listCompanyUploads failed:", e);
      fetchError = e instanceof Error ? e.message : "Could not load company analytics.";
    }

    // Filter to the currently-active platform tab.
    const platformUploads = allUploads.filter((u) => u.platform === platform);

    selectedId =
      params.upload && platformUploads.some((u) => u.id === params.upload)
        ? params.upload
        : platformUploads[0]?.id;

    // Facebook + Instagram tabs need to know if the connection exists, even
    // before a fetch has happened, so the empty-state can offer the right CTA.
    if (platform === "facebook" || platform === "instagram") {
      try {
        const conn: MetaConnectionRow | null = await fetchMetaConnection();
        metaConnected = conn !== null;
        instagramConnected = !!conn?.instagramAccountId;
      } catch (e) {
        console.error("[company] fetchMetaConnection failed:", e);
      }
    }

    if (selectedId) {
      const idx = platformUploads.findIndex((u) => u.id === selectedId);
      const prevUpload = idx >= 0 ? platformUploads[idx + 1] : undefined;

      try {
        if (platform === "tiktok") {
          const [t, pt] = await Promise.all([
            fetchTiktokMetricsForUpload(selectedId),
            prevUpload
              ? fetchTiktokMetricsForUpload(prevUpload.id)
              : Promise.resolve([] as TiktokDailyMetricRow[]),
          ]);
          tiktokMetrics = t;
          previousTiktokMetrics = pt;
        } else if (platform === "facebook") {
          const [f, pf] = await Promise.all([
            fetchFacebookMetricsForUpload(selectedId),
            prevUpload
              ? fetchFacebookMetricsForUpload(prevUpload.id)
              : Promise.resolve([] as FacebookDailyMetricRow[]),
          ]);
          facebookMetrics = f;
          previousFacebookMetrics = pf;
        } else if (platform === "instagram") {
          const [i, pi] = await Promise.all([
            fetchInstagramMetricsForUpload(selectedId),
            prevUpload
              ? fetchInstagramMetricsForUpload(prevUpload.id)
              : Promise.resolve([] as InstagramDailyMetricRow[]),
          ]);
          instagramMetrics = i;
          previousInstagramMetrics = pi;
        } else {
          // LinkedIn (default).
          const [m, p, pm] = await Promise.all([
            fetchCompanyMetricsForUpload(selectedId),
            fetchCompanyPostsForUpload(selectedId),
            prevUpload
              ? fetchCompanyMetricsForUpload(prevUpload.id)
              : Promise.resolve([] as CompanyDailyMetricRow[]),
          ]);
          metrics = m;
          posts = p;
          previousMetrics = pm;
        }
        previousLabel = prevUpload?.monthLabel ?? null;
      } catch (e) {
        console.error("[company] platform fetch failed:", e);
        fetchError = e instanceof Error ? e.message : "Could not load metrics for this upload.";
      }
    }
  } catch (e) {
    console.error("[company] page body failed:", e);
    fetchError = e instanceof Error ? e.message : "Unexpected error rendering /company.";
  }

  return (
    <CompanyAnalyticsView
      platform={platform}
      uploads={allUploads}
      selectedUploadId={selectedId ?? null}
      metrics={metrics}
      posts={posts}
      previousMetrics={previousMetrics}
      tiktokMetrics={tiktokMetrics}
      previousTiktokMetrics={previousTiktokMetrics}
      facebookMetrics={facebookMetrics}
      previousFacebookMetrics={previousFacebookMetrics}
      instagramMetrics={instagramMetrics}
      previousInstagramMetrics={previousInstagramMetrics}
      metaConnected={metaConnected}
      instagramConnected={instagramConnected}
      previousLabel={previousLabel}
      fetchError={fetchError}
    />
  );
}
