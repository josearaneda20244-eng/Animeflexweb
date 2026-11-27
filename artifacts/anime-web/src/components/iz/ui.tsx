import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useLocation } from "wouter";
import { ChevronLeft, ChevronRight, Play, Star, X } from "lucide-react";

/* ═══════════════════════════════════════════════════════════════
   IZIFF ANIME — componentes base del sistema de diseño (.iz-*)
═══════════════════════════════════════════════════════════════ */

export function SectionHead({
  eyebrow, title, serif, id, action, onAction,
}: {
  eyebrow?: string;
  title: string;
  /** Parte del título en Instrument Serif itálica */
  serif?: string;
  id?: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <div className="iz-head" id={id}>
      <div style={{ minWidth: 0 }}>
        {eyebrow && <div className="iz-head__eyebrow"><span className="iz-dot" />{eyebrow}</div>}
        <h2 className="iz-head__title">
          {title}{serif && <> <span className="iz-serif">{serif}</span></>}
        </h2>
      </div>
      {onAction && (
        <button type="button" className="iz-head__link" onClick={onAction}>
          {action ?? "Ver todo"} <ChevronRight size={15} />
        </button>
      )}
    </div>
  );
}

/** Carril horizontal con flechas (desktop) y scroll táctil (móvil). */
export function Rail({ children, label }: { children: ReactNode; label?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ l: false, r: false });

  const update = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const l = el.scrollLeft > 4;
    const r = el.scrollLeft + el.clientWidth < el.scrollWidth - 4;
    setEdges((prev) => (prev.l === l && prev.r === r ? prev : { l, r }));
  }, []);

  useEffect(() => {
    update();
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [update, children]);

  const scroll = (dir: 1 | -1) => {
    const el = ref.current;
    if (!el) return;
    el.scrollBy({ left: dir * Math.max(240, el.clientWidth * 0.85), behavior: "smooth" });
  };

  return (
    <div className="iz-rail" role="region" aria-label={label}>
      <button type="button" aria-label="Anterior" className={`iz-rail__arrow iz-rail__arrow--l ${edges.l ? "is-on" : ""}`} onClick={() => scroll(-1)}>
        <ChevronLeft size={20} />
      </button>
      <div ref={ref} className="iz-rail__track" onScroll={update}>{children}</div>
      <button type="button" aria-label="Siguiente" className={`iz-rail__arrow iz-rail__arrow--r ${edges.r ? "is-on" : ""}`} onClick={() => scroll(1)}>
        <ChevronRight size={20} />
      </button>
    </div>
  );
}

export interface PosterData {
  id: string | number;
  title: string;
  image: string;
  /** Texto pequeño bajo el título (tipo · año · géneros) */
  meta?: string;
  /** Etiqueta superior izquierda (EP 12, EN EMISIÓN, etc.) */
  badge?: string;
  /** Nota 0-10 */
  score?: number | null;
  href?: string;
  accentBadge?: boolean;
}

export function PosterCard({ data, onClick }: { data: PosterData; onClick?: () => void }) {
  const [, navigate] = useLocation();
  const [loaded, setLoaded] = useState(false);
  const go = () => (onClick ? onClick() : navigate(data.href ?? `/anime/${data.id}`));
  return (
    <button type="button" className="iz-poster" onClick={go} title={data.title}>
      <div className="iz-poster__frame">
        {data.image ? (
          <img
            src={data.image}
            alt={data.title}
            loading="lazy"
            decoding="async"
            onLoad={() => setLoaded(true)}
            style={{ opacity: loaded ? 1 : 0 }}
          />
        ) : null}
        {!loaded && <div className="iz-skel" style={{ position: "absolute", inset: 0, borderRadius: 0 }} />}
        <div className="iz-poster__shade" />
        {(data.badge || (data.score != null && data.score > 0)) && (
          <div className="iz-poster__badges">
            {data.badge ? <span className={`iz-tag ${data.accentBadge ? "iz-tag--accent" : "iz-tag--solid"}`}>{data.badge}</span> : <span />}
            {data.score != null && data.score > 0 && (
              <span className="iz-tag iz-tag--solid"><Star size={10} fill="#fbbf24" color="#fbbf24" />{data.score.toFixed(1)}</span>
            )}
          </div>
        )}
        <div className="iz-poster__play"><Play size={18} fill="#000" /></div>
      </div>
      <div className="iz-poster__title">{data.title}</div>
      {data.meta && <div className="iz-poster__meta">{data.meta}</div>}
    </button>
  );
}

export function WideCard({
  title, image, meta, right, badges, progress, onClick, onRemove,
}: {
  title: string;
  image: string;
  meta?: string;
  right?: string;
  badges?: string[];
  progress?: number;
  onClick: () => void;
  onRemove?: () => void;
}) {
  return (
    <div className="iz-wide" role="button" tabIndex={0} onClick={onClick} onKeyDown={(e) => { if (e.key === "Enter") onClick(); }}>
      <div className="iz-wide__frame">
        {image && <img src={image} alt={title} loading="lazy" decoding="async" />}
        <div className="iz-wide__shade" />
        {badges && badges.length > 0 && (
          <div className="iz-wide__badges">{badges.map((b) => <span key={b} className="iz-tag iz-tag--solid">{b}</span>)}</div>
        )}
        <div className="iz-wide__play"><Play size={17} fill="currentColor" /></div>
        {onRemove && (
          <button type="button" className="iz-wide__x" aria-label="Quitar" onClick={(e) => { e.stopPropagation(); onRemove(); }}>
            <X size={14} />
          </button>
        )}
        {progress != null && progress > 0 && (
          <div className="iz-wide__bar"><i style={{ width: `${Math.min(100, Math.round(progress * 100))}%` }} /></div>
        )}
      </div>
      <div className="iz-wide__title">{title}</div>
      {(meta || right) && <div className="iz-wide__meta"><span>{meta}</span>{right && <span>{right}</span>}</div>}
    </div>
  );
}

export function PosterSkeletons({ count = 8 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="iz-poster" aria-hidden>
          <div className="iz-skel" style={{ aspectRatio: "2 / 3" }} />
          <div className="iz-skel" style={{ height: 12, width: "80%", marginTop: 10, borderRadius: 6 }} />
        </div>
      ))}
    </>
  );
}

export function WideSkeletons({ count = 4 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="iz-wide" aria-hidden>
          <div className="iz-skel" style={{ aspectRatio: "16 / 9" }} />
          <div className="iz-skel" style={{ height: 12, width: "70%", marginTop: 10, borderRadius: 6 }} />
        </div>
      ))}
    </>
  );
}

export function EmptyState({ title, text, action }: { title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="iz-panel iz-panel--pad" style={{ textAlign: "center", padding: "48px 20px" }}>
      <div style={{ fontSize: 18, fontWeight: 600, letterSpacing: "-0.02em" }}>{title}</div>
      {text && <p style={{ margin: "8px auto 0", color: "var(--iz-muted)", fontSize: 14, maxWidth: 420, lineHeight: 1.55 }}>{text}</p>}
      {action && <div style={{ marginTop: 18 }}>{action}</div>}
    </div>
  );
}

/** Puntuación AniList (0-100) o consumet (0-100) → 0-10 */
export function toScore10(v?: number | null): number | null {
  if (v == null || !Number.isFinite(v) || v <= 0) return null;
  return v > 10 ? v / 10 : v;
}
