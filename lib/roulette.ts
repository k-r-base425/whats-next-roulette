export const WHEEL_SEGMENT_COUNT = 6 as const;

export const JOURNEY_START_OPTIONS = [
  { id: "north", wheelLabel: "北へ", instruction: "北へ出発", segment: 0 },
  { id: "east", wheelLabel: "東へ", instruction: "東へ出発", segment: 1 },
  { id: "south", wheelLabel: "南へ", instruction: "南へ出発", segment: 2 },
  { id: "adventure", wheelLabel: "冒険", instruction: "直感にまかせて出発", segment: 3 },
  { id: "west", wheelLabel: "西へ", instruction: "西へ出発", segment: 4 },
  { id: "straight", wheelLabel: "直進", instruction: "まずは直進して出発", segment: 5 },
] as const;

export type JourneyStartOption = (typeof JOURNEY_START_OPTIONS)[number];
export type JourneyStartId = JourneyStartOption["id"];
export type JourneySegment = JourneyStartOption["segment"];

export const JOURNEY_WHEEL_LABELS = JOURNEY_START_OPTIONS.map(
  (option) => option.wheelLabel,
) as readonly JourneyStartOption["wheelLabel"][];

export function normalizeDegrees(degrees: number): number {
  if (!Number.isFinite(degrees)) throw new RangeError("degrees must be finite");
  return ((degrees % 360) + 360) % 360;
}

export function getStopAngleForSegment(segment: JourneySegment): number {
  return normalizeDegrees(390 - segment * 60);
}

export function getNextWheelRotation(
  currentRotation: number,
  segment: JourneySegment,
  fullTurns = 2,
): number {
  if (!Number.isInteger(fullTurns) || fullTurns < 0) {
    throw new RangeError("fullTurns must be a non-negative integer");
  }
  const currentAngle = normalizeDegrees(currentRotation);
  const targetAngle = getStopAngleForSegment(segment);
  const alignment = normalizeDegrees(targetAngle - currentAngle);
  return currentRotation + fullTurns * 360 + alignment;
}

export function getJourneyStartById(id: JourneyStartId): JourneyStartOption {
  const option = JOURNEY_START_OPTIONS.find((entry) => entry.id === id);
  if (!option) throw new RangeError(`unknown journey start id: ${id}`);
  return option;
}

export function findJourneyStartByInstruction(
  instruction: string,
): JourneyStartOption | undefined {
  return JOURNEY_START_OPTIONS.find((entry) => entry.instruction === instruction);
}

function assertUnitRandom(value: number): void {
  if (!Number.isFinite(value) || value < 0 || value >= 1) {
    throw new RangeError("random value must be in the range [0, 1)");
  }
}

export function indexFromUnitRandom(length: number, randomValue: number): number {
  if (!Number.isInteger(length) || length <= 0) {
    throw new RangeError("length must be a positive integer");
  }
  assertUnitRandom(randomValue);
  return Math.floor(randomValue * length);
}

export function pickFromUnitRandom<T>(
  items: readonly T[],
  randomValue: number,
): T {
  if (items.length === 0) throw new RangeError("items must not be empty");
  return items[indexFromUnitRandom(items.length, randomValue)];
}

export function chooseJourneyStart(randomValue: number): JourneyStartOption {
  return pickFromUnitRandom(JOURNEY_START_OPTIONS, randomValue);
}

export function chooseWheelSegment(randomValue: number): JourneySegment {
  return indexFromUnitRandom(WHEEL_SEGMENT_COUNT, randomValue) as JourneySegment;
}

export function chooseEnabledSegment(
  enabledSegments: readonly JourneySegment[],
  randomValue: number,
): JourneySegment {
  return pickFromUnitRandom(enabledSegments, randomValue);
}

export function randomValuesNeededForShuffle(itemCount: number): number {
  if (!Number.isInteger(itemCount) || itemCount < 0) {
    throw new RangeError("itemCount must be a non-negative integer");
  }
  return Math.max(0, itemCount - 1);
}

export function shuffleWithUnitRandoms<T>(
  items: readonly T[],
  randomValues: readonly number[],
): T[] {
  const needed = randomValuesNeededForShuffle(items.length);
  if (randomValues.length < needed) {
    throw new RangeError(`shuffle requires at least ${needed} random values`);
  }

  const shuffled = [...items];
  let randomIndex = 0;
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = indexFromUnitRandom(index + 1, randomValues[randomIndex]);
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
    randomIndex += 1;
  }
  return shuffled;
}

export function makeWheelSlots<T>(
  items: readonly T[],
  randomValues: readonly number[],
  slotCount = WHEEL_SEGMENT_COUNT,
): T[] {
  if (!Number.isInteger(slotCount) || slotCount <= 0) {
    throw new RangeError("slotCount must be a positive integer");
  }
  if (items.length === 0) return [];

  const shuffled = shuffleWithUnitRandoms(items, randomValues);
  const selected = shuffled.slice(0, slotCount);
  while (selected.length < slotCount) {
    selected.push(shuffled[selected.length % shuffled.length]);
  }
  return selected;
}
