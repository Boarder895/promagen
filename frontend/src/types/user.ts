export type Plan = 'free' | 'paid';

export type User = {
  id: string;         // opaque id
  email?: string;
  plan: Plan;
  createdAt: string;  // ISO
};

export type Session = {
  user: User | null;
};
