import { Link } from 'react-router-dom';
import { AdminPageHeading } from '../components/AdminPageHeading';
import { Icon } from '../components/Icon';

export function ChangePasswordPage() {
  return <section className="sec-workspace sec-password">
    <AdminPageHeading icon="lock" title="Seguridad de la contraseña"
      description="Protege el acceso a tu cuenta administrativa."/>
    <div className="sec-panel sec-password-content">
      <span className="sec-kpi-icon"><Icon name="shield" size={27}/></span>
      <h2>Restablecimiento mediante verificación de correo</h2>
      <p>La actualización directa de contraseña desde la sesión administrativa todavía no está integrada. Por seguridad, esta pantalla no solicita credenciales ni muestra confirmaciones simuladas.</p>
      <p>Si necesitas cambiar la contraseña, utiliza el procedimiento real de recuperación por correo. El servicio únicamente confirma que recibió la solicitud; la entrega del mensaje depende de la configuración del correo.</p>
      <Link className="sec-button sec-button-primary" to="/recover-password"><Icon name="lock" size={17}/> Iniciar recuperación</Link>
    </div>
  </section>;
}
