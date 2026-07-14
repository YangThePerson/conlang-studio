/** Skeleton shown while the dictionary page fetches its entries. */
export default function DictionaryLoading() {
  return (
    <div className="flex flex-col gap-4 animate-pulse">
      <div className="h-10 bg-gray-600 rounded" />
      <div className="flex flex-wrap gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-10 w-40 bg-gray-600 rounded" />
        ))}
      </div>
      <div className="flex flex-col gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-10 bg-gray-600 rounded" />
        ))}
      </div>
    </div>
  );
}
