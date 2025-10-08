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
