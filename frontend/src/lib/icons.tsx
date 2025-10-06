// src/lib/icons.tsx
// String key -> lucide-react component map; flags use emoji directly.

import {
  ArrowUpRight, ArrowDownRight, Minus, Clock, Bell, Info,
  Flame, Megaphone, Tag, TrendingUp, TrendingDown
} from "lucide-react";
import * as React from "react";

export const iconMap: Record<string, React.ReactNode> = {
  "arrow-up": <ArrowUpRight className="w-4 h-4" />,
  "arrow-down": <ArrowDownRight className="w-4 h-4" />,
  "minus": <Minus className="w-4 h-4" />,
  "clock": <Clock className="w-4 h-4" />,
  "bell": <Bell className="w-4 h-4" />,
  "info": <Info className="w-4 h-4" />,
  "flame": <Flame className="w-4 h-4" />,
  "megaphone": <Megaphone className="w-4 h-4" />,
  "tag": <Tag className="w-4 h-4" />,
  "trend-up": <TrendingUp className="w-4 h-4" />,
  "trend-down": <TrendingDown className="w-4 h-4" />,
};

export function getIcon(key: string): React.ReactNode {
  return iconMap[key] ?? null;
}


