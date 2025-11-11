import Link from 'next/link';
import type { Url } from 'next/dist/shared/lib/router/router';

type Props = {
  visitHref?: Url;
  children: React.ReactNode;
};

export default function ProviderTile({ visitHref = '#', children }: Props) {
  return (
    <article role="listitem" className="rounded-xl border border-white/10 bg-white/5 p-3">
      <Link href={visitHref}>{children}</Link>
    </article>
  );
}
