// frontend/src/app/providers/[id]/page.tsx
// Typed dynamic route params; no any.

type Params = { id: string };

export default async function ProviderDetailPage({
  params,
}: {
  params: Params;
}) {
  const { id } = params;
  return (
    <main aria-label="Provider detail" className="p-6">
      <h1 className="text-xl font-semibold">Provider: {id}</h1>
      <p className="text-sm text-muted-foreground">Details coming soon.</p>
    </main>
  );
}
