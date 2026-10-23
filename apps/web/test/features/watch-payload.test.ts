import { describe, expect, it } from "vitest";
import { formatWeight } from "@rackd/core";
import {
  afterAdd,
  afterAdjust,
  afterLog,
  afterSkip,
  buildWatchPayload,
  mergeWatchPublish,
  shiftRest,
  type StoredWatch,
} from "@/features/active-workout/watch-payload";

const bench = {
  name: "Bench Press",
  restSec: 90,
  sets: [
    { id: "a1", order: 1, weight: 80, reps: 8, completed: false },
    { id: "a2", order: 2, weight: 80, reps: 8, completed: false },
  ],
};

describe("buildWatchPayload", () => {
  it("lists sets in order with display weight and a 1-based index", () => {
    const payload = buildWatchPayload([bench], "kg", null, 0);
    expect(payload.restEndAt).toBe(0);
    expect(
      payload.items.map((item) => [item.setId, item.index, item.count, item.weightLabel]),
    ).toEqual([
      ["a1", 1, 2, "80 kg"],
      ["a2", 2, 2, "80 kg"],
    ]);
  });

  it("rests after a normal exercise and only after the last superset member", () => {
    const payload = buildWatchPayload(
      [
        { ...bench, supersetGroup: 1 },
        {
          name: "Row",
          restSec: 60,
          supersetGroup: 1,
          sets: [{ id: "b1", order: 1, weight: 60, reps: 10, completed: false }],
        },
      ],
      "kg",
      5000,
      2,
    );
    expect(payload.ack).toBe(2);
    expect(payload.unit).toBe("kg");
    expect(payload.restEndAt).toBe(5000);
    expect(payload.items.map((item) => [item.name, item.rests])).toEqual([
      ["Bench Press", false],
      ["Bench Press", false],
      ["Row", true],
    ]);
  });
});

describe("watch actions", () => {
  const stored: StoredWatch = {
    revision: 3,
    sessionId: "sess",
    restEndAt: 0,
    unit: "kg",
    items: buildWatchPayload([bench], "kg", null, 0).items,
  };

  it("logs the first open set and starts its rest when another set remains", () => {
    const { setId, next } = afterLog(stored, 1_000);
    expect(setId).toBe("a1");
    expect(next.revision).toBe(4);
    expect(next.restEndAt).toBe(91_000);
    expect(next.items.map((item) => item.completed)).toEqual([true, false]);
  });

  it("does not start a rest on a superset set that is not the last member", () => {
    const items = buildWatchPayload(
      [
        { ...bench, supersetGroup: 1, sets: [bench.sets[0]!] },
        {
          name: "Row",
          restSec: 60,
          supersetGroup: 1,
          sets: [{ id: "b1", order: 1, weight: 60, reps: 10, completed: false }],
        },
      ],
      "kg",
      null,
      0,
    ).items;
    const { next } = afterLog(
      { revision: 0, sessionId: "sess", restEndAt: 0, unit: "kg", items },
      1_000,
    );
    expect(next.restEndAt).toBe(0);
    expect(next.items[0]?.completed).toBe(true);
  });

  it("skips rest and adds 30s from the later end", () => {
    const resting = { ...stored, restEndAt: 50_000 };
    expect(afterSkip(resting).restEndAt).toBe(0);
    expect(afterAdd(resting, 1_000).restEndAt).toBe(80_000);
    expect(afterAdd({ ...stored, restEndAt: 0 }, 1_000).restEndAt).toBe(31_000);
    expect(shiftRest(resting, 1_000, 15_000).restEndAt).toBe(65_000);
    expect(shiftRest(resting, 1_000, -15_000).restEndAt).toBe(35_000);
    expect(shiftRest({ ...stored, restEndAt: 10_000 }, 1_000, -15_000).restEndAt).toBe(0);
  });

  it("keeps a watch log when the phone UI publishes a stale ack", () => {
    const logged = afterLog(stored, 1_000).next;
    const stale = buildWatchPayload([bench], "kg", null, 3);
    const merged = mergeWatchPublish(logged, stale, 2_000);
    expect(merged.revision).toBe(4);
    expect(merged.restEndAt).toBe(91_000);
    expect(merged.items[0]?.completed).toBe(true);
  });

  it("logs the set on screen instead of the first open set", () => {
    const { setId, next } = afterLog(stored, 1_000, "a2");
    expect(setId).toBe("a2");
    expect(next.items.map((item) => item.completed)).toEqual([false, true]);
    expect(next.restEndAt).toBe(91_000);
  });

  it("steps weight in kg and keeps it when the phone publish is stale", () => {
    const adjusted = afterAdjust(stored, "a1", { weight: 90 });
    expect(adjusted.revision).toBe(4);
    expect(adjusted.items[0]?.weightLabel).toBe("90 kg");
    expect(adjusted.items[1]?.weight).toBe(80);
    const stale = buildWatchPayload([bench], "kg", null, 3);
    const merged = mergeWatchPublish(adjusted, stale, 2_000);
    expect(merged.items[0]?.weight).toBe(90);
    expect(merged.items[0]?.weightLabel).toBe("90 kg");
    const reps = afterAdjust(stored, "a2", { reps: 6 });
    expect(reps.items[1]?.reps).toBe(6);
    expect(reps.items[0]?.reps).toBe(8);
  });

  it("labels pounds from the canonical kilograms", () => {
    const payload = buildWatchPayload([bench], "lb", null, 0);
    expect(payload.unit).toBe("lb");
    expect(payload.items[0]?.weight).toBe(80);
    expect(payload.items[0]?.weightLabel).toBe(formatWeight(80, "lb"));
  });

  it("accepts the phone UI once it acknowledges the watch revision", () => {
    const logged = afterLog(stored, 1_000).next;
    const fresh = buildWatchPayload(
      [{ ...bench, sets: [{ ...bench.sets[0]!, completed: true }, bench.sets[1]!] }],
      "kg",
      91_000,
      4,
    );
    const merged = mergeWatchPublish(logged, fresh, 2_000);
    expect(merged.items.map((item) => item.completed)).toEqual([true, false]);
    expect(merged.restEndAt).toBe(91_000);
  });
});
