import { useLocation } from "wouter";
import { ArrowLeft, Shield, Mail, AlertTriangle, FileWarning, ExternalLink, Scale, Trash2 } from "lucide-react";
import Navbar from "@/components/Navbar";

const MONO = "'JetBrains Mono', ui-monospace, monospace";
const CLIP_8  = "polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)";
const CLIP_14 = "polygon(14px 0, 100% 0, 100% calc(100% - 14px), calc(100% - 14px) 100%, 0 100%, 0 14px)";
const CLIP_6  = "polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)";

const CONTACT_EMAIL = "dmca@animeflex.app";

const cardStyle = (variant: "carmesi" | "ambar" | "alerta" = "carmesi"): React.CSSProperties => {
  const colors = {
    carmesi: { border: "rgba(220,38,38,0.4)", glow: "rgba(220,38,38,0.18)" },
    ambar:   { border: "rgba(249,115,22,0.5)", glow: "rgba(249,115,22,0.2)" },
    alerta:  { border: "rgba(252,165,165,0.5)", glow: "rgba(220,38,38,0.3)" },
  }[variant];
  return {
    background: "linear-gradient(160deg, rgba(20,6,16,0.92), rgba(8,4,18,0.96))",
    border: `1px solid ${colors.border}`,
    clipPath: CLIP_14,
    padding: 24,
    marginBottom: 16,
    position: "relative",
    boxShadow: `0 0 24px ${colors.glow}`,
  };
};

