"use client";

import { Lock } from "lucide-react";
import { Dashboard } from "@/components/dashboard/dashboard";
import { ThemeToggle } from "@/components/theme-toggle";
import { Welcome } from "@/components/welcome";
import { isEmpty } from "@/lib/dataset";
import { useAnalytics } from "@/lib/use-analytics";
import { siteConfig } from "@/site.config";

export default function Home() {
  const { dataset, loading, importFiles, loadDemo, clear, exportJson } = useAnalytics();

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b">
        <div className="mx-auto max-w-6xl px-4 h-14 flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- static export, no image optimisation */}
          <img src={`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/logo.svg`} alt="" className="h-7 w-7" />
          <span className="font-semibold truncate">{siteConfig.name}</span>
          <span className="hidden sm:inline-flex items-center gap-1 text-xs text-muted-foreground ml-2">
            <Lock className="h-3 w-3" /> 100% local
          </span>
          <div className="ml-auto">
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="flex-1">
        {loading ? null : isEmpty(dataset) ? (
          <Welcome onFiles={importFiles} onDemo={loadDemo} />
        ) : (
          <Dashboard dataset={dataset} onFiles={importFiles} onClear={clear} onExportJson={exportJson} />
        )}
      </main>

      <footer className="border-t">
        <div className="mx-auto max-w-6xl px-4 py-4 text-xs text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 justify-between">
          <span>Your data never leaves your browser. Not affiliated with LinkedIn.</span>
          {siteConfig.repoUrl ? (
            <a href={siteConfig.repoUrl} className="hover:text-foreground underline-offset-4 hover:underline">
              Source code
            </a>
          ) : null}
        </div>
      </footer>
    </div>
  );
}
