import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { getOrBootstrapCurrentEmployee } from "@/lib/data/employee";
import { Card, CardContent } from "@/components/ui/card";
import { DOCS } from "@/components/docs/registry";
import { siteConfig } from "@/site.config";

export default async function DocsPage() {
  const employee = await getOrBootstrapCurrentEmployee();
  if (!employee) redirect("/login");
  if (employee.role !== "admin") redirect("/dashboard");

  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Documentation</h1>
        <p className="text-muted-foreground mt-1">
          Reference notes on how {siteConfig.name} works — scoring, tracking periods, and uploads.
        </p>
      </div>

      <div className="space-y-3">
        {DOCS.map(({ slug, title, description, icon: Icon }) => (
          <Link key={slug} href={`/docs/${slug}`} className="block group">
            <Card className="transition-colors group-hover:border-primary/40 group-hover:bg-accent/30">
              <CardContent className="flex items-center gap-4 py-4">
                <div className="w-10 h-10 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <Icon className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{title}</div>
                  <div className="text-sm text-muted-foreground">{description}</div>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
