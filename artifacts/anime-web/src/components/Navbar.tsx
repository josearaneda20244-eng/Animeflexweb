import { Link, useLocation } from "wouter";
import { Search, Bookmark, Clock, Home } from "lucide-react";

const base = import.meta.env.BASE_URL.replace(/\/$/, "");

export default function Navbar() {
  const [location] = useLocation();

  const isActive = (path: string) =>
    path === "/" ? location === "/" : location.startsWith(path);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 md:px-8 h-14 border-b border-[#1E1E32]"
      style={{ background: "rgba(9,10,18,0.92)", backdropFilter: "blur(12px)" }}>
      <Link href="/" className="flex items-center gap-2 select-none">
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center text-sm font-bold"
          style={{ background: "linear-gradient(135deg,#6C63FF,#EC4899)" }}
        >
          ▶
        </div>
        <span className="font-bold text-lg tracking-tight">
          <span style={{ color: "#F0F0FF" }}>Anime</span>
          <span style={{ color: "#6C63FF" }}>FLEX</span>
        </span>
      </Link>

      <div className="flex items-center gap-1">
        <NavBtn href="/" icon={<Home size={18} />} label="Inicio" active={isActive("/")} />
        <NavBtn href="/search" icon={<Search size={18} />} label="Buscar" active={isActive("/search")} />
        <NavBtn href="/favorites" icon={<Bookmark size={18} />} label="Favoritos" active={isActive("/favorites")} />
        <NavBtn href="/history" icon={<Clock size={18} />} label="Historial" active={isActive("/history")} />
      </div>
    </nav>
  );
}

function NavBtn({
  href, icon, label, active,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
        active
          ? "text-[#6C63FF] bg-[#6C63FF]/10"
          : "text-[#9090B0] hover:text-[#F0F0FF] hover:bg-white/5"
      }`}
    >
      {icon}
      <span className="hidden md:inline">{label}</span>
    </Link>
  );
}
