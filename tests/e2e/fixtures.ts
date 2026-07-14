import { expect, type Page } from "@playwright/test";

export type RandomChannel =
  | "wheel-shuffle"
  | "wheel-segment"
  | "journey-start"
  | "journey-direction"
  | "journey-route"
  | "journey-theme"
  | "journey-mission"
  | "journey-reel-animation";

export type RandomValues = Partial<Record<RandomChannel, number>>;

declare global {
  interface Window {
    __WHATS_NEXT_TEST_RANDOM__?: (channel: RandomChannel) => number;
    __WHATS_NEXT_TEST_VALUES__?: RandomValues;
  }
}

export async function prepareApp(page: Page, randomValues: RandomValues = {}) {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript((values: RandomValues) => {
    localStorage.removeItem("whats-next-app-v1");
    window.__WHATS_NEXT_TEST_VALUES__ = { ...values };
    window.__WHATS_NEXT_TEST_RANDOM__ = (channel) => window.__WHATS_NEXT_TEST_VALUES__?.[channel] ?? 0.123456;

    Object.defineProperty(window, "speechSynthesis", {
      configurable: true,
      value: { cancel() {}, speak() {}, getVoices: () => [] },
    });
    Object.defineProperty(window, "SpeechSynthesisUtterance", {
      configurable: true,
      value: class SpeechSynthesisUtteranceStub {
        text: string;
        lang = "";
        voice: SpeechSynthesisVoice | null = null;
        constructor(text = "") { this.text = text; }
      },
    });
  }, randomValues);

  await page.goto("/");
  await expect(page.getByRole("heading", { name: /どんな時間にする？/ })).toBeVisible();
  await expect.poll(() => page.evaluate(() => localStorage.getItem("whats-next-app-v1") !== null)).toBe(true);
}

export async function setRandomValues(page: Page, randomValues: RandomValues) {
  await page.evaluate((values: RandomValues) => {
    window.__WHATS_NEXT_TEST_VALUES__ = {
      ...window.__WHATS_NEXT_TEST_VALUES__,
      ...values,
    };
  }, randomValues);
}

export function modeButton(page: Page, name: string) {
  return page.locator(".preset-card").filter({ hasText: name }).first();
}

export async function selectMode(page: Page, name: string) {
  const button = modeButton(page, name);
  await button.click();
  await expect(button).toHaveAttribute("aria-pressed", "true");
}
