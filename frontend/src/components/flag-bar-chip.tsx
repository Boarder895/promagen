// frontend/src/components/flag-bar-chip.tsx
// Replaces <img> with next/image to satisfy @next/no-img-element.

import Image from 'next/image';

type Props = {
  label: string;
  src: string; // absolute or public path
};

export default function FlagBarChip({ label, src }: Props) {
  return (
    <span className="inline-flex items-center gap-2 rounded bg-white/5 px-2 py-1">
      <Image src={src} alt="" width={18} height={12} aria-hidden="true" />
      <span className="text-sm">{label}</span>
    </span>
  );
}
