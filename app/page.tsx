"use client";

import { useState, type ChangeEvent, type FormEvent } from "react";
import {
  AudioLines,
  ArrowDownToLine,
  ArrowRight,
  BadgeCheck,
  Bell,
  ChevronDown,
  Clapperboard,
  Clock3,
  Compass,
  Crown,
  Film,
  FolderOpen,
  ImagePlus,
  Images,
  Layers3,
  Mic2,
  MoreHorizontal,
  Plus,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  UserRound,
  UsersRound,
  WandSparkles,
  X,
} from "lucide-react";

type Mode = "image" | "video" | "character" | "voice";
type Section = "Crear" | "Personajes" | "Voces" | "Biblioteca" | "Proyectos";

const sections: { label: Section; icon: typeof Sparkles }[] = [
  { label: "Crear", icon: WandSparkles },
  { label: "Personajes", icon: UsersRound },
  { label: "Voces", icon: AudioLines },
  { label: "Biblioteca", icon: Images },
  { label: "Proyectos", icon: FolderOpen },
];

const modes: { id: Mode; label: string; icon: typeof ImagePlus }[] = [
  { id: "image", label: "Imagen", icon: ImagePlus },
  { id: "video", label: "Video", icon: Clapperboard },
  { id: "character", label: "Personaje", icon: UserRound },
  { id: "voice", label: "Voz", icon: AudioLines },
];

const copy: Record<Mode, { title: string; placeholder: string; action: string }> = {
  image: {
    title: "¿Qué imagen tienes en mente?",
    placeholder: "Describe una escena, un estilo o los cambios que quieres hacer…",
    action: "Crear imagen",
  },
  video: {
    title: "Dale movimiento a tu idea",
    placeholder: "Describe la escena, el movimiento de cámara y el ritmo…",
    action: "Crear video",
  },
  character: {
    title: "Diseña un personaje que puedas reutilizar",
    placeholder: "Describe su apariencia, personalidad, vestuario y universo…",
    action: "Crear personaje",
  },
  voice: {
    title: "Prepara una voz para tu proyecto",
    placeholder: "Escribe el texto que quieres convertir en voz…",
    action: "Preparar voz",
  },
};

const gallery = [
  { name: "Luz de tarde", type: "Retrato · Editorial", tone: "peach", mark: "01" },
  { name: "Jardín de cristal", type: "Ilustración · Fantasía", tone: "mint", mark: "02" },
  { name: "Ciudad suspendida", type: "Concepto · Cine", tone: "blue", mark: "03" },
  { name: "Órbita tranquila", type: "Personaje · 3D", tone: "lavender", mark: "04" },
];

