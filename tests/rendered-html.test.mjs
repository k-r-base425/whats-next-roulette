import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";

const projectRoot = new URL("../", import.meta.url);

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the What’s Next app", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /What’s Next\?/);
  assert.match(html, /今日、何をする？/);
  assert.match(html, /いま、どんな時間にする？/);
  assert.match(html, /ルーレットを回す/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape|react-loading-skeleton/i);
});

test("keeps offline data and accessibility safeguards in place", async () => {
  const [page, serviceWorker, manifest, readme] = await Promise.all([
    readFile(new URL("app/page.tsx", projectRoot), "utf8"),
    readFile(new URL("public/sw.js", projectRoot), "utf8"),
    readFile(new URL("public/manifest.webmanifest", projectRoot), "utf8"),
    readFile(new URL("README.md", projectRoot), "utf8"),
  ]);

  assert.match(page, /const MAX_CANDIDATES = 500/);
  assert.match(page, /if \(!hydrated \|\| !persistenceEnabled\) return/);
  assert.match(page, /visibilitychange/);
  assert.match(page, /aria-label=\{`\$\{entry\.label\}を\$\{entry\.enabled/);
  assert.match(page, /aria-pressed=\{journeyDuration === duration\}/);
  assert.match(serviceWorker, /key\.startsWith\("whats-next-"\)/);
  assert.match(manifest, /"display": "standalone"/);
  assert.match(readme, /^# What’s Next\?/m);

  assert.deepEqual(await readdir(new URL("app/_sites-preview", projectRoot)), []);
});
