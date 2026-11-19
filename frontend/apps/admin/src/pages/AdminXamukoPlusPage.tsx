import { PAID_PLAN_MONTHLY_COP, formatCopPrice } from '@wit/utils';
import { AdminPageHeading } from '../components/AdminPageHeading';
import { PaidPlanControl } from '../components/PaidPlanControl';
import { AdminPlusMembershipControl } from '../components/AdminPlusMembershipControl';
import './AdminPlansPage.css';
export function AdminXamukoPlusPage() {
  return <main className="aps-page"><AdminPageHeading title="XAMUKO Plus" icon="users" description={`Precio mensual: ${formatCopPrice(PAID_PLAN_MONTHLY_COP.xamukoPlus)} COP. Gestiona disponibilidad, solicitudes y membresías personales.`} />
    <PaidPlanControl plan="xamukoPlus" name="Xamuko Plus" />
    <AdminPlusMembershipControl />
  </main>;
}
