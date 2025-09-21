export const dynamic = 'force-dynamic';

type Params = { id: string };

export default async function Page(
  { params }: { params: Promise<Params> }
) {
  const { id } = await params;
  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="text-2xl font-semibold mb-3">Prompt #{id}</h1>
      <p className="opacity-80">Dynamic route is working.</p>
    </main>
  );
}
