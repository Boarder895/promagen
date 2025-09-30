// Server component builds the provider list; client buttons will start the simulator.
import RunGrid from './run-grid'
import { getProviders } from "@/lib/providers"

export default async function Page() {
  // Use the Option-A frontend registry
  const all = await getProviders()
  const providers = all.map(p => ({ id: p.id, name: p.name }))

  return (
    <main className="space-y-6">
      <h1 className="text-2xl font-semibold">Demo Â· Generation Progress</h1>
      <p className="opacity-80">
        Click a provider or â€œRun Allâ€. This uses the simulator to mimic generation delays and updates tile badges.
      </p>
      <RunGrid providers={providers} />
    </main>
  )
}
