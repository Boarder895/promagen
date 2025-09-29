// Canonical Books module — stable exports used by /docs pages and export routes.

export type NormalizedDocSection = {
  id?: string;
  title?: string;
  summary?: string;
  status?: string;
  tags?: string[];
  videoUrl?: string;
};

export type NormalizedBook = {
  title: string;
  sections: NormalizedDocSection[];
};

// ---- Default minimal content (extend freely)
const USERS: NormalizedBook = {
  title: "Users’ Book — Promagen Functionality",
  sections: []
};

const DEVELOPERS: NormalizedBook = {
  title: "Developers’ Book — Build & Ops",
  sections: []
};

const HISTORY: NormalizedBook = {
  title: "History Book — Changelog & Decisions",
  sections: []
};

// ---- Named exports (back-compat aliases many pages expect)
export const users = USERS;
export const usersBook = USERS;
export const Users = USERS;
export const UsersBook = USERS;

export const developers = DEVELOPERS;
export const developersBook = DEVELOPERS;

export const history = HISTORY;
export const historyBook = HISTORY;

/** Synchronous loader used by pages and /docs/export/* routes */
export function loadBooks() {
  return {
    users: USERS,
    developers: DEVELOPERS,
    history: HISTORY
  };
}

/** Helper if a page asks for one book by key */
export function getBook(name: "users" | "developers" | "history"): NormalizedBook {
  return loadBooks()[name];
}

// Named const to satisfy import/no-anonymous-default-export
const BooksExport = { users: USERS, developers: DEVELOPERS, history: HISTORY };
export default BooksExport;

