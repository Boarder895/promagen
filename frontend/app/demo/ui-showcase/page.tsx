'use client';

import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { Card, CardHeader, CardFooter } from '@/components/ui/Card';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { PromptRunnerLayout } from '@/components/layout/PromptRunnerLayout';

function UiShowcasePage() {
  return (
    <PromptRunnerLayout>
      <div className="px-2 md:px-4">
        <h2 className="text-xl font-semibold mb-4">UI Showcase</h2>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Buttons & Chips */}
          <Card>
            <CardHeader>
              <h3 className="text-base font-semibold">Buttons &amp; Chips</h3>
            </CardHeader>

            <div className="p-4 flex items-center gap-3">
              {/* Button has no `size` prop; style small with classes */}
              <Button className="text-sm px-3 py-1.5">Run</Button>
              <Button className="text-sm px-3 py-1.5 border">Cancel</Button>

              {/* Chip has no `variant` prop; use simple chips */}
              <Chip className="text-xs">alpha</Chip>
              <Chip className="text-xs">ready</Chip>
              <Chip className="text-xs">wip</Chip>
            </div>

            <CardFooter />
          </Card>

          {/* Progress examples */}
          <Card>
            <CardHeader>
              <h3 className="text-base font-semibold">Progress</h3>
            </CardHeader>
            <div className="p-4 space-y-3">
              <ProgressBar value={25} />
              <ProgressBar value={60} />
              <ProgressBar value={90} />
            </div>
            <CardFooter />
          </Card>
        </div>
      </div>
    </PromptRunnerLayout>
  );
}

export default UiShowcasePage;










