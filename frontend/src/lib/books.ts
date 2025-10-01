// src/lib/books.ts

export type ChecklistItem = {
  id: string;
  text: string;
  done: boolean;
};

export type Section = {
  id: string;
  title: string;
  summary: string;
  status: "todo" | "in-progress" | "in-review" | "done";
  videoUrl?: string;
  lastUpdated?: string; // ISO date
  tags?: string[];
  priority?: number;
  owner?: string;
  eta?: string;
  checklist?: ChecklistItem[];
};

export type HistoryEntry = {
  id: string;
  text: string;
  date?: string; // ISO date
};

export type BookMeta = {
  title: string;
  subtitle?: string;
};

export type Book = {
  title: string;           // legacy heading (kept)
  meta?: BookMeta;         // optional richer metadata
  sections: Section[];
  entries?: HistoryEntry[]; // used by History
};

export type Books = {
  users: Book;
  developers: Book;
  history: Book;
};

export function loadBooks(): Books {
  const users: Book = {
    title: "Users� Book � Promagen Functionality",
    meta: {
      title: "Users� Book � Promagen Functionality",
      subtitle: "User-facing manual for features, pricing, and daily usage.",
    },
    sections: [
      {
        id: "overview",
        title: "What is Promagen?",
        summary:
          "Promagen compares 20 AI image providers, runs prompts across them, and curates a popular prompt library. This manual is the single source of truth for users.",
        status: "in-review",
        lastUpdated: "2025-09-28",
        tags: ["intro", "core"],
        priority: 1,
        owner: "docs",
        checklist: [
          { id: "ov-1", text: "Short pitch written", done: true },
          { id: "ov-2", text: "Feature table added", done: false },
        ],
      },
    ],
  };

  const developers: Book = {
    title: "Developers� Book � Build & Architecture",
    meta: {
      title: "Developers� Book � Build & Architecture",
      subtitle: "Architecture, invariants, provider registry, workflows.",
    },
    sections: [
      {
        id: "routing",
        title: "Docs Routing Invariant",
        summary:
          "app/docs/* owns docs routing. Content source is TSX pages only. Three-column layout: left Developers Book, center borderless doc (~740�780px), right Users Book + Build Progress.",
        status: "in-review",
        lastUpdated: "2025-09-28",
        tags: ["routing", "invariants"],
      },
      {
        id: "providers",
        title: "Canonical 20-Provider List",
        summary:
          "Frontend is source of truth until launch. IDs: openai, stability, leonardo, i23rf, artistly, adobe, midjourney, canva, bing, ideogram, picsart, fotor, nightcafe, playground, pixlr, deepai, novelai, lexica, openart, flux.",
        status: "in-review",
        lastUpdated: "2025-09-26",
        tags: ["providers", "registry"],
      },
    ],
  };

  const history: Book = {
    title: "History � Decisions & Changelog",
    meta: {
      title: "History � Decisions & Changelog",
      subtitle: "Timeline of locked decisions and fixes.",
    },
    sections: [
      {
        id: "log-policy",
        title: "Logging & Decisions",
        summary:
          "Key choices recorded: App Router for docs; API v1 routing; Fly single machine LHR; 123RF?I23RF; PROD API default for frontend.",
        status: "in-review",
        lastUpdated: "2025-09-29",
        tags: ["history", "decisions"],
      },
    ],
    entries: [
      {
        id: "2025-09-29-type-fix",
        text: "Added optional `meta` and `entries` to Book; pages use safe access.",
        date: "2025-09-29",
      },
    ],
  };

  return { users, developers, history };
}

export function getBook<K extends keyof Books>(key: K): Books[K] {
  return loadBooks()[key];
}

/** Safe meta accessor so pages don't poke book.meta directly. */
export function metaOf(book: Book): BookMeta {
  return {
    title: book.meta?.title ?? book.title,
    subtitle: book.meta?.subtitle,
  };
}












