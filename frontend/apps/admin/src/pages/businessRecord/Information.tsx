import type { ReactNode } from 'react';
import { Icon } from '../../components/Icon';
import type { RecordBusiness } from '../../services/adminBusinessRecord';
import { Badge, Empty, categoryName, date, label } from './shared';

const fact = (title: string, value: ReactNode, wide = false) =>
  <div key={title} className={'bd-info-field' + (wide ? ' bd-info-field--wide' : '')}>
    <dt>{title}</dt><dd>{value === null || value === undefined || value === '' ? 'No registrado' : value}</dd>
  </div>;
const country = (code?: string) => {
  if (!code) return 'No registrado';
  try { return new Intl.DisplayNames(['es'], { type: 'region' }).of(code) || code; }
  catch { return code; }
};
export const owners = (business: RecordBusiness) =>
  business.record?.members.filter(member => member.role === 'OWNER' && member.status === 'ACTIVE')
    .map(member => member.user.displayName).join(' · ') || 'Sin propietario activo registrado';

function InfoGroup({ icon, title, caption, tone, children }: {
  icon: string; title: string; caption: string; tone: string; children: ReactNode;
}) {
  return <section className={'bd-info-group bd-info-group--' + tone} aria-label={title}>
    <header className="bd-info-group-header">
      <span className="bd-info-group-icon"><Icon name={icon} size={22}/></span>
      <span className="bd-info-group-title"><h3>{title}</h3><p>{caption}</p></span>
    </header>
    <dl className="bd-info-fields">{children}</dl>
  </section>;
}

export function Information({ business, compact = false }: { business: RecordBusiness; compact?: boolean }) {
  return <section className="bd-info-details" aria-labelledby="bd-info-details-title">
    <header className="bd-info-overview-heading">
      <span className="bd-info-overview-icon"><Icon name="file" size={24}/></span>
      <div><h2 id="bd-info-details-title">Información general</h2>
        <p>Datos registrados del establecimiento, organizados para consulta administrativa.</p></div>
    </header>
    <div className="bd-info-grid">
      <InfoGroup icon="store" title="Información comercial" caption="Identificación y actividad del establecimiento" tone="purple">
        {fact('Nombre del negocio', business.name)}
        {fact('Categoría principal', categoryName(business.category))}
        {fact('Descripción', business.description || 'Sin descripción registrada', true)}
      </InfoGroup>

      <InfoGroup icon="pin" title="Ubicación" caption="Información territorial y dirección registrada" tone="blue">
        {fact('Dirección', business.location?.address, true)}
        {fact('Ciudad / departamento', business.location
          ? <span className="bd-location-text">{[business.location.cityName, business.location.regionName].filter(Boolean).join(' · ')}</span> : null)}
        {!compact && fact('País', country(business.location?.countryCode))}
      </InfoGroup>

      {!compact && <InfoGroup icon="phone" title="Contacto" caption="Medios de contacto del negocio" tone="green">
        {fact('Correo electrónico', business.email, true)}
        {fact('Teléfono', business.phone)}
      </InfoGroup>}

      <InfoGroup icon="shield" title="Datos administrativos" caption="Titularidad y trazabilidad de la ficha" tone="amber">
        {fact('Propietario actual', owners(business))}
        {!compact && fact('Registrado por', business.createdBy.displayName)}
        {fact('ID público', <span className="bd-public-id">{business.publicId}</span>)}
        {fact('Estado de publicación',
          <Badge tone={business.publicationStatus === 'PUBLISHED' ? 'green' : 'neutral'}>
            {label(business.publicationStatus)}
          </Badge>)}
        {!compact && <>{fact('Fecha de registro', date(business.createdAt))}
          {fact('Última actualización', date(business.updatedAt))}</>}
      </InfoGroup>
    </div>
  </section>;
}

export function Members({ business }: { business: RecordBusiness }) {
  return <section className="bd-info-members" aria-labelledby="bd-info-members-title">
    <header className="bd-info-members-header">
      <span className="bd-info-overview-icon"><Icon name="users" size={23}/></span>
      <div><h2 id="bd-info-members-title">Miembros vinculados</h2>
        <p>Cuentas, roles y estado de sus vínculos con el negocio.</p></div>
      <span className="bd-info-members-count">{business.record?.members.length ?? 0}</span>
    </header>
    {business.record?.members.length
      ? <ul className="bd-info-members-list">
          {business.record.members.map(member => <li key={member.id} className="bd-info-member">
            <span className="bd-info-member-avatar" aria-hidden="true"><Icon name="users" size={21}/></span>
            <span className="bd-info-member-identity"><strong>{member.user.displayName}</strong>
              {member.user.nickname && <small>@{member.user.nickname.replace(/^@/, '')}</small>}
              <span className="bd-info-member-date">Vinculado: {date(member.createdAt)}</span>
            </span>
            <span className="bd-info-member-meta">
              <span className="bd-info-member-role">{label(member.role)}</span>
              <Badge tone={member.status === 'ACTIVE' ? 'green' : 'neutral'}>{label(member.status)}</Badge>
            </span>
          </li>)}
        </ul>
      : <Empty icon="users" title="Sin miembros vinculados"
          message="No hay vínculos de miembros registrados para este establecimiento."/>}
  </section>;
}
