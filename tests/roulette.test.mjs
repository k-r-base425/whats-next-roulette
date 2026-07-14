import assert from "node:assert/strict";
import test from "node:test";

import {
  JOURNEY_START_OPTIONS,
  JOURNEY_WHEEL_LABELS,
  chooseEnabledSegment,
  chooseJourneyStart,
  chooseWheelSegment,
  getNextWheelRotation,
  getStopAngleForSegment,
  indexFromUnitRandom,
  makeWheelSlots,
} from "../lib/roulette.ts";

test("旅ホイールの6区画は表示・指示・停止位置が一対一で対応する", () => {
  assert.equal(JOURNEY_START_OPTIONS.length, 6);
  assert.deepEqual([...JOURNEY_WHEEL_LABELS], ["北へ", "東へ", "南へ", "冒険", "西へ", "直進"]);
  assert.deepEqual(JOURNEY_START_OPTIONS.map((option) => option.segment), [0, 1, 2, 3, 4, 5]);

  const expectedAngles = [30, 330, 270, 210, 150, 90];
  for (const [segment, angle] of expectedAngles.entries()) {
    assert.equal(getStopAngleForSegment(segment), angle);
    assert.equal(getNextWheelRotation(0, segment) % 360, angle);
  }
});

test("単位乱数の6分割境界は必ず対応する区画を選ぶ", () => {
  for (let segment = 0; segment < 6; segment += 1) {
    const randomValue = (segment + 0.1) / 6;
    assert.equal(chooseWheelSegment(randomValue), segment);
    assert.equal(chooseJourneyStart(randomValue), JOURNEY_START_OPTIONS[segment]);
  }

  assert.equal(indexFromUnitRandom(6, 0), 0);
  assert.equal(indexFromUnitRandom(6, 0.999999), 5);
  assert.throws(() => indexFromUnitRandom(6, 1), RangeError);
});

test("フリーは有効区画だけを選び、通常候補は常に6枠へ展開する", () => {
  assert.equal(chooseEnabledSegment([1, 3, 5], 0), 1);
  assert.equal(chooseEnabledSegment([1, 3, 5], 0.99), 5);
  assert.deepEqual(makeWheelSlots(["A", "B"], [0]), ["B", "A", "B", "A", "B", "A"]);
  assert.deepEqual(makeWheelSlots([], []), []);
});
