import { Navigate, Route, Routes } from "react-router-dom";
import { Button, Logo } from "@wit/ui";

function FoundationPage() {
  return <main className="app-shell"><aside className="admin-sidebar"><Logo /><span>ADMIN</span></aside><section className="admin-main"><header className="admin-header">WIT · Administración</header><div className="app-panel"><p className="eyebrow">WIT ADMIN · BASE TÉCNICA</p><h1>Controla y analiza WIT.</h1><p>La aplicación administrativa tiene su espacio desktop-first y tema propios. Sus módulos se construirán por etapas.</p><Button type="button">Configuración lista</Button></div></section></main>;
}

export default function App() {
  return <Routes><Route path="/" element={<FoundationPage />} /><Route path="*" element={<Navigate to="/" replace />} /></Routes>;
}
