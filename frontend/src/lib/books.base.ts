// Named exports only.
export type Books = {
  users: { sections: any[] };
  developers: { sections: any[] };
  history: { sections: any[] };
};

// Keep this file PURE: no imports from other files.
export const BASE_BOOKS: Books = {
  users: { sections: [] },
  developers: { sections: [] },
  history: { sections: [] },
};


