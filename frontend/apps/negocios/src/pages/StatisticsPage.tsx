import { useState } from "react";
import { PageHeader } from "../components/common/PageHeader";
import { businessCatalog } from "../data/business.mock";
import { useBusinessStore } from "../services/businessStore";

const periods = ["7 días", "30 días", "90 días"] as const;
const data = {
  "7 días": { views: 312, calls: 11, whatsapp: 19, directions: 7, bars: [28,36,43,38,55,72,66] },
  "30 días": { views: 1284, calls: 42, whatsapp: 83, directions: 23, bars: [25,33,41,38,52,47,61,58,68,62,74,82] },
  "90 días": { views: 3690, calls: 126, whatsapp: 231, directions: 69, bars: [22,31,29,44,38,53,48,62,58,64,76,84] },
};
const businessStats: Record<string, typeof data> = {
  "La Arepería de Majo": data,
  "Droguería San Jorge": { "7 días": { views: 246, calls: 18, whatsapp: 31, directions: 12, bars: [24,32,44,49,53,63,71] }, "30 días": { views: 1038, calls: 76, whatsapp: 122, directions: 45, bars: [28,37,42,48,55,61,67,63,72,69,78,86] }, "90 días": { views: 2980, calls: 214, whatsapp: 356, directions: 138, bars: [24,35,31,46,43,55,51,66,62,70,79,88] } },
  "Casa del Tornillo": { "7 días": { views: 184, calls: 9, whatsapp: 14, directions: 11, bars: [22,29,38,35,48,58,64] }, "30 días": { views: 742, calls: 38, whatsapp: 61, directions: 47, bars: [22,31,39,36,48,45,57,54,63,59,68,77] }, "90 días": { views: 2160, calls: 108, whatsapp: 175, directions: 132, bars: [20,28,27,40,36,49,45,58,54,61,72,81] } },
};
const emptyData: typeof data = { "7 días": { views: 0, calls: 0, whatsapp: 0, directions: 0, bars: [0,0,0,0,0,0,0] }, "30 días": { views: 0, calls: 0, whatsapp: 0, directions: 0, bars: [0,0,0,0,0,0,0,0,0,0,0,0] }, "90 días": { views: 0, calls: 0, whatsapp: 0, directions: 0, bars: [0,0,0,0,0,0,0,0,0,0,0,0] } };
export function StatisticsPage() {
  const { items: storedItems, business, businesses } = useBusinessStore();
  const personalCatalog = businesses.length === 0 || business.isNew || !businessCatalog[business.name];
  const items = personalCatalog ? (business.catalog ?? []) : (businessCatalog[business.name] ?? storedItems);
  const [period, setPeriod] = useState<typeof periods[number]>("30 días");
  const hasEmptyData = businesses.length === 0 || business.isNew || (!businessStats[business.name] && !businessCatalog[business.name]);
  const current = (hasEmptyData ? emptyData : (businessStats[business.name] ?? data))[period];
  const leaders = [...items].filter(item => item.active).sort((a,b) => b.interest-a.interest).slice(0,4);
  return <><PageHeader eyebrow="RENDIMIENTO" title="Estadísticas" description={businesses.length === 0 ? "Aquí aparecerán tus cifras cuando crees tu primera tienda." : `Una mirada sencilla al rendimiento de ${business.name}.`} action={<div className="period-tabs" role="group" aria-label="Periodo">{periods.map(value => <button type="button" className={period === value ? "selected" : ""} aria-pressed={period === value} onClick={() => setPeriod(value)} key={value}>{value}</button>)}</div>} /><div className="stat-grid">{[["Visualizaciones del negocio",current.views,"◉"],["Llamadas",current.calls,"☎"],["Clics en WhatsApp",current.whatsapp,"◌"],["Cómo llegar",current.directions,"⌖"]].map(([label,value,icon]) => <article className="surface-card stat-tile" key={label}><span className="stat-icon">{icon}</span><p>{label}</p><strong>{Number(value).toLocaleString("es-CO")}</strong><small>en los últimos {period}</small></article>)}</div><div className="statistics-layout"><section className="surface-card chart-card"><div className="card-heading"><div><h2>Visualizaciones a lo largo del tiempo</h2><p>Interés en la ficha de tu negocio</p></div><span className="chart-legend"><i /> Visualizaciones</span></div><div className="bar-chart" role="img" aria-label={`Gráfico de visualizaciones en los últimos ${period}`}><div className="chart-grid"><span>100%</span><span>75%</span><span>50%</span><span>25%</span><span>0%</span></div><div className="chart-bars">{current.bars.map((value,index) => <div className="chart-column" key={index}><span style={{height:`${value}%`}} /><small>{period === "7 días" ? ["L","M","M","J","V","S","D"][index] : index%2 === 0 ? `${index+1}` : ""}</small></div>)}</div></div></section><section className="surface-card top-interest"><div className="card-heading"><div><h2>Más interés</h2><p>Productos y servicios destacados</p></div></div>{leaders.length ? leaders.map((item,index) => <div className="leader-row" key={item.id}><span className="leader-index">0{index+1}</span><span className="leader-icon">{item.image}</span><div><strong>{item.name}</strong><small>{item.kind === "product" ? "Producto" : "Servicio"}</small></div><b>{item.interest}</b></div>) : <div className="empty-state"><p>Aún no hay elementos activos.</p></div>}</section></div></>;
}
