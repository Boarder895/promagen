'use client';

import { useState } from 'react';

export default function PromptPlayground() {
  const [value, setValue] = useState('');
  const [output, setOutput] = useState<string | null>(null);

  return (
    <div className="space-y-3">
      <textarea
        className="w-full min-h-32 p-3 rounded-md border"
        placeholder="Type a prompt…"
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
      <button
        className="px-3 py-2 rounded-md border"
        onClick={() => setOutput(value ? `Echo: ${value}` : 'Nothing to run')}
      >
        Run
      </button>
      {output && <pre className="p-3 rounded-md border whitespace-pre-wrap">{output}</pre>}
    </div>
  );
}
