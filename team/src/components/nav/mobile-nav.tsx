"use client";

// The mobile drawer is opened from the top bar but rendered by the sidebar, so
// the open/closed flag lives above both of them rather than inside either.

import { createContext, useContext, useState } from "react";

interface MobileNavState {
  open: boolean;
  setOpen: (open: boolean) => void;
}

const MobileNavContext = createContext<MobileNavState>({ open: false, setOpen: () => {} });

export function MobileNavProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return <MobileNavContext.Provider value={{ open, setOpen }}>{children}</MobileNavContext.Provider>;
}

export function useMobileNav(): MobileNavState {
  return useContext(MobileNavContext);
}
