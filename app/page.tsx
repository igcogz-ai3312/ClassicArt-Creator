"use client";

import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import Image from "next/image";
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
type VoiceOption = { voiceId: string; name: string; category: string };
type LibraryItem = { id: string; name?: string; description?: string; kind?: "image" | "video" | "audio"; fileName?: string; createdAt?: string; url?: string | null; consentStatus?: string };

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
  const [referenceDataUrl, setReferenceDataUrl] = useState<string | null>(null);
  const [result, setResult] = useState<{ url: string; type: "image" | "video" | "audio" } | null>(null);
  const [pendingGenerationId, setPendingGenerationId] = useState("");
  const [libraryItems, setLibraryItems] = useState<LibraryItem[]>([]);
  const [libraryLoadedFor, setLibraryLoadedFor] = useState<Section | "">("");
  const [activeProject, setActiveProject] = useState<{ id: string; name: string } | null>(null);
  const [projectName, setProjectName] = useState("");
  const [creatingProject, setCreatingProject] = useState(false);
  const [busy, setBusy] = useState(false);
  const [cloning, setCloning] = useState(false);
  const [generationConnected, setGenerationConnected] = useState(false);
  const [voiceConnected, setVoiceConnected] = useState(false);
  const [voices, setVoices] = useState<VoiceOption[]>([]);
  const [selectedVoiceId, setSelectedVoiceId] = useState("");
  const [voiceName, setVoiceName] = useState("");
  const [voiceSample, setVoiceSample] = useState<File | null>(null);
  const [consentConfirmed, setConsentConfirmed] = useState(false);
  const [syncVideo, setSyncVideo] = useState<{ name: string; dataUrl: string } | null>(null);
  const [syncConsentConfirmed, setSyncConsentConfirmed] = useState(false);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    let active = true;
    fetch("/api/health")
      .then(async (response) => await response.json() as { integrations?: { image?: boolean; voice?: boolean } })
      .then((health) => {
        if (active) {
          setGenerationConnected(Boolean(health.integrations?.image));
          setVoiceConnected(Boolean(health.integrations?.voice));
        }
      })
      .catch(() => undefined);
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (mode !== "voice") return;
    let active = true;
    fetch("/api/voices")
      .then(async (response) => response.ok ? await response.json() as { voices?: VoiceOption[] } : null)
      .then((data) => {
        if (!active || !data?.voices) return;
        setVoices(data.voices);
        setSelectedVoiceId((current) => current || data.voices?.[0]?.voiceId || "");
      })
      .catch(() => undefined);
    return () => { active = false; };
  }, [mode]);

  useEffect(() => {
    if (section === "Crear") return;
    let active = true;
    const sectionKey = section === "Biblioteca" ? "assets" : section === "Personajes" ? "characters" : section === "Voces" ? "voices" : "projects";
    fetch(`/api/library?section=${sectionKey}`)
      .then(async (response) => response.ok ? await response.json() as { items?: LibraryItem[] } : null)
      .then((data) => {
        if (!active) return;
        setLibraryItems(data?.items ?? []);
        setLibraryLoadedFor(section);
      })
      .catch(() => {
        if (!active) return;
        setLibraryItems([]);
        setLibraryLoadedFor(section);
      });
    return () => { active = false; };
  }, [section]);
  const libraryLoading = section !== "Crear" && libraryLoadedFor !== section;

  const selectMode = (next: Mode) => {
    setMode(next);
    setSection("Crear");
    setNotice("");
  };

  const onUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setNotice("Elige una imagen como referencia. La sincronización de video se prepara en la sección de voz.");
      event.target.value = "";
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setNotice("La referencia debe pesar menos de 8 MB.");
      event.target.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setReference(URL.createObjectURL(file));
        setReferenceDataUrl(reader.result);
        setNotice("Referencia lista. Se enviará al proveedor solo cuando inicies la generación.");
      }
    };
    reader.onerror = () => setNotice("No se pudo leer la imagen de referencia.");
    reader.readAsDataURL(file);
  };

  const onCreateProject = async () => {
    if (!projectName.trim()) {
      setNotice("Escribe un nombre para tu proyecto.");
      return;
    }
    setCreatingProject(true);
    try {
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: projectName.trim() }),
      });
      const data = await response.json() as { id?: string; name?: string; message?: string };
      if (!response.ok || !data.id || !data.name) throw new Error(data.message ?? "No se pudo crear el proyecto.");
      const project = { id: data.id, name: data.name };
      setActiveProject(project);
      setLibraryItems((current) => [{ ...project }, ...current]);
      setLibraryLoadedFor("Proyectos");
      setProjectName("");
      setNotice(`Proyecto “${project.name}” creado y seleccionado.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "No se pudo crear el proyecto.");
    } finally {
      setCreatingProject(false);
    }
  };

  const onReuseCharacter = async (item: LibraryItem) => {
    setSection("Crear");
    selectMode("character");
    setPrompt(item.description ?? item.name ?? "");
    if (!item.url) {
      setNotice("Escribe los rasgos del personaje y añade una imagen de referencia para mantener su apariencia.");
      return;
    }
    try {
      const response = await fetch(item.url);
      if (!response.ok) throw new Error("No se pudo cargar la referencia del personaje.");
      const blob = await response.blob();
      setReference(URL.createObjectURL(blob));
      setReferenceDataUrl(await readDataUrl(blob));
      setNotice("Personaje cargado como referencia para mantener su apariencia.");
    } catch {
      setNotice("El personaje está disponible, pero no se pudo cargar su imagen de referencia.");
    }
  };

  const onGenerate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!prompt.trim()) {
      setNotice("Escribe una descripción para empezar.");
      return;
    }
    setBusy(true);
    setNotice("");
    setResult(null);
    try {
      const endpoint = mode === "voice" ? "/api/voice-synthesis" : "/api/generations";
      const requestBody = mode === "voice"
        ? { text: prompt.trim(), ...(selectedVoiceId ? { voiceId: selectedVoiceId } : {}), ...(activeProject ? { projectId: activeProject.id } : {}) }
        : { mode, prompt: prompt.trim(), ...(referenceDataUrl ? { referenceImage: referenceDataUrl } : {}), ...(activeProject ? { projectId: activeProject.id } : {}) };
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(requestBody),
      });
      if (mode === "voice") {
        if (!response.ok) {
          const failure = await response.json() as { message?: string };
          setNotice(failure.message ?? "No se pudo preparar la voz.");
          return;
        }
        const audio = await response.blob();
        setResult({ url: URL.createObjectURL(audio), type: "audio" });
        setNotice("Audio listo. Puedes escucharlo y descargarlo.");
        return;
      }
      const submitted = (await response.json()) as { message?: string; generationId?: string };
      if (!response.ok) {
        setNotice(submitted.message ?? "No se pudo iniciar la generación.");
        return;
      }
      if (!submitted.generationId) {
        setNotice("El proveedor aceptó la solicitud, pero no devolvió el identificador de seguimiento.");
        return;
      }
      setPendingGenerationId(submitted.generationId);

      setNotice("Solicitud recibida. Preparando tu resultado…");
      for (let attempt = 0; attempt < 45; attempt++) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        const statusUrl = new URLSearchParams({ generationId: submitted.generationId });
        const statusResponse = await fetch(`/api/generations?${statusUrl.toString()}`);
        const job = (await statusResponse.json()) as { status?: string; mediaUrl?: string; mediaType?: "image" | "video"; error?: string; message?: string };
        if (!statusResponse.ok) throw new Error(job.message ?? "No se pudo consultar el estado de la generación.");
        if (job.status === "succeeded" && job.mediaUrl && job.mediaType) {
          setResult({ url: job.mediaUrl, type: job.mediaType });
          setPendingGenerationId("");
          setNotice("Listo. Revisa y descarga el resultado.");
          return;
        }
        if (job.status === "failed") {
          setPendingGenerationId("");
          throw new Error(job.error ?? "El proveedor no pudo completar la generación.");
        }
        setNotice(job.status === "queued" ? "Tu solicitud está en la fila del proveedor…" : "Generando tu resultado…");
      }
      setNotice("La generación sigue en proceso. Puedes revisar su estado desde aquí.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "No se pudo completar la solicitud. Tu descripción y referencia siguen aquí.");
    } finally {
      setBusy(false);
    }
  };

  const onCloneVoice = async () => {
    if (!voiceSample) {
      setNotice("Selecciona una muestra de audio para crear la voz.");
      return;
    }
    if (!consentConfirmed) {
      setNotice("Confirma que eres titular de la voz o tienes su autorización explícita.");
      return;
    }
    setCloning(true);
    setNotice("");
    try {
      const form = new FormData();
      form.set("name", voiceName.trim() || "Mi voz");
      form.set("sample", voiceSample);
      form.set("consentConfirmed", "true");
      const response = await fetch("/api/voice-clones", { method: "POST", body: form });
      const data = await response.json() as { voiceId?: string; name?: string; message?: string; consentAttested?: boolean };
      if (!response.ok || !data.voiceId) {
        setNotice(data.message ?? "No se pudo crear la voz.");
        return;
      }
      const voice = { voiceId: data.voiceId, name: data.name ?? (voiceName.trim() || "Mi voz"), category: "cloned" };
      setVoices((current) => [voice, ...current.filter((item) => item.voiceId !== voice.voiceId)]);
      setSelectedVoiceId(voice.voiceId);
      setVoiceSample(null);
      setConsentConfirmed(false);
      setNotice("Voz creada. Quedó registrada tu confirmación de consentimiento.");
    } catch {
      setNotice("No se pudo conectar con el servicio de voz.");
    } finally {
      setCloning(false);
    }
  };

  const onSyncVideoUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type || !["video/mp4", "video/webm", "video/quicktime"].includes(file.type.toLowerCase()) || file.size > 18 * 1024 * 1024) {
      setNotice("El video debe ser MP4, WebM o MOV y pesar menos de 18 MB.");
      event.target.value = "";
      return;
    }
    try {
      setSyncVideo({ name: file.name, dataUrl: await readDataUrl(file) });
      setNotice("Video listo para sincronizar.");
    } catch {
      setNotice("No se pudo leer el video.");
    }
  };

  const onSyncVoice = async () => {
    if (!syncVideo) {
      setNotice("Selecciona un video para sincronizar.");
      return;
    }
    if (!prompt.trim()) {
      setNotice("Escribe el diálogo que quieres sincronizar con el personaje.");
      return;
    }
    if (!syncConsentConfirmed) {
      setNotice("Confirma que tienes autorización para usar la persona y el audio de esta sincronización.");
      return;
    }
    setSyncing(true);
    setResult(null);
    try {
      setNotice("Preparando el diálogo…");
      const audioResponse = await fetch("/api/voice-synthesis", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: prompt.trim(), ...(selectedVoiceId ? { voiceId: selectedVoiceId } : {}), ...(activeProject ? { projectId: activeProject.id } : {}) }),
      });
      if (!audioResponse.ok) {
        const error = await audioResponse.json() as { message?: string };
        throw new Error(error.message ?? "No se pudo preparar el audio.");
      }
      const audioDataUrl = await readDataUrl(await audioResponse.blob());
      const response = await fetch("/api/lip-sync", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ videoDataUrl: syncVideo.dataUrl, audioDataUrl, text: prompt.trim(), consentConfirmed: true, ...(activeProject ? { projectId: activeProject.id } : {}) }),
      });
      const submitted = await response.json() as { message?: string; generationId?: string };
      if (!response.ok || !submitted.generationId) {
        throw new Error(submitted.message ?? "No se pudo iniciar la sincronización.");
      }
      setPendingGenerationId(submitted.generationId);
      setNotice("Sincronizando los labios con el diálogo…");
      for (let attempt = 0; attempt < 45; attempt++) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        const params = new URLSearchParams({ generationId: submitted.generationId });
        const statusResponse = await fetch(`/api/generations?${params.toString()}`);
        const job = await statusResponse.json() as { status?: string; mediaUrl?: string; mediaType?: "image" | "video"; error?: string; message?: string };
        if (!statusResponse.ok) throw new Error(job.message ?? "No se pudo consultar el estado de la sincronización.");
        if (job.status === "succeeded" && job.mediaUrl && job.mediaType) {
          setResult({ url: job.mediaUrl, type: job.mediaType });
          setPendingGenerationId("");
          setNotice("Sincronización lista. Revisa y descarga el video.");
          return;
        }
        if (job.status === "failed") {
          setPendingGenerationId("");
          throw new Error(job.error ?? "No se pudo sincronizar el video.");
        }
        setNotice(job.status === "queued" ? "Tu sincronización está en la fila…" : "Sincronizando los labios…");
      }
      setNotice("La sincronización sigue en proceso. Puedes revisar su estado desde aquí.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "No se pudo completar la sincronización.");
    } finally {
      setSyncing(false);
    }
  };

  const onCheckPendingGeneration = async () => {
    if (!pendingGenerationId) return;
    setBusy(true);
    try {
      for (let attempt = 0; attempt < 45; attempt++) {
        const response = await fetch(`/api/generations?generationId=${encodeURIComponent(pendingGenerationId)}`);
        const job = await response.json() as { status?: string; mediaUrl?: string; mediaType?: "image" | "video"; error?: string; message?: string };
        if (!response.ok) throw new Error(job.message ?? "No se pudo consultar la generación.");
        if (job.status === "succeeded" && job.mediaUrl && job.mediaType) {
          setResult({ url: job.mediaUrl, type: job.mediaType });
          setPendingGenerationId("");
          setNotice("Resultado listo y guardado en tu biblioteca.");
          return;
        }
        if (job.status === "failed") {
          setPendingGenerationId("");
          throw new Error(job.error ?? "La generación no pudo completarse.");
        }
        setNotice(job.status === "queued" ? "Tu solicitud sigue en la fila…" : "La generación sigue trabajando…");
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
      setNotice("La generación continúa en proceso. Puedes volver a revisar su estado.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "No se pudo consultar la generación.");
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
            <span className="connection-status"><i className={(mode === "voice" ? voiceConnected : generationConnected) ? "connected-dot" : ""} /> {(mode === "voice" ? voiceConnected : generationConnected) ? "Generación conectada" : "Modo de prueba"}</span>
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
              <button className="new-project-button" type="button" onClick={() => { setSection("Proyectos"); setProjectName(""); setNotice(""); }}><Plus size={16} /> Nuevo proyecto</button>
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
                    {activeProject && <div className="active-project-notice"><FolderOpen size={13} /> Guardando en <strong>{activeProject.name}</strong><button type="button" onClick={() => setActiveProject(null)}>Quitar proyecto</button></div>}
                    <label className="sr-only" htmlFor="creative-prompt">Descripción de creación</label>
                    <div className="prompt-area">
                      <div className="prompt-heading-row"><h2 id="composer-heading">{copy[mode].title}</h2><span className="prompt-optional">Sé tan específico como quieras</span></div>
                      <textarea id="creative-prompt" value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder={copy[mode].placeholder} rows={3} />
                      {mode === "voice" && <div className="voice-clone-box">
                        <div className="voice-clone-heading"><strong>Clonar una voz con autorización</strong><small>Usa una grabación limpia de la persona titular.</small></div>
                        <div className="voice-clone-fields">
                          <input aria-label="Nombre de la voz" value={voiceName} onChange={(event) => setVoiceName(event.target.value)} placeholder="Nombre de la voz" maxLength={64} />
                          <label className="voice-file-label">{voiceSample ? voiceSample.name : "Elegir muestra de audio"}<input type="file" accept="audio/mpeg,audio/mp3,audio/wav,audio/x-wav,audio/mp4,audio/m4a,audio/webm,audio/ogg,audio/flac" onChange={(event) => setVoiceSample(event.target.files?.[0] ?? null)} /></label>
                          <label className="voice-consent"><input type="checkbox" checked={consentConfirmed} onChange={(event) => setConsentConfirmed(event.target.checked)} /><span>Confirmo que soy titular de esta voz o tengo autorización explícita para clonarla.</span></label>
                          <button className="outline-button" type="button" onClick={onCloneVoice} disabled={cloning}>{cloning ? "Creando voz…" : "Crear clon de voz"}</button>
                        </div>
                      </div>}
                      {mode === "voice" && <div className="voice-clone-box sync-box">
                        <div className="voice-clone-heading"><strong>Sincronizar diálogo con un video</strong><small>El diálogo escrito arriba se convierte en voz y se alinea con el rostro del video.</small></div>
                        <div className="voice-clone-fields sync-fields">
                          <label className="voice-file-label">{syncVideo?.name ?? "Elegir video MP4, WebM o MOV"}<input type="file" accept="video/mp4,video/webm,video/quicktime" onChange={onSyncVideoUpload} /></label>
                          <label className="voice-consent"><input type="checkbox" checked={syncConsentConfirmed} onChange={(event) => setSyncConsentConfirmed(event.target.checked)} /><span>Confirmo que tengo permiso para usar la imagen y el diálogo de este video.</span></label>
                          <button className="outline-button" type="button" onClick={onSyncVoice} disabled={syncing}>{syncing ? "Sincronizando…" : "Crear video sincronizado"}</button>
                        </div>
                      </div>}
                      {reference && <div className="reference-pill"><span className="reference-thumb" style={{ backgroundImage: `url(${reference})` }} /><span>Referencia lista</span><button type="button" aria-label="Quitar referencia" onClick={() => { setReference(null); setReferenceDataUrl(null); }}><X size={13} /></button></div>}
                      <div className="prompt-footer">
                        <div className="prompt-tools">
                          <label className="tool-button upload-button"><ImagePlus size={15} /> Añadir referencia<input type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/avif" onChange={onUpload} /></label>
                          <button className="tool-button" type="button" onClick={() => setNotice("La transformación de imágenes se activará al conectar un proveedor.")}><Layers3 size={15} /> Transformar</button>
                        </div>
                        <span className="character-count">{prompt.length}/1,000</span>
                      </div>
                    </div>
                    <div className="composer-bottom">
                      <div className="settings-chips">{mode === "voice" ? <label className="voice-select-label">Voz <select className="voice-select" aria-label="Seleccionar voz" value={selectedVoiceId} onChange={(event) => setSelectedVoiceId(event.target.value)}><option value="">Selecciona una voz</option>{voices.map((voice) => <option key={voice.voiceId} value={voice.voiceId}>{voice.name}</option>)}</select></label> : <><button type="button" className="setting-chip" onClick={() => setNotice("El selector de estilo estará disponible al conectar el proveedor.")}>Estilo <span>Editorial</span><ChevronDown size={13} /></button><button type="button" className="setting-chip" onClick={() => setNotice("Los modelos aparecerán aquí cuando estén configurados.")}>Modelo <span>Automático</span><ChevronDown size={13} /></button></>}</div>
                      <button className="generate-button" type="submit" disabled={busy}><Sparkles size={16} /> {busy ? "Conectando…" : copy[mode].action} <span className="button-arrow">↗</span></button>
                    </div>
                    {notice && <div className={`notice ${notice.includes("Error") || notice.includes("no se pudo") ? "notice-error" : ""}`} role="status"><ShieldCheck size={15} /> <span>{notice}</span><button type="button" aria-label="Cerrar aviso" onClick={() => setNotice("")}><X size={14} /></button></div>}
                    {result && <div className="result-preview">
                      {result.type === "image" ? <Image src={result.url} alt="Resultado de imagen generado" width={1024} height={1024} unoptimized /> : result.type === "video" ? <video src={result.url} controls playsInline /> : <audio src={result.url} controls />}
                      <a href={result.url} target="_blank" rel="noreferrer" download>Descargar resultado <ArrowDownToLine size={14} /></a>
                    </div>}
                    {pendingGenerationId && <div className="pending-generation"><Clock3 size={15} /><span>Hay un trabajo en proceso.</span><button type="button" className="text-link" onClick={onCheckPendingGeneration} disabled={busy}>{busy ? "Consultando…" : "Revisar estado"}</button></div>}
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
                <div className="library-toolbar">{section === "Proyectos" ? <input className="project-name-input" aria-label="Nombre del proyecto" value={projectName} onChange={(event) => setProjectName(event.target.value)} placeholder="Nombre del proyecto" maxLength={80} /> : <div className="library-search"><Search size={16} /><span>Buscar en {section.toLowerCase()}</span></div>}<button className="new-project-button" type="button" onClick={() => section === "Proyectos" ? void onCreateProject() : (setSection("Crear"), selectMode(section === "Voces" ? "voice" : section === "Personajes" ? "character" : "image"))} disabled={creatingProject}><Plus size={15} /> {section === "Personajes" ? "Nuevo personaje" : section === "Voces" ? "Nueva voz" : section === "Proyectos" ? creatingProject ? "Creando…" : "Crear proyecto" : "Crear nuevo"}</button></div>
                {libraryLoading ? <div className="empty-state"><span className="empty-icon"><Clock3 size={23} /></span><h2>Cargando {section.toLowerCase()}…</h2><p>Buscando tus archivos guardados.</p></div> : libraryItems.length ? <div className="saved-items-grid">{libraryItems.map((item) => <article className="saved-item" key={item.id}>{item.url && item.kind === "image" ? <Image src={item.url} alt={item.name ?? item.fileName ?? "Imagen guardada"} width={480} height={360} unoptimized /> : item.url && item.kind === "video" ? <video src={item.url} controls playsInline /> : <span className="saved-item-icon">{section === "Personajes" ? <UsersRound size={22} /> : section === "Voces" ? <Mic2 size={22} /> : <FolderOpen size={22} />}</span>}<div><strong>{item.name ?? item.fileName ?? "Elemento guardado"}</strong>{item.description && <p>{item.description}</p>}{item.kind && <small>{item.kind.toUpperCase()} · {item.createdAt ? new Date(item.createdAt).toLocaleDateString() : "Guardado"}</small>}{item.consentStatus && <small>Consentimiento registrado · {item.consentStatus}</small>}</div>{section === "Personajes" && <button type="button" className="text-link saved-item-action" onClick={() => void onReuseCharacter(item)}>Reutilizar personaje</button>}{section === "Proyectos" && <button type="button" className="text-link saved-item-action" onClick={() => { if (item.name) setActiveProject({ id: item.id, name: item.name }); setSection("Crear"); setNotice(`Proyecto “${item.name ?? ""}” seleccionado.`); }}>Usar proyecto</button>}{item.url && item.kind !== "video" && item.kind !== "image" && <a href={item.url} download>Descargar</a>}</article>)}</div> : <div className="empty-state"><span className="empty-icon">{section === "Personajes" ? <UsersRound size={23} /> : section === "Voces" ? <Mic2 size={23} /> : <FolderOpen size={23} />}</span><h2>{section === "Biblioteca" ? "Aquí se guardará tu trabajo" : section === "Personajes" ? "Tus personajes empiezan aquí" : section === "Voces" ? "Tu estudio de voz empieza aquí" : "Crea tu primer proyecto"}</h2><p>{section === "Biblioteca" ? "Los resultados de imagen, video, voz y personajes aparecerán aquí al generarlos." : section === "Personajes" ? "Crea un personaje y conserva su referencia para volver a usarlo." : section === "Voces" ? "Las voces clonadas con autorización aparecerán aquí." : "Organiza tus creaciones en proyectos."}</p><button className="generate-button" type="button" onClick={() => { setSection("Crear"); selectMode(section === "Personajes" ? "character" : section === "Voces" ? "voice" : "image"); }}><Plus size={15} /> {section === "Personajes" ? "Crear personaje" : section === "Voces" ? "Preparar una voz" : "Crear contenido"}</button></div>}
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

function readDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("No se pudo leer el archivo."));
    reader.onerror = () => reject(new Error("No se pudo leer el archivo."));
    reader.readAsDataURL(blob);
  });
}
