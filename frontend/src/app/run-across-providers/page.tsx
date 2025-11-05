export default function RunAcrossProvidersPage({
  searchParams,
}: {
  searchParams?: { promptId?: string };
}) {
  const promptId = searchParams?.promptId ?? "";

  return (
    <main className="p-8">
      <h1 className="text-2xl font-semibold">Run across providers</h1>
      <p className="opacity-70 text-sm">
        Placeholder for Stage&nbsp;2. Query: <code>?promptId={promptId}</code>
      </p>
    </main>
  );
}

