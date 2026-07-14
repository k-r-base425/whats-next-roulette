import { expect, test } from "@playwright/test";
import { prepareApp, selectMode } from "./fixtures";

const stops = [
  { wheel: "北へ", instruction: "北へ出発" },
  { wheel: "東へ", instruction: "東へ出発" },
  { wheel: "南へ", instruction: "南へ出発" },
  { wheel: "冒険", instruction: "直感にまかせて出発" },
  { wheel: "西へ", instruction: "西へ出発" },
  { wheel: "直進", instruction: "まずは直進して出発" },
] as const;

for (const [index, stop] of stops.entries()) {
  test(`旅ルーレットは区画${index + 1}「${stop.wheel}」で正しく停止する`, async ({ page }) => {
    const random = (index + 0.1) / stops.length;
    await prepareApp(page, {
      "journey-start": random,
      "wheel-segment": random,
    });
    await selectMode(page, "自転車の旅");

    const wheel = page.locator(".wheel-bicycle");
    await expect(wheel.locator(`.label-${index}`)).toContainText(stop.wheel);
    await page.getByRole("button", { name: "旅のルーレットを回す", exact: true }).click();

    await expect(wheel).toHaveAttribute("data-stop-index", String(index));
    await expect(wheel).toHaveAttribute("data-result-label", stop.instruction);
    await expect(page.locator(".result-card")).toBeVisible();
    await page.getByRole("button", { name: "この出発指示で旅へ" }).click();
    await page.getByRole("button", { name: /4つの旅リールを回す/ }).click();
    await expect(page.locator(".mission-outcome")).toBeVisible();

    const activeDirection = await page.evaluate(() => JSON.parse(localStorage.getItem("whats-next-app-v1") ?? "null")?.activeJourney?.initialDirection);
    expect(activeDirection).toBe(stop.instruction);

    await page.getByRole("button", { name: "旅を終える" }).click();
    const loggedDirection = await page.evaluate(() => JSON.parse(localStorage.getItem("whats-next-app-v1") ?? "null")?.journeys?.[0]?.initialDirection);
    expect(loggedDirection).toBe(stop.instruction);
  });
}

test("旅モードで達成・スキップ・ミッションのみ再抽選が使える", async ({ page }) => {
  await prepareApp(page, {
    "journey-start": 0,
    "journey-direction": 0,
    "journey-route": 0,
    "journey-theme": 0,
    "journey-mission": 0,
    "journey-reel-animation": 0,
  });
  await selectMode(page, "自転車の旅");
  await page.getByRole("button", { name: "旅モードを開く" }).click();
  await page.getByRole("button", { name: "30分" }).click();
  await page.getByRole("button", { name: /4つの旅リールを回す/ }).click();

  const mission = page.locator(".mission-outcome");
  await expect(mission).toBeVisible();
  await expect(page.getByRole("button", { name: /できた！ 次を回す/ })).toBeEnabled();
  await expect(page.getByRole("button", { name: /スキップして次を回す/ })).toBeEnabled();
  await expect(page.getByRole("button", { name: /ミッションだけ回し直す/ })).toBeEnabled();

  const contextBefore = await mission.locator("p").textContent();
  await page.getByRole("button", { name: /ミッションだけ回し直す/ }).click();
  await expect(mission).toBeVisible();
  await expect(mission.locator("p")).toHaveText(contextBefore ?? "");
});
