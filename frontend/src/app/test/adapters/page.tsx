import { adapterIds, getAdapter } from "@/app/adapters";

export const dynamic = "force-dynamic";

const SAMPLE =
  "A photorealistic macro shot of a dew-covered leaf at sunrise, ultra-detailed, bokeh";

export default function Page() {
  return (
    <main className="mx-auto max-w-4xl p-8 space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Test: Adapters</h1>
        <p className="text-sm text-neutral-600">
          For a sample prompt, list each adapter&apos;s deepLink target and whether prefill is supported.
        </p>
      </header>

      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="text-left border-b">
            <th className="py-2 pr-3">#</th>
            <th className="py-2 pr-3">Adapter ID</th>
            <th className="py-2 pr-3">Prefill?</th>
            <th className="py-2">URL</th>
          </tr>
        </thead>
        <tbody>
          {adapterIds.map((id, i) => {
            const a = getAdapter(id);
            const link = a.deepLink(a.buildPrompt(SAMPLE));
            return (
              <tr key={id} className="border-b last:border-0">
                <td className="py-2 pr-3">{i + 1}</td>
                <td className="py-2 pr-3 font-mono">{id}</td>
                <td className="py-2 pr-3">{link.supportsPrefill ? "Yes" : "No"}</td>
                <td className="py-2 break-all">
                  <a className="text-blue-600 hover:underline" href={link.prefilledUrl || link.url} target="_blank" rel="noreferrer">
                    {link.prefilledUrl || link.url}
                  </a>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </main>
  );
}



