import type { ReactNode } from "react";
export type IconName = "pin" | "search" | "shop" | "user" | "users" | "shield" | "devices" | "growth" | "rocket" | "arrow" | "chevron" | "check" | "menu" | "close";
const paths: Record<IconName, ReactNode> = {
  pin: <><path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></>,
  search: <><circle cx="10.5" cy="10.5" r="7.5"/><path d="m16 16 6 6"/></>,
  shop: <path d="M3 8h18l-2-5H5L3 8Zm0 0v3a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0V8M5 14v7h14v-7M10 21v-6h4v6"/>,
  user: <><circle cx="12" cy="7" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2H4Z"/></>,
  users: <><circle cx="9" cy="7" r="3.5"/><path d="M2 21v-2a7 7 0 0 1 14 0v2M17 4a3.5 3.5 0 0 1 0 7m2 4a5 5 0 0 1 3 5M9 15v6m-3-3h6"/></>,
  shield: <path d="m12 2 8 3v6c0 6-8 11-8 11S4 17 4 11V5l8-3Zm-4 9 3 3 5-6"/>,
  devices: <><rect x="2" y="3" width="15" height="13" rx="1"/><path d="M6 21h8m-4-5v5"/><rect x="15" y="9" width="7" height="13" rx="1"/><path d="M18 19h1"/></>,
  growth: <path d="M4 21v-6m6 6V11m6 10V7m5-3-7 6-4-4-7 6M16 3h6v6"/>,
  rocket: <><path d="M9 15 4 20l1-6m4 1 6-6m-6 6 5 2c5-4 7-9 7-14-5 0-10 2-14 7l2 5Zm-2-5-4 1 1-5 6-1m4 12-1 4 5-1 1-6M5 19l-2 3m5-2-1 2"/><circle cx="16" cy="8" r="2"/></>,
  arrow: <path d="M3 12h18m-7-7 7 7-7 7"/>,
  chevron: <path d="m6 9 6 6 6-6"/>, check: <path d="m4 12 5 5L20 6"/>,
  menu: <path d="M3 6h18M3 12h18M3 18h18"/>, close: <path d="m5 5 14 14M19 5 5 19"/>,
};
export function Icon({ name }: { name: IconName }) {
  return <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}
