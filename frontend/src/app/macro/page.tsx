import Tabs from "@/components/ui/tabs";
import InpageTab from "@/components/ui/inpage-tab";
import TabPanel from "@/components/ui/tab-panel";
import items from "@/data/tabs/macro-inpage.json";
import type { TabItem } from "@/types/nav";

export default function MacroPage() {
  const tabs = items as TabItem[];

  return (
    <section className="space-y-6">
      <h1 className="text-xl font-semibold">Macro</h1>

      <Tabs
        items={tabs}
        defaultSelectedId={tabs[0]?.id}
        persistKey="macro-tabs"
        hashSync
      >
        {/* Header buttons wrapped in a proper tablist */}
        <div role="tablist" aria-label="Macro modules" className="flex gap-2">
          {tabs.map((t) => (
            <InpageTab
              key={t.id}
              id={t.id}
              panelId={t.panelId!}
              label={t.label}
              icon={t.icon}
              disabled={t.disabled}
              badge={t.badge}
            />
          ))}
        </div>

        {/* Panels (now inside <Tabs>, so context is available) */}
        {tabs.map((t) => (
          <TabPanel key={t.id} id={t.panelId!} aria-labelledby={`tab-${t.id}`}>
            <h2 className="text-lg font-semibold">{t.label}</h2>
            <p className="text-sm text-neutral-600 dark:text-neutral-400">
              Content for {t.label} goes here.
            </p>
          </TabPanel>
        ))}
      </Tabs>
    </section>
  );
}

