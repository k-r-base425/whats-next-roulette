import { expect, test } from "@playwright/test";
import { modeButton, prepareApp, selectMode } from "./fixtures";

const modes = [
  { name: "仕事", action: "ルーレットを回す", wheelClass: "wheel-work" },
  { name: "遊び", action: "ルーレットを回す", wheelClass: "wheel-play" },
  { name: "一人で暇な時", action: "ルーレットを回す", wheelClass: "wheel-solo" },
  { name: "回復", action: "ルーレットを回す", wheelClass: "wheel-recovery" },
  { name: "自転車の旅", action: "旅のルーレットを回す", wheelClass: "wheel-bicycle" },
  { name: "筋トレ", action: "筋トレを決める", wheelClass: "wheel-workout" },
  { name: "フリーモード", action: "フリールーレットを回す", wheelClass: "wheel-free" },
] as const;

test("7つのモードを安定して切り替えられる", async ({ page }) => {
  await prepareApp(page);

  for (const mode of modes) {
    await selectMode(page, mode.name);
    await expect(page.locator(`.${mode.wheelClass}`)).toBeVisible();
    await expect(page.getByTestId("home-fixed-action").getByRole("button", { name: mode.action, exact: true })).toBeVisible();

    for (const other of modes.filter((entry) => entry.name !== mode.name)) {
      await expect(modeButton(page, other.name)).toHaveAttribute("aria-pressed", "false");
    }
  }
});

test("固定アクションはスクロール後も画面内に残り、押しやすい", async ({ page }) => {
  await prepareApp(page);
  const dock = page.getByTestId("home-fixed-action");
  const spin = dock.getByRole("button", { name: "ルーレットを回す", exact: true });

  await expect(dock).toBeVisible();
  await expect(spin).toBeVisible();
  await expect(dock).toHaveCSS("position", "fixed");

  const before = await dock.boundingBox();
  const spinBox = await spin.boundingBox();
  expect(before).not.toBeNull();
  expect(spinBox?.height ?? 0).toBeGreaterThanOrEqual(44);

  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  const after = await dock.boundingBox();
  expect(after).not.toBeNull();
  expect(Math.abs((after?.y ?? 0) - (before?.y ?? 0))).toBeLessThan(2);
  expect((after?.y ?? 0) + (after?.height ?? 0)).toBeLessThanOrEqual(844);

  await spin.click();
  await expect(page.locator(".result-card")).toBeVisible();
});
