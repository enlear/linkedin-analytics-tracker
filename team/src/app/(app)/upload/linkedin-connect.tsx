"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Linkedin,
  Loader2,
  RefreshCw,
  Unlink,
  CheckCircle2,
  AlertCircle,
  ShieldAlert,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { LinkedInConnectionStatus } from "@/lib/data/linkedin-connection";
import type { SyncOutcome } from "@/lib/linkedin-api/outcome";
import { disconnectLinkedIn, getLinkedInAuthUrl, syncLinkedIn } from "./linkedin-actions";

// Scopes the sync needs; mirrors REQUIRED_SYNC_SCOPES in
// src/lib/linkedin-api/config.ts (server-only, so it can't be imported here).
const REQUIRED_SCOPES = ["r_member_postAnalytics", "r_member_social"];

interface Props {
  connection: LinkedInConnectionStatus | null;
  /** Report month (YYYY-MM-01) the "Sync now" button pulls. */
  reportMonthIso: string;
  reportMonthLabel: string;
  /** Result of the most recent OAuth callback, surfaced via ?linkedin=… */
  callbackStatus?: string;
  callbackError?: string;
}

export function LinkedInConnect({
  connection,
  reportMonthIso,
  reportMonthLabel,
  callbackStatus,
  callbackError,
}: Props) {
  const router = useRouter();
  const [connecting, startConnect] = useTransition();
  const [syncing, startSync] = useTransition();
  const [disconnecting, startDisconnect] = useTransition();
  const [syncOutcome, setSyncOutcome] = useState<SyncOutcome | null>(null);

  const connected = connection?.status === "connected";
  const granted = (connection?.grantedScopes ?? "").split(/\s+/).filter(Boolean);
  const missingScopes = connected
    ? REQUIRED_SCOPES.filter((s) => !granted.includes(s))
    : [];
  const permissionMissing = connected && missingScopes.length > 0;
  const busy = connecting || syncing || disconnecting;

  // ----- actions -----------------------------------------------------------
  function handleConnect() {
    startConnect(async () => {
      try {
        const outcome = await getLinkedInAuthUrl();
        if (!outcome.ok) {
          throw new Error(outcome.message || "Could not start the LinkedIn connection.");
        }
        // Hand off to LinkedIn's consent screen.
        window.location.href = outcome.url;
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Connection failed to start.");
      }
    });
  }

  function handleSync() {
    setSyncOutcome(null);
    startSync(async () => {
      try {
        const outcome = await syncLinkedIn(reportMonthIso);
        setSyncOutcome(outcome);
        if (outcome.ok) {
          toast.success(outcome.message || "Sync complete.");
          router.refresh();
        } else {
          toast.error(outcome.message || "Sync failed.");
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Sync failed.";
        setSyncOutcome({ ok: false, code: "fetch_failed", message: msg });
        toast.error(msg);
      }
    });
  }

  function handleDisconnect() {
    if (!confirm("Disconnect LinkedIn? Already-imported posts stay intact.")) return;
    startDisconnect(async () => {
      try {
        const outcome = await disconnectLinkedIn();
        if (!outcome.ok) throw new Error(outcome.message);
        toast.success("Disconnected from LinkedIn.");
        setSyncOutcome(null);
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Disconnect failed.");
      }
    });
  }

  // ----- status banner -----------------------------------------------------
  let banner: React.ReactNode = null;
  if (callbackStatus === "error") {
    banner = (
      <StateBox tone="error" icon={<AlertCircle className="w-4 h-4" />} title="Couldn’t connect LinkedIn">
        {callbackError || "The authorization was cancelled or failed. Please try again."}
      </StateBox>
    );
  } else if (callbackStatus === "connected") {
    banner = (
      <StateBox tone="success" icon={<CheckCircle2 className="w-4 h-4" />} title="LinkedIn connected">
        Your LinkedIn account is connected. Use “Sync now” to import {reportMonthLabel}.
      </StateBox>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Linkedin className="w-4 h-4 text-[#0a66c2]" />
          Connect LinkedIn (experimental)
          <Badge variant="outline" className="ml-1 text-[10px] uppercase tracking-wide">
            Beta
          </Badge>
        </CardTitle>
        <CardDescription>
          Import your own post analytics automatically via LinkedIn’s official
          API instead of exporting and uploading each file. Uploading still
          works as a fallback.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {banner}

        {/* Connection status line */}
        <div className="flex items-center gap-2 text-sm">
          {connected ? (
            permissionMissing ? (
              <span className="flex items-center gap-1.5 text-amber-600">
                <ShieldAlert className="w-4 h-4" />
                Connected — extra permission needed
              </span>
            ) : (
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
                Connected
                {connection?.lastSyncedAt ? (
                  <span className="text-muted-foreground">
                    · last synced {formatDateTime(connection.lastSyncedAt)}
                  </span>
                ) : null}
              </span>
            )
          ) : connection?.status === "error" ? (
            <span className="flex items-center gap-1.5 text-destructive">
              <AlertCircle className="w-4 h-4" />
              Connection error — reconnect needed
            </span>
          ) : (
            <span className="text-muted-foreground">Not connected</span>
          )}
        </div>

        {/* Permission-missing detail */}
        {permissionMissing ? (
          <StateBox
            tone="warn"
            icon={<ShieldAlert className="w-4 h-4" />}
            title="Missing LinkedIn permission"
          >
            This integration needs{" "}
            {missingScopes.map((s) => (
              <code key={s} className="font-mono text-[11px] bg-muted px-1 py-0.5 rounded mr-1">
                {s}
              </code>
            ))}
            . Reconnect and approve every requested permission.
          </StateBox>
        ) : null}

        {/* Sync outcome (success / failure / permission) */}
        {syncOutcome?.ok ? (
          <StateBox tone="success" icon={<CheckCircle2 className="w-4 h-4" />} title="Sync successful">
            Imported {syncOutcome.summary.written} new post(s) for{" "}
            {reportMonthLabel}. {syncOutcome.summary.skipped} already on file
            {syncOutcome.summary.failed > 0
              ? `, ${syncOutcome.summary.failed} couldn’t be read`
              : ""}
            .
            {syncOutcome.summary.truncated ? (
              <span className="block mt-1 text-xs">
                Note: only your most recent posts were scanned — older posts may
                not be included.
              </span>
            ) : null}
          </StateBox>
        ) : null}
        {syncOutcome && !syncOutcome.ok && syncOutcome.code === "permission_missing" ? (
          <StateBox tone="warn" icon={<ShieldAlert className="w-4 h-4" />} title="Permission missing">
            {syncOutcome.message}
          </StateBox>
        ) : null}
        {syncOutcome && !syncOutcome.ok && syncOutcome.code !== "permission_missing" ? (
          <StateBox tone="error" icon={<AlertCircle className="w-4 h-4" />} title="Fetch failed">
            {syncOutcome.message || "Could not fetch your analytics. Try again shortly."}
          </StateBox>
        ) : null}

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-2">
          {!connected || connection?.status === "error" ? (
            <Button onClick={handleConnect} disabled={busy}>
              {connecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Linkedin className="w-4 h-4" />}
              {connection?.status === "error" ? "Reconnect LinkedIn" : "Connect LinkedIn"}
            </Button>
          ) : null}

          {connected && permissionMissing ? (
            <Button onClick={handleConnect} disabled={busy}>
              {connecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Linkedin className="w-4 h-4" />}
              Reconnect &amp; grant access
            </Button>
          ) : null}

          {connected && !permissionMissing ? (
            <Button onClick={handleSync} disabled={busy}>
              {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              Sync {reportMonthLabel}
            </Button>
          ) : null}

          {connected ? (
            <Button variant="outline" onClick={handleDisconnect} disabled={busy}>
              {disconnecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Unlink className="w-4 h-4" />}
              Disconnect
            </Button>
          ) : null}
        </div>

        <p className="text-xs text-muted-foreground">
          We only access your own posts, only after you authorize it, and only
          the metrics shown on the leaderboard (impressions &amp; reach). You can
          disconnect anytime. Imported posts are deduplicated against your
          uploads by post URL.
        </p>
      </CardContent>
    </Card>
  );
}

function StateBox({
  tone,
  icon,
  title,
  children,
}: {
  tone: "success" | "error" | "warn";
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  const cls =
    tone === "success"
      ? "border-emerald-500/30 bg-emerald-500/5"
      : tone === "warn"
        ? "border-amber-500/40 bg-amber-500/5"
        : "border-destructive/40 bg-destructive/5";
  return (
    <div className={`rounded-lg border ${cls} p-3 space-y-1`}>
      <div className="flex items-center gap-2 text-sm font-medium">
        {icon}
        {title}
      </div>
      <p className="text-sm text-muted-foreground">{children}</p>
    </div>
  );
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
