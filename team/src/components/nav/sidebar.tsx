"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { X } from "lucide-react";
import { useMobileNav } from "./mobile-nav";
import { navForRole } from "./nav-items";
import { cn } from "@/lib/utils";
import { siteConfig } from "@/site.config";

interface SidebarProps {
  role: "admin" | "member";
}

/**
 * Primary navigation. Account controls (theme, profile, sign out) live in the
 * top bar, so this column is purely routes. The mobile drawer's open state
 * comes from context because the button that opens it sits in the top bar.
 */
export function Sidebar({ role }: SidebarProps) {
  const pathname = usePathname();
  const { open, setOpen } = useMobileNav();

  // Auto-close the mobile drawer whenever the route changes — without this
  // the drawer stays open after navigation and the user has to close it
  // manually before they can see the new page.
  useEffect(() => {
    setOpen(false);
  }, [pathname, setOpen]);

  // Lock body scroll while the mobile drawer is open so the content behind
  // doesn't scroll under the overlay.
  useEffect(() => {
    if (typeof document === "undefined") return;
    if (open) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [open]);

  const items = navForRole(role);

  return (
    <>
      {/* Mobile backdrop — clicking it closes the drawer. */}
      {open ? (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
          onClick={() => setOpen(false)}
          aria-hidden
        />
      ) : null}

      <aside
        className={cn(
          "w-60 border-r border-sidebar-border bg-sidebar text-sidebar-foreground flex flex-col",
          // Mobile: fixed overlay, slides in from the left.
          "fixed inset-y-0 left-0 z-50 transition-transform duration-200 ease-out",
          open ? "translate-x-0" : "-translate-x-full",
          // Desktop: sticky full-height column so it stays in view while the
          // document (not an inner container) scrolls.
          "md:sticky md:top-0 md:h-screen md:self-start md:translate-x-0 md:z-0 md:transition-none",
        )}
      >
        <div className="px-6 py-5 flex items-center gap-2">
          <Image
            src={siteConfig.logoUrl}
            alt=""
            unoptimized
            width={32}
            height={32}
            priority
            className="h-8 w-auto"
          />
          <div className="font-semibold flex-1">{siteConfig.name}</div>
          {/* Mobile close button */}
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="md:hidden h-8 w-8 rounded-md hover:bg-sidebar-accent/60 flex items-center justify-center text-muted-foreground"
            aria-label="Close navigation menu"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <nav className="px-3 pb-3 flex flex-col gap-1 flex-1 min-h-0 overflow-y-auto">
          {items.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(href + "/");
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 text-sm rounded-md transition-colors",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                    : "hover:bg-sidebar-accent/60",
                )}
              >
                <Icon className="w-4 h-4" />
                {label}
              </Link>
            );
          })}
        </nav>
      </aside>
    </>
  );
}
