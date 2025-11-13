import { redirect } from "next/navigation";

export const dynamic = "force-static";
export const metadata = {
  robots: { index: false, follow: true },
};

export default function Page(): never {
  redirect("/providers/leaderboard");
}
