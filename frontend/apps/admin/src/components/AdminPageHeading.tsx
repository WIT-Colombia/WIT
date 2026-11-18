import type { ReactNode } from 'react';
import { Icon } from './Icon';

type Props = { title: ReactNode; id?: string; icon: string; description?: ReactNode; children?: ReactNode; actions?: ReactNode };

/** Shared page heading, using the approved Negocios dimensions. */
export function AdminPageHeading({ title, id, icon, description, children, actions }: Props) {
  return <header className="admin-page-heading">
    <div className="admin-page-heading-identity">
      <span className="admin-page-heading-icon" aria-hidden="true"><Icon name={icon} size={27} /></span>
      <div className="admin-page-heading-copy"><h1 id={id}>{title}</h1>{description && <p>{description}</p>}</div>
    </div>
    {actions && <div className="admin-page-heading-actions">{actions}</div>}
    {children && <div className="admin-page-heading-details">{children}</div>}
  </header>;
}
