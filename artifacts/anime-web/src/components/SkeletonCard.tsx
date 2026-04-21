export function SkeletonCard() {
    return (
      <div style={{
        borderRadius: 14, overflow: "hidden",
        background: "#0c0c14",
        border: "1px solid rgba(255,255,255,0.06)",
        boxShadow: "0 2px 8px rgba(0,0,0,0.35)",
      }}>
        <div style={{
          aspectRatio: "2/3",
          background: "linear-gradient(110deg, #0c0c14 30%, #1a1a26 50%, #0c0c14 70%)",
          backgroundSize: "200% 100%",
          animation: "shimmer 1.6s linear infinite",
        }} />
        <div style={{ padding: "11px 11px 13px" }}>
          <div style={{
            height: 11, borderRadius: 6, marginBottom: 7,
            background: "linear-gradient(110deg, #111120 30%, #1c1c2c 50%, #111120 70%)",
            backgroundSize: "200% 100%",
            animation: "shimmer 1.6s linear infinite 0.1s",
          }} />
          <div style={{
            height: 9, borderRadius: 6, width: "60%",
            background: "linear-gradient(110deg, #111120 30%, #1c1c2c 50%, #111120 70%)",
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
