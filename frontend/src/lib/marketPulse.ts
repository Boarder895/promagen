// @/lib/marketPulse.ts

export type RegionKey = 'amer' | 'emea' | 'apac';
export type RegionMOF = Record<RegionKey, number>;

export interface PulseState {
  heat: number;
  regions: RegionMOF;
  anyOpen: boolean;
  lastUpdate: number;
  nextFlipTs?: number;
}

export const EMPTY_MOF: RegionMOF = { amer: 0, emea: 0, apac: 0 };

export const initialPulseState: PulseState = {
  heat: 0,
  regions: { ...EMPTY_MOF },
  anyOpen: false,
  lastUpdate: 0,
  nextFlipTs: undefined,
};

let _state: PulseState = { ...initialPulseState };
const _listeners = new Set<() => void>();
const _emit = () => { for (const fn of Array.from(_listeners)) { try { fn(); } catch {} } };

export function getPulseState(): PulseState { return _state; }
export function subscribePulse(listener: () => void): () => void { _listeners.add(listener); return () => _listeners.delete(listener); }

export function setRegionsMOF(regions: RegionMOF, anyOpen: boolean, nextFlipTs?: number): void {
  _state = { ..._state, regions: { ...regions }, anyOpen, nextFlipTs, lastUpdate: Date.now() };
  _emit();
}

export function setHeat(heat: number): void {
  _state = { ..._state, heat, lastUpdate: Date.now() };
  _emit();
}

export function replacePulse(patch: Partial<PulseState>): void {
  _state = {
    ..._state,
    ...patch,
    regions: patch.regions ? { ...patch.regions } : _state.regions,
    lastUpdate: Date.now(),
  };
  _emit();
}

export function resetPulse(): void { _state = { ...initialPulseState, lastUpdate: Date.now() }; _emit(); }
