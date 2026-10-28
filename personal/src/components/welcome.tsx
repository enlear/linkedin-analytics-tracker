import { BarChart3, Database, Lock, Sparkles, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dropzone } from "@/components/import/dropzone";
import { siteConfig } from "@/site.config";

interface WelcomeProps {
  onFiles: (files: File[]) => Promise<void>;
  onDemo: () => Promise<void>;
}

export function Welcome({ onFiles, onDemo }: WelcomeProps) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:py-16 space-y-10">
      <header className="text-center space-y-4">
        <div className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs text-muted-foreground">
          <Lock className="h-3.5 w-3.5" /> Your data never leaves your browser
        </div>
        <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight">{siteConfig.name}</h1>
        <p className="text-muted-foreground max-w-xl mx-auto">
          Turn the analytics file LinkedIn already gives you into clear dashboards — impressions,
          engagement, top posts, follower growth and your audience. No account, no API, no upload.
        </p>
      </header>

      <div className="space-y-3">
        <Dropzone onFiles={onFiles} />
        <div className="text-center">
          <Button variant="link" onClick={() => void onDemo()}>
            <Sparkles className="h-4 w-4" /> No export handy? Try it with demo data
          </Button>
        </div>
      </div>

      <ExportSteps />
      <PrivacyFacts />
    </div>
  );
}

export function ExportSteps() {
  const steps = [
    <>Open LinkedIn on desktop and go to your profile.</>,
    <>
      Under <b>Analytics</b>, open <b>Post impressions</b> (or <b>Show all analytics</b> → <b>Content</b>).
    </>,
    <>Pick a date range at the top — up to the past 365 days.</>,
    <>
      Click <b>Export</b>. LinkedIn downloads an <code>.xlsx</code> file.
    </>,
    <>Drop that file above. Repeat every few months to build a longer history.</>,
  ];
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">How to get your export</h2>
      <ol className="space-y-2">
        {steps.map((step, i) => (
          <li key={i} className="flex gap-3 text-sm">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-semibold">
              {i + 1}
            </span>
            <span className="pt-0.5 text-muted-foreground">{step}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

function PrivacyFacts() {
  const facts = [
    { icon: WifiOff, title: "Parsed on your device", body: "The file is read by JavaScript in this tab. There is no server to send it to." },
    { icon: Lock, title: "Enforced, not promised", body: "A Content-Security-Policy blocks this page from contacting any other site." },
    { icon: Database, title: "Stored locally", body: "History is kept in your browser's IndexedDB. Clear it any time with one click." },
    { icon: BarChart3, title: "Open source", body: "Every line that touches your data is public and auditable." },
  ];
  return (
    <section className="grid gap-3 sm:grid-cols-2">
      {facts.map(({ icon: Icon, title, body }) => (
        <Card key={title}>
          <CardContent className="p-4 flex gap-3">
            <Icon className="h-5 w-5 text-primary shrink-0 mt-0.5" />
            <div>
              <div className="font-medium text-sm">{title}</div>
              <div className="text-sm text-muted-foreground">{body}</div>
            </div>
          </CardContent>
        </Card>
      ))}
    </section>
  );
}
