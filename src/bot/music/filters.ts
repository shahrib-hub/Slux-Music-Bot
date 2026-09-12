import type { Band, FilterOptions } from "shoukaku";

export const BASSBOOST_LEVELS: Record<string, number> = {
  low: 0.15,
  medium: 0.35,
  high: 0.65,
  insane: 0.9,
};

export const EQ_BANDS = 15;

function bands(gains: number[]): Band[] {
  return gains.slice(0, EQ_BANDS).map((gain, band) => ({
    band,
    gain: Math.max(-1, Math.min(1, gain)),
  }));
}

/**
 * Builds a complete FilterOptions payload from a set of named active filters.
 * Named presets are merged; only truthy entries are emitted.
 */
export function buildFilters(active: Record<string, unknown>): FilterOptions {
  const filters: FilterOptions = {};

  if (active.bassboost !== undefined) {
    const gain = typeof active.bassboost === "number" ? active.bassboost : 0.35;
    filters.equalizer = bands([gain, gain, gain * 0.9, gain * 0.7, gain * 0.4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  }

  if (active.eq !== undefined && Array.isArray(active.eq)) {
    filters.equalizer = bands(active.eq as number[]);
  }

  if (active.soft !== undefined) {
    const g = 0.25;
    filters.equalizer = bands([-g, -g * 0.75, -g * 0.5, 0, g * 0.4, g * 0.55, g * 0.65, g * 0.7, g * 0.75, g * 0.75, g * 0.7, g * 0.6, g * 0.5, g * 0.35, g * 0.2]);
  }

  if (active.nightcore !== undefined) {
    filters.timescale = { speed: 1.25, pitch: 1.3, rate: 1 };
  }

  if (active.vaporwave !== undefined) {
    filters.timescale = { speed: 0.75, pitch: 0.85, rate: 1 };
  }

  if (active.speed !== undefined || active.pitch !== undefined) {
    const ts = { ...(active.speed !== undefined ? { speed: active.speed as number } : {}), ...(active.pitch !== undefined ? { pitch: active.pitch as number } : {}) };
    filters.timescale = { ...ts, rate: 1 };
  }

  if (active["8d"] !== undefined) {
    filters.rotation = { rotationHz: 0.2 };
  }

  if (active.karaoke !== undefined) {
    filters.karaoke = { level: 1.1, monoLevel: 1.1, filterBand: 220, filterWidth: 100 };
  }

  if (active.tremolo !== undefined) {
    filters.tremolo = { frequency: 14, depth: 0.3 };
  }

  if (active.vibrato !== undefined) {
    filters.vibrato = { frequency: 14, depth: 0.3 };
  }

  if (active.distortion !== undefined) {
    filters.distortion = {
      sinOffset: 0,
      sinScale: 1,
      cosOffset: 0,
      cosScale: 1,
      tanOffset: 0,
      tanScale: 1,
      offset: 0,
      scale: 1,
    };
  }

  if (active.lowpass !== undefined) {
    filters.lowPass = { smoothing: 20 };
  }

  return filters;
}

/** Derives the human-readable list of active filter names from a filter payload. */
export function activeFilterNames(filters: FilterOptions): string[] {
  const names: string[] = [];
  if (filters.equalizer) {
    const gains = filters.equalizer.map((b) => b.gain);
    const bass = gains.slice(0, 3);
    const treble = gains.slice(9);
    const avgBass = bass.reduce((a, b) => a + b, 0) / Math.max(1, bass.length);
    const avgTreble = treble.reduce((a, b) => a + b, 0) / Math.max(1, treble.length);
    if (avgBass > 0.1 && avgTreble <= 0.1) names.push("bassboost");
    else if (avgBass < -0.05 && avgTreble > 0.05) names.push("soft");
    else if (gains.some((g) => g !== 0)) names.push("eq");
  }
  if (filters.timescale) {
    const { speed, pitch } = filters.timescale;
    if (speed === 1.25 && pitch === 1.3) names.push("nightcore");
    else if (speed === 0.75 && pitch === 0.85) names.push("vaporwave");
    else names.push(`speed/pitch`);
  }
  if (filters.rotation) names.push("8d");
  if (filters.karaoke) names.push("karaoke");
  if (filters.tremolo) names.push("tremolo");
  if (filters.vibrato) names.push("vibrato");
  if (filters.distortion) names.push("distortion");
  if (filters.lowPass) names.push("lowpass");
  return names;
}

export const TOGGLEABLE_FILTERS = [
  "bassboost",
  "nightcore",
  "vaporwave",
  "soft",
  "8d",
  "karaoke",
  "tremolo",
  "vibrato",
  "distortion",
  "lowpass",
] as const;

export type ToggleableFilter = (typeof TOGGLEABLE_FILTERS)[number];
