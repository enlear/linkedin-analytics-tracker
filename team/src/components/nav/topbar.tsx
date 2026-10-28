"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { ChevronDown, LogOut, Menu, Settings } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { createClient } from "@/lib/supabase/browser";
import { ThemeToggle } from "./theme-toggle";
import { useMobileNav } from "./mobile-nav";
import { sectionTitle } from "./nav-items";

interface TopbarProps {
  role: "admin" | "member";
  user: {
    name: string | null | undefined;
    email: string | null | undefined;
    image: string | null | undefined;
  };
}

/**
 * Sticky header across the content column. Holds the account controls that
 * used to sit at the foot of the sidebar — theme, and a profile menu carrying
 * Settings and sign out — plus the mobile menu button, which is why it renders
 * above the page rather than floating over it.
 */
export function Topbar({ role, user }: TopbarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { setOpen } = useMobileNav();
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    setSigningOut(true);
    try {
      const { error } = await createClient().auth.signOut();
      if (error) toast.error(error.message);
    } finally {
      router.replace("/login");
      router.refresh();
    }
  }

  const initials = (user.name ?? user.email ?? "??").slice(0, 2).toUpperCase();
  const displayName = user.name ?? user.email ?? "User";
  const roleLabel = role === "admin" ? "Admin" : "Member";

  return (
    <header className="sticky top-0 z-30 h-14 shrink-0 border-b border-border bg-background/85 backdrop-blur flex items-center gap-3 px-4 md:px-8">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="md:hidden -ml-1 h-9 w-9 shrink-0 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent/60 transition-colors"
        aria-label="Open navigation menu"
      >
        <Menu className="w-5 h-5" />
      </button>

      <div className="font-medium truncate">{sectionTitle(pathname)}</div>

      <div className="ml-auto flex items-center gap-1 sm:gap-2">
        <ThemeToggle variant="icon" />

        <div className="hidden sm:block h-6 w-px bg-border" aria-hidden />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex items-center gap-2 min-w-0 rounded-md p-1 hover:bg-accent/60 transition-colors data-[state=open]:bg-accent/60"
              aria-label="Account menu"
            >
              <Avatar className="h-8 w-8">
                {user.image ? <AvatarImage src={user.image} alt={displayName} /> : null}
                <AvatarFallback className="text-xs">{initials}</AvatarFallback>
              </Avatar>
              {/* Name is the first thing to go when space is tight — the avatar
                  alone still identifies the account and still opens the menu. */}
              <div className="hidden sm:flex flex-col leading-tight min-w-0 text-left">
                <span className="text-sm font-medium truncate max-w-[12rem]">{displayName}</span>
                <span className="text-xs text-muted-foreground">{roleLabel}</span>
              </div>
              <ChevronDown className="hidden sm:block w-4 h-4 shrink-0 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col gap-0.5 min-w-0">
                <span className="text-sm font-medium truncate">{displayName}</span>
                {user.email ? (
                  <span className="text-xs font-normal text-muted-foreground truncate">
                    {user.email}
                  </span>
                ) : null}
              </div>
            </DropdownMenuLabel>

            <DropdownMenuSeparator />

            <DropdownMenuItem asChild className="cursor-pointer">
              <Link href="/settings">
                <Settings className="w-4 h-4" />
                Settings
              </Link>
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            <DropdownMenuItem
              onSelect={handleSignOut}
              disabled={signingOut}
              className="cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              {signingOut ? "Signing out…" : "Sign out"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
