export function SkeletonCard() {
    return (
      <div style={{
        borderRadius: 12, overflow: "hidden",
        background: "#0E0E1A",
        border: "1px solid rgba(255,255,255,0.05)",
      }}>
        <div style={{
          aspectRatio: "2/3",
          background: "linear-gradient(110deg, #0E0E1A 30%, #1A1830 50%, #0E0E1A 70%)",
          backgroundSize: "200% 100%",
          animation: "shimmer 1.6s linear infinite",
        }} />
        <div style={{ padding: "10px 10px 12px" }}>
          <div style={{
            height: 11, borderRadius: 4, marginBottom: 6,
            background: "linear-gradient(110deg, #111124 30%, #1A1830 50%, #111124 70%)",
            backgroundSize: "200% 100%",
            animation: "shimmer 1.6s linear infinite 0.1s",
          }} />
          <div style={{
            height: 9, borderRadius: 4, width: "60%",
            background: "linear-gradient(110deg, #111124 30%, #1A1830 50%, #111124 70%)",
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
  