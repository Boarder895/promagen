'use client';

import { useMemo } from 'react';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkRehype from 'remark-rehype';
import rehypeRaw from 'rehype-raw';
import rehypeSlug from 'rehype-slug';
import rehypeAutolinkHeadings from 'rehype-autolink-headings';
import rehypeSanitize from 'rehype-sanitize';
import rehypeStringify from 'rehype-stringify';

type Props = { markdown: string };

export default function Markdown({ markdown }: Props) {
  const html = useMemo(() => {
    // Proper pipeline: Markdown (remark) -> HTML (rehype)
    const file = unified()
      .use(remarkParse)
      .use(remarkGfm)
      .use(remarkRehype, { allowDangerousHtml: true })
      .use(rehypeRaw) // allow inline HTML from markdown
      .use(rehypeSlug)
      .use(rehypeAutolinkHeadings, { behavior: 'wrap' })
      .use(rehypeSanitize)
      .use(rehypeStringify)
      .processSync(markdown);

    return String(file);
  }, [markdown]);

  return (
    <article
      className="prose prose-zinc max-w-none dark:prose-invert"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}


