// Shown while a coach page loads: the same shapes as the page, so nothing jumps when it arrives.
export default function Loading() {
  return (
    <div className="space-y-8" aria-busy="true" aria-label="Loading">
      <div className="space-y-2">
        <div className="skeleton h-9 w-40" />
        <div className="skeleton h-4 w-28" />
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[0, 1, 2, 3].map((i) => <div key={i} className="skeleton h-[84px] rounded-xl" />)}
      </div>
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4">
          <div className="skeleton h-3 w-24" />
          <div className="skeleton h-56 rounded-xl" />
          <div className="skeleton h-40 rounded-xl" />
        </div>
        <div className="space-y-4">
          <div className="skeleton h-3 w-20" />
          <div className="skeleton h-24 rounded-xl" />
          <div className="skeleton h-40 rounded-xl" />
        </div>
      </div>
    </div>
  );
}
