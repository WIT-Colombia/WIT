import type { ReactNode } from 'react';
import { Icon } from '../../components/Icon';
import type { RecordBusiness } from '../../services/adminBusinessRecord';
import { Badge, Card, Empty, categoryName, date, label } from './shared';

const fact = (title: string, value: ReactNode) => <div key={title}><dt>{title}</dt><dd>{value || 'No registrado'}</dd></div>;
const country = (code?: string) => { if (!code) return 'No registrado'; try { return new Intl.DisplayNames(['es'], { type: 'region' }).of(code) || code; } catch { return code; } };
export const owners = (business: RecordBusiness) => business.record?.members.filter(member => member.role === 'OWNER' && member.status === 'ACTIVE').map(member => member.user.displayName).join(' · ') || 'Sin propietario activo registrado';
export function Information({ business, compact = false }: { business: RecordBusiness; compact?: boolean }) {
  return <Card title="Información general" icon="info"><dl className="bd-facts">
    {fact('Nombre del negocio', business.name)}{fact('Categoría principal', categoryName(business.category))}{fact('Descripción', business.description || 'Sin descripción registrada')}{fact('Propietario actual', owners(business))}
    {!compact && fact('Registrado por', business.createdBy.displayName)}{fact('ID público', <span className="bd-public-id">{business.publicId}</span>)}
    {fact('Estado de publicación', <Badge tone={business.publicationStatus === 'PUBLISHED' ? 'green' : 'neutral'}>{label(business.publicationStatus)}</Badge>)}{fact('Dirección', business.location?.address)}
    {fact('Ciudad / departamento', business.location ? <span className="bd-location-text">{[business.location.cityName, business.location.regionName].filter(Boolean).join(' · ')}</span> : null)}
    {!compact && <>{fact('País', country(business.location?.countryCode))}{fact('Correo electrónico', business.email)}{fact('Teléfono', business.phone)}{fact('Fecha de registro', date(business.createdAt))}{fact('Última actualización', date(business.updatedAt))}</>}
  </dl></Card>;
}
export function Members({ business }: { business: RecordBusiness }) {
  return <Card title="Miembros vinculados" icon="users">{business.record?.members.length ? <div className="bd-table-scroll"><table><thead><tr><th>Cuenta vinculada</th><th>Rol</th><th>Estado</th><th>Registro del vínculo</th></tr></thead><tbody>{business.record.members.map(member => <tr key={member.id}><td><strong>{member.user.displayName}</strong>{member.user.nickname && <small>@{member.user.nickname.replace(/^@/, '')}</small>}</td><td>{label(member.role)}</td><td><Badge tone={member.status === 'ACTIVE' ? 'green' : 'neutral'}>{label(member.status)}</Badge></td><td>{date(member.createdAt)}</td></tr>)}</tbody></table></div> : <Empty icon="users" title="Sin miembros vinculados" message="No hay vínculos de miembros registrados para este establecimiento."/>}</Card>;
}
