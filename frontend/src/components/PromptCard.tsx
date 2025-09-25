// Shim so pages can import "@/components/PromptCard" and pass { p }.
// It re-exports the Prompt type and adapts props to the real component.
import RealPromptCard from "./prompts/PromptCard";
export type { Prompt } from "@/lib/api";

export default function PromptCard({ p }: { p: import("@/lib/api").Prompt }) {
  return <RealPromptCard item={p} />;
}
