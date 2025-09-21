export interface Prompt {
  id: string;
  title: string;
  summary: string;
  body: string;
  tags: string[];
  provider: string;
  author: string;
  uses: number;      // total launches / remixes
  likes: number;
  createdAt: string;
  curated?: boolean;

  // new, optional (keeps old behavior)
  remixes?: number;
}

