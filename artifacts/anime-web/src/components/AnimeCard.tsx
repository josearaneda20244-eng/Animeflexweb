import { Link } from "wouter";
import { Star } from "lucide-react";
import { resolveTitle, type AnimeResult } from "@/lib/consumet";

interface AnimeCardProps {
  anime: AnimeResult;
  progress?: number;
}

export default function AnimeCard({ anime, progress }: AnimeCardProps) {
  const title = resolveTitle(anime.title);
  const href = `/anime/${anime.id}`;

  return (
    <Link href={href} className="block">
      <div className="anime-card group cursor-pointer rounded-xl overflow-hidden bg-[#13131C] select-none">
        <div className="relative aspect-[2/3] overflow-hidden bg-[#1A1A27]">
          <img
            src={anime.image}
            alt={title}
            loading="lazy"
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            onError={(e) => {
              (e.target as HTMLImageElement).src = `https://placehold.co/200x280/13131C/6C63FF?text=${encodeURIComponent(title.slice(0, 10))}`;
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          {anime.rating != null && (
            <div className="absolute top-2 right-2 flex items-center gap-1 bg-black/70 rounded-full px-2 py-0.5 text-xs font-semibold text-yellow-400">
              <Star size={10} fill="currentColor" />
              {(anime.rating / 10).toFixed(1)}
            </div>
          )}
          {anime.type && (
            <div className="absolute top-2 left-2 bg-[#6C63FF]/90 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase text-white">
              {anime.type}
            </div>
          )}
          {progress != null && progress > 0 && (
            <div className="absolute bottom-0 left-0 right-0 progress-bar rounded-none">
              <div className="progress-fill" style={{ width: `${Math.min(progress * 100, 100)}%` }} />
            </div>
          )}
        </div>
        <div className="p-2">
          <p className="text-xs font-medium text-[#F0F0FF] line-clamp-2 leading-tight">{title}</p>
          {anime.status && (
            <p className="text-[10px] text-[#9090B0] mt-0.5">{anime.status}</p>
          )}
        </div>
      </div>
    </Link>
  );
}
