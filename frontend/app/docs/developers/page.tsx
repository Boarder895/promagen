import { notFound } from "next/navigation";
import { DevelopersBook } from "@/components/Books";

const SHOW_DEV = process.env.NEXT_PUBLIC_SHOW_DEV_BOOK === "true";

export const metadata = {
  title: "Developers' Book Â· Promagen",
  robots: { index: false, follow: false },
};

export default function Page() {
  if (!SHOW_DEV) return notFound();
  return <DevelopersBook />;
}
