import { useEffect, useState } from 'react';
import { Panel, StatePanel, Badge } from '../components/common';
import { listAdminReviews, type AdminReview } from '../services/adminApiClient';

export function ReviewsPage(){
 const [reviews,setReviews]=useState<AdminReview[]>([]); const [loading,setLoading]=useState(true); const [error,setError]=useState('');
 const load=()=>{setLoading(true);setError('');listAdminReviews().then(r=>setReviews(r.reviews)).catch(e=>setError(e instanceof Error?e.message:'No se pudieron cargar las opiniones.')).finally(()=>setLoading(false));};
 useEffect(load,[]);
 return <><div className="page-heading"><div><p className="eyebrow">OPINIONES</p><h1>Opiniones publicadas</h1><p>Consulta las calificaciones reales y su estado de moderación.</p></div></div><Panel title="Opiniones" subtitle="La consulta es de solo lectura. Las decisiones se realizan desde Reportes.">{loading?<StatePanel kind="loading" title="Cargando opiniones" message="Consultando opiniones reales."/>:error?<StatePanel kind="error" title="No se pudieron cargar las opiniones" message={error} retry={load}/>:!reviews.length?<StatePanel kind="empty" title="No hay opiniones" message="Todavía no existen opiniones publicadas."/>:<div className="mock-record-list">{reviews.map(review=><article className="mock-record" key={review.id}><span className="mock-record-copy"><strong>{review.business.name}</strong><small>{review.user.displayName} · {review.rating} ★ · {new Date(review.createdAt).toLocaleDateString('es-CO')}</small><span>{review.comment}</span><small>Estado: <Badge tone={review.status==='PUBLISHED'?'success':review.status==='HIDDEN'?'review':'normal'}>{review.status}</Badge>{review.reports.length?` · Reportes: ${review.reports.length}`:''}</small>{review.response&&<small>Respuesta del negocio: {review.response.body}</small>}</span></article>)}</div>}</Panel></>;
}
