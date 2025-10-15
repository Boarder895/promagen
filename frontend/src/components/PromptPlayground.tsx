'use client';
import * as React from 'react';
import Button from '@/components/ui/Button';
import ProgressBar from '@/components/ui/ProgressBar';

export default function PromptPlayground() {
  const [text, setText] = React.useState('');
  return (
    <div className="p-6 space-y-4">
      <textarea
        className="w-full border rounded p-3"
        rows={6}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Type a prompt…"
      />
      <Button onClick={() => alert(text || 'No prompt yet')}>Run</Button>
      <ProgressBar value={text.length % 101} />
    </div>
  );
}
