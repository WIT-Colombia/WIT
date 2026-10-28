import type { CSSProperties } from "react";

type FractionalStarsProps = { rating: number | null | undefined; className?: string };

/** Paints exactly five stars, clipping the gold layer to the real average. */
export function FractionalStars({ rating, className }: FractionalStarsProps) {
  const value = typeof rating === "number" && Number.isFinite(rating) ? Math.min(5, Math.max(0, rating)) : 0;
  const style: CSSProperties = {
    position: "relative",
    display: "inline-grid",
    color: "#d6dfda",
    letterSpacing: "1px",
    whiteSpace: "nowrap",
  };
  const fillStyle: CSSProperties = { gridArea: "1 / 1", display: "block", minWidth: 0, width: `${value / 5 * 100}%`, overflow: "hidden", color: "#f5ad16", whiteSpace: "nowrap" };
  return <span className={className} aria-hidden="true" style={style}><span style={{ gridArea: "1 / 1" }}>★★★★★</span><b style={fillStyle}>★★★★★</b></span>;
}
