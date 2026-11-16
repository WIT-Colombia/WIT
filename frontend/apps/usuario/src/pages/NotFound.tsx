import { NotFoundPage } from '@wit/ui';
import { PageLayout } from '../components/PageLayout';

export default function NotFound() {
  return <PageLayout className="x404-user-layout">
    <NotFoundPage variant="usuario" homeHref="/home" homeLabel="Volver al inicio" />
  </PageLayout>;
}
