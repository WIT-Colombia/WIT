import { useState } from 'react';
import { AdminDialog } from '../../components/AdminDialog';
import { BusinessRecordPhoto } from '../../components/businesses/BusinessRecordPhoto';
import { getRecordPhotos, type RecordPhoto } from '../../services/adminBusinessRecord';
import { Badge, Card, Empty, Loading, Pager, date, useResource } from './shared';

const caption = (photo: RecordPhoto) => photo.isCover ? 'Portada del negocio' : photo.isProfile ? 'Fotografía de perfil' : photo.offer ? `${photo.offer.kind === 'SERVICE' ? 'Servicio' : 'Producto'}: ${photo.offer.name}` : 'Fotografía del establecimiento';
export function Gallery({ id, catalogAllowed }: { id: string; catalogAllowed: boolean }) {
  const [page, setPage] = useState(1), [scope, setScope] = useState(''), [selected, setSelected] = useState<RecordPhoto | null>(null);
  const source = useResource(() => getRecordPhotos(id, page, scope), [id, page, scope]);
  return <Card title="Fotografías del establecimiento" icon="image">
    <div className="bd-filters"><label>Origen de las fotografías<select aria-label="Origen de las fotografías" value={scope} onChange={event => { setScope(event.target.value); setPage(1); }}><option value="">Todas las disponibles</option><option value="BUSINESS">Establecimiento, portada y perfil</option>{catalogAllowed && <option value="OFFER">Productos y servicios</option>}</select></label><p className="bd-note">Consulta de imágenes originales. No se habilita edición ni eliminación.</p></div><Loading {...source}/>
    {!source.loading && !source.error && source.data && <>{source.data.photos.length ? <div className="bd-gallery">{source.data.photos.map(photo => <article key={photo.id}><button aria-label={`Ampliar ${caption(photo)}`} onClick={() => setSelected(photo)}><BusinessRecordPhoto id={photo.id} alt={photo.altText || caption(photo)}/><span className="bd-gallery-enlarge">Ampliar imagen</span></button><div><Badge tone={photo.isCover || photo.isProfile ? 'violet' : 'neutral'}>{caption(photo)}</Badge><small>{date(photo.createdAt)}</small></div></article>)}</div> : <Empty icon="image" title="No hay fotografías registradas" message="La galería mostrará únicamente las imágenes disponibles de este establecimiento."/>}<Pager pagination={source.data.pagination} onPage={setPage}/></>}
    {selected && <AdminDialog title={caption(selected)} contextLabel="XAMUKO ADMIN · GALERÍA" wide onClose={() => setSelected(null)}><div className="bd-lightbox"><BusinessRecordPhoto id={selected.id} alt={selected.altText || caption(selected)} size={0} eager/><p>{selected.altText || caption(selected)} · {date(selected.createdAt)}</p></div></AdminDialog>}
  </Card>;
}