export default function Home() {
  const [section, setSection] = useState<Section>("Crear");
  const [mode, setMode] = useState<Mode>("image");
  const [prompt, setPrompt] = useState("");
  const [notice, setNotice] = useState("");
  const [reference, setReference] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const selectMode = (next: Mode) => {
    setMode(next);
    setSection("Crear");
    setNotice("");
  };

  const onUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/") && !file.type.startsWith("video/")) {
      setNotice("Elige una imagen o un video como referencia.");
      return;
    }
    setReference(URL.createObjectURL(file));
    setNotice("Referencia lista en este dispositivo. Aún no se ha subido a la nube.");
  };

  const onGenerate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!prompt.trim()) {
      setNotice("Escribe una descripción para empezar.");
      return;
    }
    setBusy(true);
    setNotice("");
    try {
      const response = await fetch("/api/generations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mode, prompt: prompt.trim() }),
      });
      const result = (await response.json()) as { message?: string };
      setNotice(result.message ?? "La generación no está disponible todavía.");
    } catch {
      setNotice("No se pudo conectar con el servicio. Tu descripción sigue aquí.");
    } finally {
      setBusy(false);
    }
  };

  const heading = section === "Crear" ? "Tu estudio creativo" : section;
  const description = section === "Crear"
    ? "Imágenes, historias y personajes empiezan con una idea."
    : section === "Personajes"
      ? "Crea y conserva personajes para volver a usarlos en tus historias."
      : section === "Voces"
        ? "Prepara voces y sincroniza el diálogo con tus videos."
        : section === "Biblioteca"
          ? "Tus archivos creativos, referencias y resultados en un solo lugar."
          : "Organiza las piezas de cada historia y campaña."
  return (
    <main className="studio-shell">
      <aside className="sidebar">
        <button className="brand" type="button" onClick={() => setSection("Crear")} aria-label="ClassicArt Creator, inicio">
          <span className="brand-symbol"><span /><span /><span /></span>
          <span className="brand-name">classic<span>art</span></span>
        </button>

        <button className="workspace-switch" type="button">
          <span className="workspace-avatar">C</span>
          <span className="workspace-copy"><strong>Mi estudio</strong><small>Espacio personal</small></span>
          <ChevronDown size={15} />
        </button>

        <div className="side-label">ESTUDIO</div>
        <nav className="side-nav" aria-label="Navegación principal">
          {sections.map(({ label, icon: Icon }) => (
            <button key={label} className={`nav-item ${section === label ? "active" : ""}`} type="button" onClick={() => setSection(label)}>
              <Icon size={17} strokeWidth={1.8} />
              <span>{label}</span>
              {label === "Crear" && <span className="nav-shortcut">⌘ K</span>}
            </button>
          ))}
        </nav>

        <div className="side-label recent-label">RECIENTE <MoreHorizontal size={15} /></div>
        <button className="recent-item" type="button" onClick={() => { setSection("Proyectos"); setPrompt("Retrato cinematográfico en una tarde dorada"); }}><span className="recent-dot peach-dot" /> Retrato de tarde</button>
        <button className="recent-item" type="button" onClick={() => { setSection("Proyectos"); setPrompt("Un jardín fantástico hecho de vidrio"); }}><span className="recent-dot mint-dot" /> Jardín de cristal</button>
        <button className="recent-item" type="button" onClick={() => { setSection("Proyectos"); setPrompt("Historia de una ciudad sobre las nubes"); }}><span className="recent-dot blue-dot" /> Ciudad suspendida</button>

        <div className="sidebar-spacer" />
        <div className="plan-card">
          <div className="plan-icon"><Crown size={15} /></div>
          <strong>Tu creatividad, sin límites</strong>
          <p>Conecta un proveedor para activar la generación de contenido.</p>
          <button type="button" onClick={() => setNotice("La conexión de proveedores estará disponible en configuración.")}>Ver configuración <ArrowRight size={13} /></button>
        </div>
        <button className="profile-row" type="button" onClick={() => setNotice("Configuración de cuenta pendiente de conectar.")}>
          <span className="profile-avatar">I</span>
          <span><strong>Irving</strong><small>Plan inicial</small></span>
          <MoreHorizontal size={17} />
        </button>
      </aside>

      <section className="main-panel">
        <header className="topbar">
          <div className="breadcrumb"><span>Mi estudio</span><span className="crumb-slash">/</span><strong>{section}</strong></div>
          <div className="top-actions">
            <span className="connection-status"><i /> Modo de prueba</span>
            <button className="icon-button" type="button" aria-label="Buscar" onClick={() => setNotice("La búsqueda de la biblioteca se activará al conectar el almacenamiento.")}><Search size={17} /></button>
            <button className="icon-button notification-button" type="button" aria-label="Notificaciones"><Bell size={17} /></button>
            <button className="help-button" type="button" onClick={() => setNotice("Conecta un proveedor de imagen, video o voz en la configuración del proyecto.")}>Ayuda <ArrowRight size={14} /></button>
          </div>
        </header>

        <div className="content-scroll">
          <div className="content-wrap">
            <div className="welcome-row">
              <div>
                <div className="eyebrow"><span className="eyebrow-star"><Sparkles size={12} /></span> TU ESPACIO DE CREACIÓN</div>
                <h1>{heading}<span className="title-period">.</span></h1>
                <p className="welcome-copy">{description}</p>
              </div>
              <button className="new-project-button" type="button" onClick={() => { setSection("Crear"); setMode("image"); setPrompt(""); setNotice(""); }}><Plus size={16} /> Nuevo proyecto</button>
            </div>

            {section === "Crear" ? (
              <>
                <section className="composer-card" aria-labelledby="composer-heading">
                  <div className="composer-topline"><span><span className="live-dot" /> LIENZO DE CREACIÓN</span><button type="button" className="plain-icon" aria-label="Ajustes de creación" onClick={() => setNotice("Los ajustes avanzados estarán disponibles al activar los proveedores.")}><Settings2 size={16} /></button></div>
                  <div className="mode-tabs" role="tablist" aria-label="Tipo de creación">
                    {modes.map(({ id, label, icon: Icon }) => (
                      <button key={id} type="button" role="tab" aria-selected={mode === id} className={`mode-tab ${mode === id ? "selected" : ""}`} onClick={() => selectMode(id)}><Icon size={16} />{label}</button>
                    ))}
                    <span className="mode-tab-spacer" />
                    <button type="button" className="ratio-button" onClick={() => setNotice("Formatos disponibles cuando conectes el proveedor.")}>4:5 <ChevronDown size={13} /></button>
                  </div>

                  <form onSubmit={onGenerate}>
                    <label className="sr-only" htmlFor="creative-prompt">Descripción de creación</label>
                    <div className="prompt-area">
                      <div className="prompt-heading-row"><h2 id="composer-heading">{copy[mode].title}</h2><span className="prompt-optional">Sé tan específico como quieras</span></div>
                      <textarea id="creative-prompt" value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder={copy[mode].placeholder} rows={3} />
                      {reference && <div className="reference-pill"><span className="reference-thumb" style={{ backgroundImage: `url(${reference})` }} /><span>Referencia local</span><button type="button" aria-label="Quitar referencia" onClick={() => setReference(null)}><X size={13} /></button></div>}
                      <div className="prompt-footer">
                        <div className="prompt-tools">
                          <label className="tool-button upload-button"><ImagePlus size={15} /> Añadir referencia<input type="file" accept="image/*,video/*" onChange={onUpload} /></label>
                          <button className="tool-button" type="button" onClick={() => setNotice("La transformación de imágenes se activará al conectar un proveedor.")}><Layers3 size={15} /> Transformar</button>
                        </div>
                        <span className="character-count">{prompt.length}/1,000</span>
                      </div>
                    </div>
                    <div className="composer-bottom">
                      <div className="settings-chips"><button type="button" className="setting-chip" onClick={() => setNotice("El selector de estilo estará disponible al conectar el proveedor.")}>Estilo <span>Editorial</span><ChevronDown size={13} /></button><button type="button" className="setting-chip" onClick={() => setNotice("Los modelos aparecerán aquí cuando estén configurados.")}>Modelo <span>Automático</span><ChevronDown size={13} /></button></div>
                      <button className="generate-button" type="submit" disabled={busy}><Sparkles size={16} /> {busy ? "Conectando…" : copy[mode].action} <span className="button-arrow">↗</span></button>
                    </div>
                    {notice && <div className={`notice ${notice.includes("Error") || notice.includes("no se pudo") ? "notice-error" : ""}`} role="status"><ShieldCheck size={15} /> <span>{notice}</span><button type="button" aria-label="Cerrar aviso" onClick={() => setNotice("")}><X size={14} /></button></div>}
                  </form>
                </section>

                <section className="gallery-section">
                  <div className="section-heading-row"><div><div className="eyebrow gallery-eyebrow">PUNTO DE PARTIDA</div><h2>Ideas para explorar</h2></div><button className="text-link" type="button" onClick={() => setSection("Biblioteca")}>Ver biblioteca <ArrowRight size={14} /></button></div>
                  <div className="gallery-grid">
                    {gallery.map((item, index) => (
                      <button key={item.name} className="gallery-card" type="button" onClick={() => { setPrompt(["Retrato editorial con luz cálida de tarde, grano de película y fondo suave", "Jardín mágico con flores de vidrio y luz de amanecer", "Una ciudad futurista suspendida entre nubes violetas", "Personaje 3D amable, con ropa de explorador espacial"][index]); setMode(index === 3 ? "character" : "image"); setNotice(""); }}>
                        <span className={`artwork artwork-${item.tone}`}><span className="art-orbit orbit-one" /><span className="art-orbit orbit-two" /><span className="art-object" /><span className="art-mark">{item.mark}</span><span className="artwork-hover"><Plus size={16} /> Usar idea</span></span>
                        <span className="gallery-card-meta"><span><strong>{item.name}</strong><small>{item.type}</small></span><MoreHorizontal size={17} /></span>
                      </button>
                    ))}
                  </div>
                  <div className="insight-strip"><span className="insight-icon"><Compass size={17} /></span><span><strong>Una idea puede tomar muchas formas.</strong><small>Explora ilustración, video, personajes y voz desde el mismo estudio.</small></span><ArrowRight size={15} /></div>
                </section>
              </>
            ) : (
              <section className="library-view">
                <div className="library-toolbar"><div className="library-search"><Search size={16} /><span>Buscar en {section.toLowerCase()}</span></div><button className="new-project-button" type="button" onClick={() => { setSection("Crear"); selectMode(section === "Voces" ? "voice" : section === "Personajes" ? "character" : "image"); }}><Plus size={15} /> {section === "Personajes" ? "Nuevo personaje" : section === "Voces" ? "Nueva voz" : "Crear nuevo"}</button></div>
                {section === "Personajes" || section === "Voces" ? <div className="empty-state"><span className="empty-icon">{section === "Personajes" ? <UsersRound size={23} /> : <Mic2 size={23} />}</span><h2>{section === "Personajes" ? "Tus personajes empiezan aquí" : "Tu estudio de voz empieza aquí"}</h2><p>{section === "Personajes" ? "Crea un personaje y conserva sus rasgos para tus imágenes y videos." : "Conecta un proveedor de voz para generar narración y sincronizar diálogos."}</p><button className="generate-button" type="button" onClick={() => { setSection("Crear"); selectMode(section === "Personajes" ? "character" : "voice"); }}><Plus size={15} /> {section === "Personajes" ? "Crear personaje" : "Preparar una voz"}</button></div> : <div className="empty-state"><span className="empty-icon"><FolderOpen size={23} /></span><h2>Aquí se guardará tu trabajo</h2><p>Conecta almacenamiento en la nube para conservar proyectos, referencias y resultados.</p><button className="outline-button" type="button" onClick={() => setNotice("D1 y R2 están previstos en la estructura; falta enlazar y configurar el sitio.")}><Settings2 size={15} /> Ver conexión de almacenamiento</button></div>}
                <div className="feature-row"><div><span><Film size={16} /></span><strong>Imagen a video</strong><small>Convierte una imagen en una escena en movimiento.</small></div><div><span><AudioLines size={16} /></span><strong>Voz sincronizada</strong><small>Prepara diálogos para tus personajes y videos.</small></div><div><span><BadgeCheck size={16} /></span><strong>Personajes consistentes</strong><small>Reutiliza la identidad visual en cada escena.</small></div></div>
              </section>
            )}

            <footer className="page-footer"><span><span className="footer-lock"><ShieldCheck size={12} /></span> Tus ideas se mantienen en este espacio.</span><span>ClassicArt Creator <span className="footer-separator">·</span> Vista previa</span></footer>
          </div>
        </div>
      </section>
    </main>
  );
}
