import { NavLink } from 'react-router-dom';
import { Icon } from './Icon';
import './FinanceSectionNav.css';

const financePages = [
  {path:'/billing',label:'Ingresos y facturación',icon:'card',hint:'Cobros comerciales aún sin fuente verificada'},
  {path:'/transactions',label:'Transacciones',icon:'clock',hint:'Pagos registrados a proveedores tecnológicos'},
  {path:'/refunds',label:'Reembolsos',icon:'refresh',hint:'Solicitudes y decisiones administrativas, sin desembolsos'},
  {path:'/financial-reports',label:'Gastos y contabilidad',icon:'chart',hint:'Consumos, facturas, presupuestos y auditoría'},
] as const;

/** Navigation shared across all four independent financial record sources.
 * Never imply subscriptions are sales or administrative cases are payouts. */
export function FinanceSectionNav() {
  return <nav className="afn-nav" aria-label="Pestañas de Finanzas y contabilidad">
    <div className="afn-title">
      <Icon name="database" size={17}/>
      <span>FINANZAS Y CONTABILIDAD</span>
    </div>
    <div className="afn-items">
      {financePages.map(item => <NavLink key={item.path} to={item.path}
        title={item.hint} end
        className={({isActive})=>'afn-link'+(isActive?' active':'')}>
        <Icon name={item.icon} size={17}/><span>{item.label}</span>
      </NavLink>)}
    </div>
    <p className="afn-trace-note"><Icon name="shield" size={15}/>
      Cada pestaña consulta una fuente distinta. Ningún estado administrativo acredita por sí solo una venta, una devolución o una conciliación bancaria.
    </p>
  </nav>;
}
