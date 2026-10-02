import type { ReactNode } from "react";
import { SiteHeader, type SiteSection } from "./SiteHeader";
import { BottomNavigation } from "./BottomNavigation";
import "./PageLayout.css";

export function PageLayout({ children, active, className = "" }: { children: ReactNode; active?: SiteSection; className?: string }) {
  return <div className={`user-content-page ${className}`}><SiteHeader active={active}/><main className="user-content-main">{children}</main><BottomNavigation/></div>;
}
