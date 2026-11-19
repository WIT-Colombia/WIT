import { AdminPageHeading } from '../components/AdminPageHeading';
import { PaidPlanControl } from '../components/PaidPlanControl';
import { AdminPlusMembershipControl } from '../components/AdminPlusMembershipControl';
import './AdminPlansPage.css';
export function AdminXamukoPlusPage() {
  return <main className="aps-page"><AdminPageHeading title="XAMUKO Plus" icon="users" description="Administra la disponibilidad del plan pago para usuarios." />
    <PaidPlanControl plan="xamukoPlus" name="Xamuko Plus" />
    <AdminPlusMembershipControl />
  </main>;
}
