import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getOrBootstrapCurrentEmployee } from "@/lib/data/employee";
import { Card, CardContent } from "@/components/ui/card";
import { DOCS, getDoc } from "@/components/docs/registry";

export function generateStaticParams() {
  return DOCS.map((d) => ({ slug: d.slug }));
}

export default async function DocPage({ params }: { params: Promise<{ slug: string }> }) {
  const employee = await getOrBootstrapCurrentEmployee();
  if (!employee) redirect("/login");
  if (employee.role !== "admin") redirect("/dashboard");

  const { slug } = await params;
  const doc = getDoc(slug);
  if (!doc) notFound();

  const { title, description, icon: Icon, Body } = doc;

  return (
    <div className="max-w-3xl space-y-6">
      <Link
        href="/docs"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Documentation
      </Link>

      <div className="flex items-start gap-3">
        <div className="w-11 h-11 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0">
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold">{title}</h1>
          <p className="text-muted-foreground mt-1">{description}</p>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          <Body />
        </CardContent>
      </Card>
    </div>
  );
}
