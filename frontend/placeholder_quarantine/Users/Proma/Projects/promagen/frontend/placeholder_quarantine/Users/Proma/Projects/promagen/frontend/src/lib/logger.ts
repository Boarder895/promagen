export const log = (...args: unknown[]): void => { if (process.env.NODE_ENV !== "production") { console.log(...args); } };
export const warn = (...args: unknown[]): void => { if (process.env.NODE_ENV !== "production") { console.warn(...args); } };
export const error = (...args: unknown[]): void => { console.error(...args); };
