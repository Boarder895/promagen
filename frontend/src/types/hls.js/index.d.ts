declare class Hls {
  static isSupported(): boolean;
  constructor(config?: any);
  loadSource(url: string): void;
  attachMedia(media: HTMLMediaElement): void;
  on(event: string, handler: (...args: any[]) => void): void;
  destroy(): void;
}
export default Hls;
