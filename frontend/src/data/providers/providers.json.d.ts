// frontend/src/data/providers/providers.json.d.ts

declare module './providers.json' {
  import type { Provider } from '@/types/providers';

  const providers: Provider[];
  export default providers;
}
