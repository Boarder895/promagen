'use client';

export function PromptPreview({ rawPrompt, providerId }: { rawPrompt: string; providerId: string }) {
  const stylized =
    providerId === 'midjourney'
      ? `${rawPrompt} --v 5 --ar 16:9`
      : providerId === 'sdxl'
      ? `Positive: ${rawPrompt}\nNegative: low quality, blurry`
      : rawPrompt;

  return (
    <pre className="rounded-md bg-zinc-900 px-4 py-2 text-sm text-zinc-200 whitespace-pre-wrap">
      {stylized || '—'}
    </pre>
  );
}




