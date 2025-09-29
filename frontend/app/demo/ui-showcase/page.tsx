// ───────────────────────────────────────────────────────────────────────────────
// File: frontend/src/app/demo/ui-showcase/page.tsx  (NEW)
// Simple preview page to confirm look & feel quickly.
// Visit /demo/ui-showcase after adding this file.
// ───────────────────────────────────────────────────────────────────────────────
'use client';

import * as React from 'react';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { Card, CardBody, CardFooter, CardHeader } from '@/components/ui/Card';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { ProviderTile } from '@/components/ProviderTile';
import { PromptRunnerLayout } from '@/components/layout/PromptRunnerLayout';

export default function UIShowcase() {
  const [progress, setProgress] = React.useState<number | undefined>(undefined);

  return (
    <main className="mx-auto max-w-screen-xl px-6 py-10">
      <h1 className="text-3xl font-bold tracking-tight text-slate-900">Promagen UI Showcase</h1>
      <p className="mt-2 text-slate-600">Tokens, buttons, chips, cards, provider tiles, progress, and the symmetrical Prompt Runner layout.</p>

      <section className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <div>
              <h2 className="text-xl font-semibold">Buttons</h2>
              <p className="text-sm text-slate-600">Primary, Secondary, Ghost, Destructive</p>
            </div>
          </CardHeader>
          <CardBody className="flex flex-wrap gap-3">
            <Button>Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="destructive">Delete</Button>
            <Button leftIcon={<span>🚀</span>}>With Icon</Button>
            <Button rightIcon={<span>➡️</span>} fullWidth>Full width</Button>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <h2 className="text-xl font-semibold">Chips & Badges</h2>
              <p className="text-sm text-slate-600">Status colors aligned to the design system</p>
            </div>
          </CardHeader>
          <CardBody className="flex flex-wrap gap-2">
            <Chip>Default</Chip>
            <Chip tone="api">⚡ API</Chip>
            <Chip tone="copy">✂️ Copy & Open</Chip>
            <Chip tone="affiliate">💸 Affiliate</Chip>
            <Chip tone="success">Ready</Chip>
            <Chip tone="warning">Queued</Chip>
            <Chip tone="danger">Failed</Chip>
          </CardBody>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <div>
              <h2 className="text-xl font-semibold">Provider Tile</h2>
              <p className="text-sm text-slate-600">Even geometry, centered, action-first</p>
            </div>
          </CardHeader>
          <CardBody>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              <ProviderTile name="OpenAI" apiEnabled affiliate onRun={() => alert('Run OpenAI')} onCopyOpen={() => alert('Copy & Open OpenAI')} />
              <ProviderTile name="Midjourney" apiEnabled={false} affiliate onCopyOpen={() => alert('Copy & Open Midjourney')} />
              <ProviderTile name="Leonardo AI" apiEnabled affiliate onRun={() => alert('Run Leonardo')} onCopyOpen={() => alert('Copy & Open Leonardo')} />
              <ProviderTile name="Artistly" apiEnabled affiliate onRun={() => alert('Run Artistly')} onCopyOpen={() => alert('Copy & Open Artistly')} />
            </div>
          </CardBody>
          <CardFooter>
            <span className="text-sm text-slate-600">Tip: disable the primary button when API isn’t available; rely on Copy & Open.</span>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <h2 className="text-xl font-semibold">Progress Bar</h2>
              <p className="text-sm text-slate-600">Determinate & indeterminate modes</p>
            </div>
          </CardHeader>
          <CardBody className="space-y-4">
            <div className="flex items-center gap-3">
              <Button onClick={() => setProgress(0)}>Reset</Button>
              <Button onClick={() => setProgress(p => (typeof p !== 'number' ? 0 : Math.min(100, p + 10)))}>+10%</Button>
              <Button onClick={() => setProgress(undefined)}>Indeterminate</Button>
            </div>
            <ProgressBar value={progress} />
            <p className="text-sm text-slate-600">Value: {typeof progress === 'number' ? `${progress}%` : 'indeterminate'}</p>
          </CardBody>
        </Card>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-semibold">Prompt Runner Layout (Symmetrical)</h2>
        <p className="text-sm text-slate-600">2-column grid (7/5) with sticky actions on the right. Copy this layout for /prompt.</p>
        <div className="mt-4">
          <PromptRunnerLayout>
            <PromptRunnerLayout.Left>
              <label className="block text-sm font-medium text-slate-700">Prompt</label>
              <textarea className="mt-2 h-48 w-full resize-none rounded-xl border border-slate-200 p-4 focus:outline-none focus:ring-4 focus:ring-primary-200" placeholder="Describe your image…" />
              <div className="mt-3 flex flex-wrap gap-2">
                <Chip>mood: cinematic</Chip>
                <Chip tone="success">style: photorealistic</Chip>
                <Chip tone="api">depth of field</Chip>
              </div>
            </PromptRunnerLayout.Left>
            <PromptRunnerLayout.Right>
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-semibold text-slate-800">Select providers</h3>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <label className="flex items-center gap-2 rounded-xl border border-slate-200 p-3 hover:bg-slate-50">
                      <input type="checkbox" className="size-4" defaultChecked />
                      <span className="text-sm">OpenAI</span>
                    </label>
                    <label className="flex items-center gap-2 rounded-xl border border-slate-200 p-3 hover:bg-slate-50">
                      <input type="checkbox" className="size-4" />
                      <span className="text-sm">Leonardo</span>
                    </label>
                    <label className="flex items-center gap-2 rounded-xl border border-slate-200 p-3 hover:bg-slate-50">
                      <input type="checkbox" className="size-4" />
                      <span className="text-sm">Stability</span>
                    </label>
                    <label className="flex items-center gap-2 rounded-xl border border-slate-200 p-3 hover:bg-slate-50">
                      <input type="checkbox" className="size-4" />
                      <span className="text-sm">Artistly</span>
                    </label>
                  </div>
                </div>

                <div className="space-y-2">
                  <Button onClick={() => alert('Run started')}>
                    Run in Promagen
                  </Button>
                  <Button variant="secondary" onClick={() => alert('Copied prompt & opened')}>
                    Copy & Open Selected
                  </Button>
                  <ProgressBar />
                </div>
              </div>
            </PromptRunnerLayout.Right>
            <PromptRunnerLayout.Footer>
              <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
                <Card>
                  <CardBody>
                    <div className="h-24 grid place-items-center text-slate-500">(result slot)</div>
                  </CardBody>
                </Card>
                <Card>
                  <CardBody>
                    <div className="h-24 grid place-items-center text-slate-500">(result slot)</div>
                  </CardBody>
                </Card>
                <Card>
                  <CardBody>
                    <div className="h-24 grid place-items-center text-slate-500">(result slot)</div>
                  </CardBody>
                </Card>
              </div>
            </PromptRunnerLayout.Footer>
          </PromptRunnerLayout>
        </div>
      </section>
    </main>
  );
}