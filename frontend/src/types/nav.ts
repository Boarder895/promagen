export type TabBadge = string | number | null;

type Base = {
  id: string;
  label: string;
  icon?: string;
  disabled?: boolean;
  badge?: TabBadge;
};

// Routed tab requires href
export type RoutedTabItem = Base & {
  kind: "routed";
  href: string;
  panelId?: never;
};

// In-page tab requires panelId
export type InpageTabItem = Base & {
  kind: "inpage";
  panelId: string;
  href?: never;
};

export type TabItem = RoutedTabItem | InpageTabItem;

