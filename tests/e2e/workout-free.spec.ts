import { expect, test } from "@playwright/test";
import { prepareApp, selectMode, setRandomValues } from "./fixtures";

test("筋トレ結果から3分タイマーを開始できる", async ({ page }) => {
  await prepareApp(page, {
    "wheel-shuffle": 0.123,
    "wheel-segment": 0.01,
  });
  await selectMode(page, "筋トレ");

  await expect(page.locator(".wheel-workout .wheel-label")).toHaveCount(6);
  await page.getByRole("button", { name: "筋トレを決める", exact: true }).click();

  const result = page.locator(".workout-result-card");
  await expect(result).toBeVisible();
  await expect(result.locator("b")).toContainText("3分");
  await expect(result.locator("small")).not.toBeEmpty();
  await result.getByRole("button", { name: /スタート/ }).click();

  await expect(page.locator(".timer-clock")).toHaveText(/3\s*:\s*00/);
  await expect(page.getByRole("button", { name: "タイマーを終了" })).toBeVisible();
});

test("フリーの空き枠を編集し、その区画を抽選できる", async ({ page }) => {
  await prepareApp(page);
  await selectMode(page, "フリーモード");

  await expect(page.locator(".wheel-free .wheel-label")).toHaveCount(6);
  await expect(page.locator(".wheel-free .empty-wheel-label")).toHaveCount(3);
  await page.getByRole("button", { name: "6つの内容を編集" }).click();

  await page.getByRole("button", { name: "＋ 自由に入力を編集" }).first().click();
  await page.locator("#candidate-edit-input").fill("夕焼けを見に行く");
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await page.getByRole("button", { name: "ルーレット", exact: true }).click();
  await selectMode(page, "フリーモード");

  await setRandomValues(page, { "wheel-segment": 0.99 });
  await page.getByRole("button", { name: "フリールーレットを回す", exact: true }).click();
  await expect(page.locator(".result-card")).toContainText("夕焼けを見に行く");
});
