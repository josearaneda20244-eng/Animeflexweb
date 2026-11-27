import { useQuery } from "@tanstack/react-query";

/** Tiempos de opening/ending exactos vía AniSkip (https://api.aniskip.com), indexado por MAL ID. */
export interface SkipInterval { start: number; end: number }
export interface SkipTimes { op?: SkipInterval; ed?: SkipInterval }

async function fetchMalId(anilistId: string): Promise<number | null> {
  if (!/^\d+$/.test(anilistId)) return null;
  const res = await fetch("https://graphql.anilist.co", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ query: "query($id:Int){Media(id:$id,type:ANIME){idMal}}", variables: { id: Number(anilistId) } }),
  });
  if (!res.ok) return null;
  const json: any = await res.json();
  return json?.data?.Media?.idMal ?? null;
}

async function fetchSkipTimes(malId: number, episode: number, length: number): Promise<SkipTimes> {
  const qs = new URLSearchParams();
  ["op", "ed", "mixed-op", "mixed-ed"].forEach((t) => qs.append("types[]", t));
  qs.set("episodeLength", String(Math.round(length || 0)));
  const res = await fetch(`https://api.aniskip.com/v2/skip-times/${malId}/${episode}?${qs.toString()}`);
  if (!res.ok) return {};
  const json: any = await res.json();
  if (!json?.found || !Array.isArray(json.results)) return {};
  const out: SkipTimes = {};
  for (const r of json.results) {
    const iv = { start: Number(r.interval?.startTime) || 0, end: Number(r.interval?.endTime) || 0 };
    if (iv.end <= iv.start) continue;
    // Si AniSkip conoce la duración de su fuente, re-escalamos a la duración real del video
    const srcLen = Number(r.episodeLength) || 0;
    if (srcLen > 0 && length > 0 && Math.abs(srcLen - length) > 3) {
      const k = length / srcLen;
      iv.start *= k; iv.end *= k;
    }
    if ((r.skipType === "op" || r.skipType === "mixed-op") && !out.op) out.op = iv;
    if ((r.skipType === "ed" || r.skipType === "mixed-ed") && !out.ed) out.ed = iv;
  }
  return out;
}

export function useSkipTimes(anilistId: string, episodeNum: number, duration: number): SkipTimes {
  const mal = useQuery({
    queryKey: ["malId", anilistId],
    queryFn: () => fetchMalId(anilistId),
    enabled: !!anilistId,
    staleTime: Infinity,
    gcTime: 1000 * 60 * 60 * 24,
    retry: 1,
  });
  // Redondeamos la duración para no re-consultar en cada timeupdate
  const lenKey = duration > 0 ? Math.round(duration / 10) * 10 : 0;
  const skip = useQuery({
    queryKey: ["aniskip", mal.data, episodeNum, lenKey],
    queryFn: () => fetchSkipTimes(mal.data as number, episodeNum, lenKey),
    enabled: !!mal.data && episodeNum > 0 && lenKey > 0,
    staleTime: Infinity,
    gcTime: 1000 * 60 * 60,
    retry: 0,
  });
  return skip.data ?? {};
}
