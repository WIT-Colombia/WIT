import { Navigate, Route, Routes } from "react-router-dom";
import { Button, Logo } from "@wit/ui";

function FoundationPage() {
  return <main className="app-shell">
    <header className="app-header"><Logo /><span>GESTIÓN PARA NEGOCIOS</span></header>
    <section className="app-panel"><p className="eyebrow">WIT NEGOCIOS · BASE TÉCNICA</p><h1>Gestiona tu negocio en WIT.</h1><p>La aplicación de negocios tiene su espacio y tema propios. Sus módulos se construirán por etapas.</p><Button type="button">Configuración lista</Button></section>
  </main>;
}

export default function App() {
  return <Routes><Route path="/" element={<FoundationPage />} /><Route path="*" element={<Navigate to="/" replace />} /></Routes>;
}
