import type { GetServerSideProps } from "next";

const MAP: Record<string, string> = {
  openai: "https://YOUR-AFFILIATE/openai",
  leonardo: "https://YOUR-AFFILIATE/leonardo",
  midjourney: "https://YOUR-AFFILIATE/midjourney",
  canva: "https://YOUR-AFFILIATE/canva",
};

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const slug = String(ctx.params?.slug || "").toLowerCase();
  const url = MAP[slug];
  if (!url) return { notFound: true };
  return { redirect: { destination: url, permanent: false } };
};

export default function OutRedirect() { return null; }
