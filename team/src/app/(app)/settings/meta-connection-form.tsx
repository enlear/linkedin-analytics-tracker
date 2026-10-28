"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Facebook, Link2, Loader2, Unlink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { MetaConnectionRow } from "@/lib/data/company-analytics";
import { disconnectMetaConnection, saveMetaConnection } from "./meta-actions";

interface Props {
  existing: MetaConnectionRow | null;
}

export function MetaConnectionForm({ existing }: Props) {
  const [pageId, setPageId] = useState(existing?.pageId ?? "");
  const [pageName, setPageName] = useState(existing?.pageName ?? "");
  const [pageAccessToken, setPageAccessToken] = useState("");
  const [instagramAccountId, setInstagramAccountId] = useState(
    existing?.instagramAccountId ?? "",
  );
  const [instagramUsername, setInstagramUsername] = useState(
    existing?.instagramUsername ?? "",
  );
  const [pending, startTransition] = useTransition();
  const [disconnecting, startDisconnect] = useTransition();

  const connected = existing !== null;

  function handleSave() {
    if (!pageId.trim()) {
      toast.error("Page ID is required.");
      return;
    }
    if (!connected && !pageAccessToken.trim()) {
      toast.error("Page Access Token is required for a new connection.");
      return;
    }
    startTransition(async () => {
      try {
        const res = await saveMetaConnection({
          pageId: pageId.trim(),
          pageName: pageName.trim() || null,
          pageAccessToken: pageAccessToken.trim() || null,
          instagramAccountId: instagramAccountId.trim() || null,
          instagramUsername: instagramUsername.trim() || null,
        });
        if (!res.ok) throw new Error(res.message);
        toast.success("Facebook connection saved.");
        setPageAccessToken("");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Save failed.");
      }
    });
  }

  function handleDisconnect() {
    if (!existing) return;
    if (!confirm("Disconnect Facebook? Stored data stays intact.")) return;
    startDisconnect(async () => {
      try {
        const res = await disconnectMetaConnection();
        if (!res.ok) throw new Error(res.message);
        toast.success("Disconnected.");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Disconnect failed.");
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm">
        <Facebook className="w-4 h-4 text-blue-600" />
        {connected ? (
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
            Connected
            {existing?.pageName ? (
              <span className="text-muted-foreground">· {existing.pageName}</span>
            ) : null}
          </span>
        ) : (
          <span className="text-muted-foreground">Not connected</span>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="meta-page-id">Page ID</Label>
          <Input
            id="meta-page-id"
            value={pageId}
            onChange={(e) => setPageId(e.target.value)}
            placeholder="e.g. 123456789012345"
            disabled={pending || disconnecting}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="meta-page-name">Page name (optional)</Label>
          <Input
            id="meta-page-name"
            value={pageName}
            onChange={(e) => setPageName(e.target.value)}
            placeholder="Shown next to the connection status"
            disabled={pending || disconnecting}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="meta-token">
          Page Access Token
          {connected ? (
            <span className="ml-2 text-xs text-muted-foreground">
              (leave blank to keep the current token)
            </span>
          ) : null}
        </Label>
        <Input
          id="meta-token"
          type="password"
          value={pageAccessToken}
          onChange={(e) => setPageAccessToken(e.target.value)}
          placeholder="EAAB..."
          disabled={pending || disconnecting}
          autoComplete="off"
        />
        <p className="text-xs text-muted-foreground">
          Generate one in{" "}
          <a
            href="https://developers.facebook.com/tools/explorer/"
            target="_blank"
            rel="noreferrer"
            className="text-primary hover:underline"
          >
            Graph API Explorer
          </a>
          {" "}with scopes <code className="font-mono text-[11px]">pages_read_engagement</code>
          {", "}<code className="font-mono text-[11px]">read_insights</code>
          {", "}<code className="font-mono text-[11px]">pages_show_list</code>
          {", and (for Instagram) "}<code className="font-mono text-[11px]">instagram_basic</code>
          {" + "}<code className="font-mono text-[11px]">instagram_manage_insights</code>
          . Token stays admin-only — never sent back to the browser after save.
        </p>
      </div>

      {/* ----- Instagram (optional, uses the same token) ------------------- */}
      <div className="rounded-md border border-border bg-muted/20 p-3 space-y-3">
        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Instagram (optional)
        </div>
        <p className="text-xs text-muted-foreground">
          Instagram Business accounts linked to this Facebook Page can be
          fetched with the same token. Find the IG Business Account ID with
          this Graph Explorer query (paste your Page Token first):{" "}
          <code className="font-mono text-[11px]">{`{page-id}?fields=instagram_business_account{id,username}`}</code>
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="ig-account-id">Instagram Business Account ID</Label>
            <Input
              id="ig-account-id"
              value={instagramAccountId}
              onChange={(e) => setInstagramAccountId(e.target.value)}
              placeholder="e.g. 17841405822304914"
              disabled={pending || disconnecting}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ig-username">Instagram username (optional)</Label>
            <Input
              id="ig-username"
              value={instagramUsername}
              onChange={(e) => setInstagramUsername(e.target.value)}
              placeholder="yourcompany (without @)"
              disabled={pending || disconnecting}
            />
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button onClick={handleSave} disabled={pending || disconnecting}>
          {pending ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Saving…
            </>
          ) : (
            <>
              <Link2 className="w-4 h-4" />
              {connected ? "Update" : "Connect"}
            </>
          )}
        </Button>
        {connected ? (
          <Button
            variant="outline"
            onClick={handleDisconnect}
            disabled={pending || disconnecting}
          >
            {disconnecting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Unlink className="w-4 h-4" />
            )}
            Disconnect
          </Button>
        ) : null}
      </div>
    </div>
  );
}
