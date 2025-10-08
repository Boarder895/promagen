// ambient types for markdown pipeline
declare module 'remark-parse';
declare module 'remark-rehype';
declare module 'rehype-raw';
declare module 'rehype-sanitize';
declare module 'rehype-stringify';

declare module "hls.js" {
  export default class Hls {
    static isSupported(): boolean;
    constructor(config?: any);
    loadSource(url: string): void;
    attachMedia(el: HTMLMediaElement): void;
    on(event: string, handler: (...args: any[]) => void): void;
    destroy(): void;
  }
}
