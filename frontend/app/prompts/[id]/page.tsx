type PageProps = {
  params: { id: string };
};

// Simple, compile-safe details page.
// (We can wire real data later; for now this unblocks the build.)
export default function PromptDetailPage({ params }: PageProps) {
  const { id } = params;

  return (
    <div className="max-w-2xl px-6 py-6 space-y-4">
      <h1 className="text-xl font-semibold">Prompt</h1>
      <p className="opacity-70">ID: {id}</p>
      <p className="text-sm">
        This is a placeholder detail view. Once the API is ready, weâ€™ll fetch the prompt text
        and metadata here.
      </p>
    </div>
  );
}


