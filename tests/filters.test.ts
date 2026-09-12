import { describe, it, expect } from "vitest";
import { parseTime, tokenize } from "@/bot/lib/parse";
import { buildFilters, activeFilterNames, BASSBOOST_LEVELS } from "@/bot/music/filters";

describe("parseTime", () => {
  it("parses plain seconds", () => {
    expect(parseTime("90")).toBe(90_000);
  });
  it("parses mm:ss", () => {
    expect(parseTime("1:30")).toBe(90_000);
  });
  it("parses h:mm:ss", () => {
    expect(parseTime("1:02:03")).toBe((3600 + 120 + 3) * 1000);
  });
  it("parses human units", () => {
    expect(parseTime("1m30s")).toBe(90_000);
    expect(parseTime("2h")).toBe(7_200_000);
    expect(parseTime("1h 2m 3s")).toBe((3600 + 120 + 3) * 1000);
  });
  it("rejects garbage", () => {
    expect(parseTime("banana")).toBeNull();
    expect(parseTime("")).toBeNull();
    expect(parseTime(":")).toBeNull();
  });
});

describe("tokenize", () => {
  it("splits on spaces", () => {
    expect(tokenize("play never gonna give you up")).toEqual([
      "play",
      "never",
      "gonna",
      "give",
      "you",
      "up",
    ]);
  });
  it("respects double quotes", () => {
    expect(tokenize('playlist add chill "deep focus beats"')).toEqual([
      "playlist",
      "add",
      "chill",
      "deep focus beats",
    ]);
  });
});

describe("buildFilters", () => {
  it("bassboost builds an equalizer with bass gains", () => {
    const filters = buildFilters({ bassboost: BASSBOOST_LEVELS.high });
    expect(filters.equalizer).toBeDefined();
    expect(filters.equalizer![0].gain).toBeCloseTo(0.65, 5);
    expect(filters.equalizer![14].gain).toBe(0);
  });

  it("nightcore and vaporwave set timescale", () => {
    const nc = buildFilters({ nightcore: true });
    expect(nc.timescale).toEqual({ speed: 1.25, pitch: 1.3, rate: 1 });
    const vw = buildFilters({ vaporwave: true });
    expect(vw.timescale).toEqual({ speed: 0.75, pitch: 0.85, rate: 1 });
  });

  it("8d sets rotation", () => {
    const filters = buildFilters({ "8d": true });
    expect(filters.rotation).toEqual({ rotationHz: 0.2 });
  });

  it("custom eq overrides bassboost", () => {
    const filters = buildFilters({ eq: [0.5, 0, 0, 0, -0.5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] });
    expect(filters.equalizer!.length).toBe(15);
    expect(filters.equalizer![0].gain).toBe(0.5);
    expect(filters.equalizer![4].gain).toBe(-0.5);
  });

  it("empty active set produces empty filters", () => {
    const filters = buildFilters({});
    expect(Object.keys(filters)).toHaveLength(0);
  });
});

describe("activeFilterNames", () => {
  it("identifies bassboost", () => {
    const names = activeFilterNames(buildFilters({ bassboost: 0.35 }));
    expect(names).toContain("bassboost");
  });
  it("identifies nightcore", () => {
    const names = activeFilterNames(buildFilters({ nightcore: true }));
    expect(names).toContain("nightcore");
  });
  it("returns empty for no filters", () => {
    expect(activeFilterNames(buildFilters({}))).toEqual([]);
  });
});
