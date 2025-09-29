import { remark } from "remark";
import remarkHtml from "remark-html";
import { loadMarkdownBySlug } from "@/lib/docs";

export const dynamic = "force-dynamic"; // keep hot reload friendly while you iterate

export default async function DocPage({ params }: { params: { slug: string } }) {
  let md: string;
  try {
    md = loadMarkdownBySlug(params.slug);
  } catch (e: any) {
    return (
      <main className="p-6 space-y-4">
        <h1 className="text-2xl font-semibold">Document not found</h1>
        <p className="opacity-70">{String(e.message)}</p>
        <p>
          Create <code>frontend/docs/{params.slug}.md</code> or visit{" "}
          <a className="underline" href="/docs">/docs</a>.
        </p>
      </main>
    );
  }

  const processed = await remark().use(remarkHtml).process(md);
  const htmlStr = String(processed);

  return (
    <main className="p-6 space-y-6">
      <div className="markdown-body" dangerouslySetInnerHTML={{ __html: htmlStr }} />
    </main>
  );
}