const sectionHeader = (icon: React.ReactNode, tag: string, title: string) => (
  <div style={{ marginBottom: 14, display: "flex", alignItems: "center", gap: 12 }}>
    <div style={{
      width: 36, height: 36,
      background: "linear-gradient(135deg, rgba(220,38,38,0.2), rgba(249,115,22,0.15))",
      border: "1px solid rgba(249,115,22,0.4)",
      clipPath: CLIP_6,
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>{icon}</div>
    <div>
      <div style={{ color: "#F97316", fontSize: 9, fontWeight: 900, letterSpacing: 2, fontFamily: MONO, display: "flex", alignItems: "center", gap: 5 }}>
        <span style={{ width: 4, height: 4, background: "#F97316", borderRadius: "50%", boxShadow: "0 0 6px #F97316" }} />
        {tag}
      </div>
      <div style={{ color: "#FECACA", fontSize: 16, fontWeight: 900, letterSpacing: 0.3, marginTop: 2 }}>{title}</div>
    </div>
  </div>
);

const para: React.CSSProperties = {
  color: "rgba(253,186,116,0.85)", fontSize: 13, lineHeight: 1.7, margin: "0 0 12px",
  fontFamily: "system-ui, sans-serif",
};

const li: React.CSSProperties = {
  color: "rgba(253,186,116,0.8)", fontSize: 13, lineHeight: 1.7, marginBottom: 6,
  paddingLeft: 18, position: "relative",
  fontFamily: "system-ui, sans-serif",
};

const liBullet = (
  <span style={{
    position: "absolute", left: 0, top: 4,
    color: "#F97316", fontSize: 10, fontWeight: 900, fontFamily: MONO,
  }}>{">"}</span>
);

export default function Dmca() {
  const [, navigate] = useLocation();

  return (
    <div style={{ minHeight: "100vh", background: "radial-gradient(ellipse at top, #14060c 0%, #07060b 60%)", position: "relative" }}>
      <Navbar />

      {/* Background */}
      <div style={{
        position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none",
        background: "repeating-linear-gradient(0deg, rgba(249,115,22,0.025) 0px, rgba(249,115,22,0.025) 1px, transparent 1px, transparent 4px)",
      }} />
      <div style={{
        position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none",
        backgroundImage: "linear-gradient(rgba(220,38,38,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(220,38,38,0.04) 1px, transparent 1px)",
        backgroundSize: "32px 32px",
        maskImage: "radial-gradient(ellipse at top, black 10%, transparent 70%)",
        WebkitMaskImage: "radial-gradient(ellipse at top, black 10%, transparent 70%)",
      }} />

      <div style={{ maxWidth: 820, margin: "0 auto", padding: "80px 16px 48px", position: "relative", zIndex: 1 }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 26 }}>
          <button
            onClick={() => navigate("/")}
            style={{
              background: "rgba(220,38,38,0.1)",
              border: "1px solid rgba(249,115,22,0.4)",
              clipPath: CLIP_6,
              padding: "9px 12px", cursor: "pointer", display: "flex", alignItems: "center",
              color: "#FDBA74",
            }}
          >
            <ArrowLeft size={16} />
          </button>
          <div style={{ flex: 1 }}>
            <div style={{ color: "#F97316", fontSize: 9, fontWeight: 900, letterSpacing: 3, fontFamily: MONO, display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 5, height: 5, background: "#F97316", borderRadius: "50%", boxShadow: "0 0 6px #F97316", animation: "syspulse 1.6s ease-in-out infinite" }} />
              [ SISTEMA · AVISO_LEGAL ]
            </div>
            <h1 style={{
              color: "#FECACA", fontSize: 26, fontWeight: 900, margin: "4px 0 0", letterSpacing: 0.5,
              fontFamily: MONO,
              textShadow: "0 0 16px rgba(220,38,38,0.4)",
            }}>
              DMCA &middot; CONTACTO
            </h1>
            <p style={{ color: "rgba(253,186,116,0.6)", fontSize: 11, margin: "2px 0 0", letterSpacing: 1, fontFamily: MONO }}>
              {">"} Política de derechos de autor y aviso de no almacenamiento
            </p>
          </div>
        </div>

        {/* ALERTA principal — no almacenamos contenido */}
        <div style={cardStyle("alerta")}>
          {sectionHeader(<AlertTriangle size={16} color="#FCA5A5" />, "// AVISO_PRINCIPAL", "AnimeFlex NO aloja contenido")}
          <p style={para}>
            <strong style={{ color: "#FECACA" }}>AnimeFlex es un agregador / buscador.</strong> No almacenamos, alojamos, transmitimos
            ni subímos ningún archivo de vídeo, audio o imágenes de mangas en nuestros servidores.
          </p>
          <p style={para}>
            Todo el contenido visible en esta plataforma es <strong style={{ color: "#FDBA74" }}>indexado automáticamente</strong> desde
            servicios de terceros públicamente accesibles en internet. AnimeFlex actúa únicamente como una capa de
            organización e interfaz que facilita la búsqueda; los archivos multimedia se sirven directamente desde los
            servidores de origen, fuera de nuestro control.
          </p>
          <div style={{
            marginTop: 14, padding: "12px 14px",
            background: "rgba(220,38,38,0.1)",
            border: "1px solid rgba(252,165,165,0.4)",
            clipPath: CLIP_8,
            color: "#FECACA", fontSize: 12, fontFamily: MONO, letterSpacing: 0.5, lineHeight: 1.6,
          }}>
            {">"} <strong>RESUMEN_TECNICO:</strong> AnimeFlex no posee, no controla y no se beneficia
            comercialmente de los archivos multimedia indexados. Todos los derechos pertenecen a sus respectivos
            titulares (estudios, distribuidores y editoriales).
          </div>
        </div>

        {/* Cómo funciona */}
        <div style={cardStyle("carmesi")}>
          {sectionHeader(<ExternalLink size={16} color="#FDBA74" />, "// MODULO_01", "Cómo funciona el indexado")}
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            <li style={li}>{liBullet} Nuestros sistemas <strong style={{ color: "#FDBA74" }}>recolectan enlaces públicos</strong> que ya están disponibles en internet.</li>
            <li style={li}>{liBullet} Los enlaces apuntan a recursos alojados por <strong style={{ color: "#FDBA74" }}>terceros independientes</strong> (servicios de vídeo, scanlators, agregadores).</li>
            <li style={li}>{liBullet} Cuando un usuario hace clic en &laquo;reproducir&raquo; o &laquo;leer&raquo;, el contenido se carga <strong style={{ color: "#FDBA74" }}>directamente desde el origen externo</strong> a su navegador.</li>
            <li style={li}>{liBullet} En ningún momento ese contenido pasa por, ni se cachea en, los servidores de AnimeFlex.</li>
            <li style={li}>{liBullet} Los metadatos (títulos, sinopsis, imágenes de portada) provienen de APIs públicas como AniList, MAL y similares, bajo sus respectivas licencias de uso.</li>
          </ul>
        </div>

        {/* DMCA / Notificación */}
        <div style={cardStyle("ambar")}>
          {sectionHeader(<Scale size={16} color="#F97316" />, "// MODULO_02", "Notificación DMCA")}
          <p style={para}>
            Si usted es titular de derechos de autor y considera que un enlace indexado en AnimeFlex apunta a
            contenido que infringe sus derechos, puede solicitar su eliminación del índice mediante una
            notificación DMCA al correo indicado abajo.
          </p>
          <p style={{ ...para, color: "#FDBA74" }}>
            <strong>Su notificación debe incluir:</strong>
          </p>
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            <li style={li}>{liBullet} Identificación de la obra protegida (título, episodio, capítulo).</li>
            <li style={li}>{liBullet} URL exacta dentro de AnimeFlex donde aparece el enlace al material reclamado.</li>
            <li style={li}>{liBullet} Sus datos de contacto: nombre legal completo, correo, teléfono y dirección postal.</li>
            <li style={li}>{liBullet} Declaración jurada de buena fe afirmando que el uso del material no está autorizado.</li>
            <li style={li}>{liBullet} Declaración bajo pena de perjurio de que la información es exacta y de que usted está autorizado a actuar en nombre del titular.</li>
            <li style={li}>{liBullet} Firma electrónica o física del titular o representante autorizado.</li>
          </ul>
          <p style={{ ...para, marginTop: 12 }}>
            Una vez recibida una notificación válida, eliminaremos o deshabilitaremos el enlace en un plazo
            razonable, normalmente inferior a <strong style={{ color: "#FDBA74" }}>72 horas hábiles</strong>.
          </p>
        </div>

        {/* Acciones que tomamos */}
        <div style={cardStyle("carmesi")}>
          {sectionHeader(<Trash2 size={16} color="#FDBA74" />, "// MODULO_03", "Acciones que tomamos")}
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            <li style={li}>{liBullet} Eliminamos el enlace o entrada del índice de AnimeFlex.</li>
            <li style={li}>{liBullet} Notificamos al titular del derecho una vez completada la retirada.</li>
            <li style={li}>{liBullet} Llevamos un registro interno de las solicitudes para evitar reindexado automático.</li>
            <li style={li}>{liBullet} En caso de notificaciones reiteradas y válidas, podemos bloquear de forma permanente la fuente externa correspondiente.</li>
          </ul>
        </div>

        {/* Limitación de responsabilidad */}
        <div style={cardStyle("carmesi")}>
          {sectionHeader(<Shield size={16} color="#FDBA74" />, "// MODULO_04", "Limitación de responsabilidad")}
          <p style={para}>
            AnimeFlex se acoge a las protecciones para proveedores de servicios de la sociedad de la información
            (&laquo;safe harbor&raquo;) previstas en la <strong style={{ color: "#FDBA74" }}>DMCA (17 U.S.C. &sect; 512)</strong> y en la
            <strong style={{ color: "#FDBA74" }}> Directiva 2000/31/CE</strong> de comercio electrónico de la Unión Europea, así como
            normativas equivalentes en otros países.
          </p>
          <p style={para}>
            Como agregador, no tenemos conocimiento previo del contenido específico al que apuntan los enlaces
            externos y no editamos, modificamos ni controlamos el material alojado por terceros. Nuestra
            responsabilidad se limita a actuar diligentemente al recibir una notificación válida.
          </p>
          <p style={{ ...para, marginBottom: 0 }}>
            El usuario es responsable del uso que haga de los enlaces y reconoce que el material proviene
            de servicios de terceros. Recomendamos siempre apoyar a los autores y estudios oficiales adquiriendo
            el contenido a través de las plataformas legales en su país.
          </p>
        </div>

        {/* Contraaviso */}
        <div style={cardStyle("carmesi")}>
          {sectionHeader(<FileWarning size={16} color="#FDBA74" />, "// MODULO_05", "Contraaviso (counter-notice)")}
          <p style={para}>
            Si considera que un enlace fue retirado por error o identificación incorrecta, puede enviar un
            contraaviso al mismo correo, incluyendo:
          </p>
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            <li style={li}>{liBullet} Identificación del enlace retirado y URL donde aparecía.</li>
            <li style={li}>{liBullet} Declaración jurada de buena fe sobre el error o identificación incorrecta.</li>
            <li style={li}>{liBullet} Sus datos de contacto y aceptación de jurisdicción.</li>
            <li style={li}>{liBullet} Firma física o electrónica.</li>
          </ul>
        </div>

        {/* Contacto */}
        <div style={cardStyle("ambar")}>
          {sectionHeader(<Mail size={16} color="#F97316" />, "// CANAL_DIRECTO", "Contacto DMCA")}
          <p style={para}>
            Envíe su notificación, contraaviso o cualquier consulta legal al correo:
          </p>
          <a
            href={`mailto:${CONTACT_EMAIL}?subject=Notificacion%20DMCA%20-%20AnimeFlex`}
            style={{
              display: "inline-flex", alignItems: "center", gap: 10,
              padding: "12px 18px",
              background: "linear-gradient(135deg, rgba(249,115,22,0.25), rgba(220,38,38,0.15))",
              border: "1px solid rgba(253,186,116,0.6)",
              clipPath: CLIP_8,
              color: "#FDBA74", fontSize: 13, fontWeight: 900, letterSpacing: 1.5,
              fontFamily: MONO,
              textDecoration: "none",
              boxShadow: "0 0 16px rgba(249,115,22,0.3)",
              marginTop: 4,
            }}
          >
            <Mail size={14} /> {CONTACT_EMAIL}
          </a>
          <p style={{ ...para, marginTop: 14, marginBottom: 0, fontSize: 12, color: "rgba(253,186,116,0.6)" }}>
            {">"} Tiempo de respuesta estimado: <strong style={{ color: "#FDBA74" }}>24-72 horas hábiles</strong>.
            Las solicitudes incompletas o que no cumplan los requisitos legales no podrán ser procesadas.
          </p>
        </div>

        {/* Footer note */}
        <div style={{
          marginTop: 24, padding: "16px 18px",
          background: "rgba(8,4,18,0.5)",
          border: "1px solid rgba(249,115,22,0.2)",
          clipPath: CLIP_8,
          textAlign: "center",
          fontFamily: MONO, letterSpacing: 1, fontSize: 10, color: "rgba(253,186,116,0.5)",
        }}>
          [ DOCUMENTO_LEGAL &middot; ACTUALIZADO {new Date().toLocaleDateString("es", { month: "long", year: "numeric" }).toUpperCase()} ]
        </div>
      </div>

      <style>{`
        @keyframes syspulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.5; transform: scale(1.3); } }
      `}</style>
    </div>
  );
}
