"use client";
export default function TrafficLegend() {
  const Dot = ({ c }: { c: string }) => <span className={`w-2 h-2 rounded-full inline-block ${c} mr-2`} />;
  return (
    <div className="text-xs opacity-80 flex items-center gap-4 mb-4">
      <span><Dot c="bg-green-500" />Done</span>
      <span><Dot c="bg-amber-500" />In progress</span>
      <span><Dot c="bg-red-500" />Not started</span>
    </div>
  );
}


