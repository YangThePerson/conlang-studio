/** Skeleton shown while the phoneme list fetches on the server. */
export default function PhonemesLoading() {
  return (
    <div className="animate-pulse">
      <div className="h-8 w-32 bg-zinc-800 rounded mb-6" />
      <div className="flex gap-2 mb-6">
        <div className="h-10 w-32 bg-zinc-800 rounded" />
        <div className="h-10 w-44 bg-zinc-800 rounded" />
        <div className="h-10 w-16 bg-zinc-800 rounded" />
      </div>
      <ul className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <li key={i} className="h-12 bg-zinc-800 rounded" />
        ))}
      </ul>
    </div>
  );
}
