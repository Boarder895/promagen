export type Prompt = {
  id: string;
  title: string;
  text: string;
};

export const prompts: Prompt[] = [];

// Used by some pages to render a community list; stubbed for now.
export function getCommunity(): Prompt[] {
  return prompts;
}

export default prompts;
