import type { DashboardMetric } from "../../types/dashboard";
export function MetricCard({ metric }: { metric: DashboardMetric }) { return <article className="metric-card"><div className="metric-icon">{metric.icon}</div><div className="metric-main"><p>{metric.label}</p><strong>{metric.value}</strong><span>{metric.detail}</span></div><span className="trend">↗ {metric.trend}</span></article>; }
