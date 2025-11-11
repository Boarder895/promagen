// frontend/src/app/icons/page.tsx
import * as React from "react";
import Icon from "@/components/ui/icon";
import { ICON_REGISTRY } from "@/components/ui/icon-registry";
import type { EmojiName } from "@/components/ui/emoji";

export default function IconsPage() {
  // emoji is now readonly EmojiName[]
  const emojiIcons = ICON_REGISTRY.emoji;
  const lucideIcons = ICON_REGISTRY.lucide;

  return (
    <div className="p-6 space-y-10">
      <section>
        <h1 className="text-2xl font-semibold mb-4">Emoji Icons</h1>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {emojiIcons.map((name: EmojiName) => (
            <div key={name} className="flex items-center gap-3 p-3 rounded-lg border">
              <Icon name={name} className="text-2xl" />
              <code className="text-xs">{name}</code>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-4">Lucide (catalog only)</h2>
        {/* Icon currently supports only emoji; show lucide names as a list */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {lucideIcons.map((name: (typeof lucideIcons)[number]) => (
            <div key={name} className="p-3 rounded-lg border flex items-center">
              <code className="text-xs">{name}</code>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

