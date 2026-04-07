export function SkeletonCard() {
  return (
    <div className="rounded-xl overflow-hidden bg-[#0F0F1A] animate-pulse">
      <div className="aspect-[2/3] bg-[#1A1A27]" />
      <div className="p-2">
        <div className="h-3 bg-[#1A1A27] rounded mb-1" />
        <div className="h-2 bg-[#1A1A27] rounded w-2/3" />
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
