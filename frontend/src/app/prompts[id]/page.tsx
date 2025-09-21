// Next 15 validator expects `params` as a Promise
export default async function PromptPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <main className="p-6">
      <h1 className="text-xl font-semibold">Prompt {id}</h1>
      <p>Dynamic route is working.</p>
    </main>
  );
}
