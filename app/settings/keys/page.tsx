import dynamic from "next/dynamic";
const ApiKeysPanel = dynamic(() => import("@/components/ApiKeysPanel"), { ssr: false });
export default function Page() { return <ApiKeysPanel />; }

