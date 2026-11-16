import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Link } from 'react-router-dom';

export class PioneersErrorBoundary extends Component<{children:ReactNode},{failed:boolean}>{
  state={failed:false};
  static getDerivedStateFromError(){return {failed:true};}
  componentDidCatch(error:Error,info:ErrorInfo){
    console.error('[Admin Negocios Pioneros] Fallo al representar la pantalla:',error,info.componentStack);
  }
  render(){
    if(!this.state.failed)return this.props.children;
    return <section className="state-panel error" role="alert" aria-live="assertive">
      <h2>No pudimos mostrar Negocios Pioneros</h2>
      <p>La consulta produjo un problema al visualizar los datos. Puedes reintentar sin perder el acceso a Admin.</p>
      <div style={{display:'flex',justifyContent:'center',flexWrap:'wrap',gap:12,marginTop:15}}>
        <button type="button" className="primary" onClick={()=>this.setState({failed:false})}>Reintentar</button>
        <Link className="secondary-button" to="/dashboard">Volver al inicio</Link>
      </div>
    </section>;
  }
}
