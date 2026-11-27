export function SkeletonCard() {
    return (
      <div style={{
        borderRadius: 14, overflow: "hidden",
        background: "#0f0f0f",
        border: "1px solid rgba(255,255,255,0.06)",
        boxShadow: "0 2px 8px rgba(0,0,0,0.35)",
      }}>
        <div style={{
          aspectRatio: "2/3",
          background: "linear-gradient(110deg, #0f0f0f 30%, #1e1e1e 50%, #0f0f0f 70%)",
          backgroundSize: "200% 100%",
          animation: "shimmer 1.6s linear infinite",
        }} />
        <div style={{ padding: "11px 11px 13px" }}>
          <div style={{
            height: 11, borderRadius: 6, marginBottom: 7,
            background: "linear-gradient(110deg, #161616 30%, #212121 50%, #161616 70%)",
            backgroundSize: "200% 100%",
            animation: "shimmer 1.6s linear infinite 0.1s",
          }} />
          <div style={{
            height: 9, borderRadius: 6, width: "60%",
            background: "linear-gradient(110deg, #161616 30%, #212121 50%, #161616 70%)",
            backgroundSize: "200% 100%",
            animation: "shimmer 1.6s linear infinite 0.2s",
          }} />
        </div>
      </div>
    );
  }

  export function SkeletonRow({ count = 6 }: { count?: number }) {
    return (
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-3">
        {Array.from({ length: count }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    );
  }
