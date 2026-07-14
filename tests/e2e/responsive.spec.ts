import { expect, test } from "@playwright/test";
import { prepareApp } from "./fixtures";

const viewports = [
  { name: "compact mobile", width: 360, height: 800 },
  { name: "standard mobile", width: 375, height: 844 },
  { name: "wide mobile", width: 390, height: 844 },
  { name: "large mobile", width: 430, height: 932 },
] as const;

for (const viewport of viewports) {
  test(`${viewport.name}で横崩れせず固定操作を使える`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await prepareApp(page);

    const metrics = await page.evaluate(() => ({
      viewportWidth: window.innerWidth,
      pageWidth: document.documentElement.scrollWidth,
    }));
    expect(metrics.pageWidth).toBeLessThanOrEqual(metrics.viewportWidth + 1);

    const wheel = page.locator(".wheel");
    const wheelBox = await wheel.boundingBox();
    expect(wheelBox).not.toBeNull();
    expect(wheelBox?.x ?? -1).toBeGreaterThanOrEqual(0);
    expect((wheelBox?.x ?? 0) + (wheelBox?.width ?? 0)).toBeLessThanOrEqual(viewport.width);

    const dock = page.getByTestId("home-fixed-action");
    const dockBox = await dock.boundingBox();
    expect(dockBox).not.toBeNull();
    expect(dockBox?.x ?? -1).toBeGreaterThanOrEqual(0);
    expect((dockBox?.x ?? 0) + (dockBox?.width ?? 0)).toBeLessThanOrEqual(viewport.width);
    expect((dockBox?.y ?? 0) + (dockBox?.height ?? 0)).toBeLessThanOrEqual(viewport.height);

    await expect(dock.getByRole("button", { name: "ルーレットを回す", exact: true })).toBeEnabled();
  });
}
