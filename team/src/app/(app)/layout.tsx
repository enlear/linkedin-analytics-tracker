import { redirect } from "next/navigation";
import { Sidebar } from "@/components/nav/sidebar";
import { Topbar } from "@/components/nav/topbar";
import { MobileNavProvider } from "@/components/nav/mobile-nav";
import { getOrBootstrapCurrentEmployee } from "@/lib/data/employee";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const employee = await getOrBootstrapCurrentEmployee();
  if (!employee) redirect("/login");

  // The document itself scrolls (single native browser scrollbar). The sidebar
  // is sticky + full-height on desktop so it stays in view while the page
  // scrolls — no inner scroll container on <main>, which previously produced a
  // second scrollbar alongside the browser's. The top bar sticks to the top of
  // the content column and carries the account controls.
  return (
    <MobileNavProvider>
      <div className="flex min-h-screen">
        <Sidebar role={employee.role} />
        <div className="flex-1 flex flex-col min-w-0">
          <Topbar
            role={employee.role}
            user={{
              name: employee.name,
              email: employee.email,
              image: employee.avatarUrl,
            }}
          />
          <main className="flex-1 px-4 py-6 md:p-8">{children}</main>
        </div>
      </div>
    </MobileNavProvider>
  );
}
