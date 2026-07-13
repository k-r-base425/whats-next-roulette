"use client";

import { ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";

type Candidate = { id: string; label: string; enabled: boolean; minutes?: number };
type Preset = {
  id: string;
  name: string;
  icon: string;
  tone: "coral" | "lemon" | "violet" | "mint" | "sky";
  description: string;
  custom?: boolean;
  journey?: boolean;
  items: Candidate[];
};
type Decision = { id: string; preset: string; label: string; at: number };
type JourneyStep = {
  id: string;
  direction: string;
  mission: string;
  status: "active" | "done" | "skipped";
  at: number;
};
type Journey = {
  startedAt: number;
  duration: number | null;
  initialDirection: string;
  steps: JourneyStep[];
  turnaroundShown: boolean;
};
type JourneyLog = {
  id: string;
  startedAt: number;
  endedAt: number;
  initialDirection: string;
  steps: JourneyStep[];
};
type AppData = {
  version: 1;
  presets: Preset[];
  decisions: Decision[];
  journeys: JourneyLog[];
  activeJourney: Journey | null;
  speech: boolean;
};
type View = "home" | "history" | "presets" | "settings" | "journey" | "timer";
type SpinResult = { label: string; minutes?: number } | null;
type InstallPromptEvent = Event & { prompt: () => Promise<void> };
type WakeLockHandle = { release: () => Promise<void> };
type NavigatorWithWakeLock = Navigator & { wakeLock?: { request: (kind: "screen") => Promise<WakeLockHandle> } };

const uid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
const item = (label: string, minutes?: number): Candidate => ({ id: uid(), label, enabled: true, minutes });

const makeDefaults = (): AppData => ({
  version: 1,
  presets: [
    {
      id: "work",
      name: "仕事",
      icon: "▣",
      tone: "coral",
      description: "短い休憩で、頭と体をリフレッシュ",
      items: [
        item("1分 深呼吸する", 1), item("1分 遠くを眺める", 1), item("1分 肩の力を抜く", 1),
        item("3分 瞑想する", 3), item("3分 目を閉じて休む", 3), item("3分 水を飲んでひと息つく", 3),
        item("5分 ストレッチする", 5), item("5分 外の空気を感じる", 5), item("5分 好きな音楽を1曲聴く", 5),
        item("10分 散歩する", 10), item("10分 お茶やコーヒーを楽しむ", 10), item("10分 何もせずに休む", 10),
        item("15分 軽く体を動かす", 15), item("15分 外に出て気分転換する", 15), item("15分 目と頭をしっかり休める", 15),
      ],
    },
    {
      id: "play",
      name: "遊び",
      icon: "✦",
      tone: "lemon",
      description: "今日はどんな遊びに出会う？",
      items: [
        item("気になっていたゲームを遊ぶ"), item("映画を1本観る"), item("自分だけのプレイリストを作る"),
        item("冷蔵庫にあるもので即興料理"), item("昔好きだった作品を楽しむ"), item("紙とペンで落書きする"),
        item("行ったことのないカフェへ行く"), item("目的を決めず30分散歩する"), item("面白い看板を探して撮る"),
        item("本屋で表紙だけを見て1冊選ぶ"), item("初めてのお菓子を1つ選ぶ"), item("近所の知らない道を歩く"),
        item("公園のベンチでのんびりする"), item("写真フォルダからベストショットを選ぶ"),
      ],
    },
    {
      id: "solo",
      name: "一人で暇な時",
      icon: "☕",
      tone: "violet",
      description: "小さな行動で、暇をちょっといい時間に",
      items: [
        item("引き出しを1つだけ整理する"), item("机の上だけ片づける"), item("いらない写真を10枚消す"),
        item("財布やバッグの中身を整える"), item("温かい飲み物をゆっくり飲む"), item("好きな曲を1曲聴く"),
        item("窓を開けて深呼吸する"), item("何もしない時間を5分つくる"), item("気になる言葉を1つ調べる"),
        item("本を5ページ読む"), item("今日よかったことを3つ書く"), item("明日の自分にメモを書く"),
        item("首と肩をゆっくり回す"), item("部屋で一番好きな物を眺める"), item("いつもと違う飲み物を作る"),
      ],
    },
    {
      id: "bicycle",
      name: "自転車の旅",
      icon: "↟",
      tone: "mint",
      description: "行き先は、風とルーレットにおまかせ",
      journey: true,
      items: [],
    },
  ],
  decisions: [],
  journeys: [],
  activeJourney: null,
  speech: true,
});

const STORAGE_KEY = "whats-next-app-v1";
const directions = ["次に安全に曲がれる場所で左へ", "次に安全に曲がれる場所で右へ", "そのまま直進", "次の信号まで直進", "次の分かれ道は好きな方へ", "景色が気になる方へ進む", "明るく走りやすい道を選ぶ"];
const missions = ["橋があったら渡ってみよう", "緑の多い道を探そう", "青いものを3つ見つけよう", "気になる建物を1つ見つけよう", "知らない公園を探そう", "風が気持ちいい道を選ぼう", "名前が面白い場所を探そう", "お気に入りになりそうな景色を探そう", "安全に停車して旅の写真を1枚撮ろう", "通ったことのない道を1本選ぼう", "坂道を避けるか挑むか直感で決めよう", "パン屋・本屋・喫茶店のどれかを探そう", "季節を感じるものを1つ見つけよう"];
const cardinals = ["北へ出発", "東へ出発", "南へ出発", "西へ出発"];
const randomFrom = <T,>(list: T[]): T => list[Math.floor(Math.random() * list.length)];

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === "object";
const isShortText = (value: unknown, max = 200): value is string => typeof value === "string" && value.length > 0 && value.length <= max;
const isCandidate = (value: unknown): value is Candidate => isRecord(value) && isShortText(value.id, 100) && isShortText(value.label) && typeof value.enabled === "boolean" && (value.minutes === undefined || (typeof value.minutes === "number" && [1, 3, 5, 10, 15].includes(value.minutes)));
const isPreset = (value: unknown): value is Preset => isRecord(value) && isShortText(value.id, 100) && isShortText(value.name, 50) && isShortText(value.icon, 8) && ["coral", "lemon", "violet", "mint", "sky"].includes(String(value.tone)) && isShortText(value.description) && Array.isArray(value.items) && value.items.length <= 500 && value.items.every(isCandidate);
const isStep = (value: unknown): value is JourneyStep => isRecord(value) && isShortText(value.id, 100) && isShortText(value.direction) && isShortText(value.mission) && ["active", "done", "skipped"].includes(String(value.status)) && typeof value.at === "number";
const isDecision = (value: unknown): value is Decision => isRecord(value) && isShortText(value.id, 100) && isShortText(value.preset, 50) && isShortText(value.label) && typeof value.at === "number";
const isJourneyLog = (value: unknown): value is JourneyLog => isRecord(value) && isShortText(value.id, 100) && typeof value.startedAt === "number" && typeof value.endedAt === "number" && isShortText(value.initialDirection, 50) && Array.isArray(value.steps) && value.steps.length <= 1000 && value.steps.every(isStep);
const isActiveJourney = (value: unknown): value is Journey => isRecord(value) && typeof value.startedAt === "number" && (value.duration === null || [30, 60, 90].includes(Number(value.duration))) && isShortText(value.initialDirection, 50) && Array.isArray(value.steps) && value.steps.length <= 1000 && value.steps.every(isStep) && typeof value.turnaroundShown === "boolean";

function safeData(value: unknown): value is AppData {
  if (!isRecord(value) || value.version !== 1 || typeof value.speech !== "boolean") return false;
  if (!Array.isArray(value.presets) || value.presets.length < 1 || value.presets.length > 50 || !value.presets.every(isPreset)) return false;
  if (!value.presets.some((preset) => !preset.journey)) return false;
  if (!Array.isArray(value.decisions) || value.decisions.length > 1000 || !value.decisions.every(isDecision)) return false;
  if (!Array.isArray(value.journeys) || value.journeys.length > 100 || !value.journeys.every(isJourneyLog)) return false;
  return value.activeJourney === null || isActiveJourney(value.activeJourney);
}

export default function Home() {
  const [data, setData] = useState<AppData>(() => makeDefaults());
  const [hydrated, setHydrated] = useState(false);
  const [view, setView] = useState<View>("home");
  const [activeId, setActiveId] = useState("work");
  const [result, setResult] = useState<SpinResult>(null);
  const [spinning, setSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [notice, setNotice] = useState("");
  const [manageId, setManageId] = useState("work");
  const [newItem, setNewItem] = useState("");
  const [newPreset, setNewPreset] = useState("");
  const [journeyDuration, setJourneyDuration] = useState<number | null>(30);
  const [remaining, setRemaining] = useState(0);
  const [timer, setTimer] = useState<{ label: string; endAt: number; duration: number } | null>(null);
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const wakeLock = useRef<WakeLockHandle | null>(null);
  const audioContext = useRef<AudioContext | null>(null);

  const activePreset = data.presets.find((preset) => preset.id === activeId) ?? data.presets[0];
  const managedPreset = data.presets.find((preset) => preset.id === manageId) ?? data.presets[0];
  const enabledItems = useMemo(() => activePreset?.items.filter((entry) => entry.enabled) ?? [], [activePreset]);
  const wheelLabels = useMemo(() => {
    if (activePreset?.journey) return ["北へ", "右へ", "冒険", "南へ", "左へ", "直進"];
    const count = Math.min(6, enabledItems.length);
    if (!count) return [];
    return Array.from({ length: count }, (_, index) => {
      const entry = enabledItems[Math.floor(index * enabledItems.length / count)];
      const shortLabel = entry.label.replace(/する$|してみる$|を楽しむ$/u, "");
      return shortLabel.length > 9 ? `${shortLabel.slice(0, 8)}…` : shortLabel;
    });
  }, [activePreset, enabledItems]);
  const speak = useCallback((text: string) => {
    if (!data.speech || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "ja-JP";
    const japanese = window.speechSynthesis.getVoices().find((voice) => voice.lang.startsWith("ja"));
    if (japanese) utterance.voice = japanese;
    window.speechSynthesis.speak(utterance);
  }, [data.speech]);

  useEffect(() => {
    let savedData: AppData | null = null;
    let loadFailed = false;
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed: unknown = JSON.parse(saved);
        if (safeData(parsed)) savedData = parsed;
      }
    } catch {
      loadFailed = true;
    }
    queueMicrotask(() => {
      if (savedData) setData(savedData);
      if (loadFailed) setNotice("保存データを読み込めなかったため、初期状態で開きました。");
      setHydrated(true);
    });
    const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
    if ("serviceWorker" in navigator) navigator.serviceWorker.register(`${basePath}/sw.js`).catch(() => undefined);
    const captureInstall = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", captureInstall);
    return () => window.removeEventListener("beforeinstallprompt", captureInstall);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      queueMicrotask(() => setNotice("保存できませんでした。端末の空き容量を確認してください。"));
    }
  }, [data, hydrated]);

  useEffect(() => {
    if (!timer) return;
    const tick = () => {
      const next = Math.max(0, Math.ceil((timer.endAt - Date.now()) / 1000));
      setRemaining(next);
      if (next === 0) {
        setTimer(null);
        wakeLock.current?.release?.().catch(() => undefined);
        wakeLock.current = null;
        try {
          if (navigator.vibrate) navigator.vibrate([180, 100, 180]);
          const ctx = audioContext.current;
          if (ctx) {
            const oscillator = ctx.createOscillator();
            const gain = ctx.createGain();
            oscillator.frequency.value = 660;
            gain.gain.value = 0.12;
            oscillator.connect(gain).connect(ctx.destination);
            oscillator.start();
            oscillator.stop(ctx.currentTime + 0.7);
          }
        } catch { /* visual completion remains available */ }
        setNotice("休憩終了！ゆっくり仕事に戻ろう。");
        setView("home");
      }
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [timer]);

  useEffect(() => {
    const journey = data.activeJourney;
    if (!journey || !journey.duration || journey.turnaroundShown) return;
    const duration = journey.duration;
    const check = () => {
      if (Date.now() - journey.startedAt >= duration * 30_000) {
        setData((current) => current.activeJourney ? ({ ...current, activeJourney: { ...current.activeJourney, turnaroundShown: true } }) : current);
        setNotice("そろそろ折り返しの時間です。安全な帰り道を選ぼう。");
        speak("そろそろ折り返しの時間です");
      }
    };
    check();
    const id = window.setInterval(check, 15_000);
    return () => window.clearInterval(id);
  }, [data.activeJourney, speak]);

  function spin() {
    if (!activePreset) return;
    if (activePreset.journey) {
      setView("journey");
      return;
    }
    if (!enabledItems.length) {
      setNotice("回せる候補がありません。候補を1つ以上オンにしてみよう。");
      return;
    }
    setSpinning(true);
    setResult(null);
    setRotation((current) => current + 900 + Math.floor(Math.random() * 360));
    const chosen = randomFrom(enabledItems);
    const workMinutes = activePreset.id === "work" ? Number(chosen.label.match(/^(1|3|5|10|15)分/)?.[1] ?? 0) : chosen.minutes;
    window.setTimeout(() => {
      setResult({ label: chosen.label, minutes: workMinutes || undefined });
      setSpinning(false);
      speak(chosen.label);
    }, window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 80 : 850);
  }

  function acceptResult() {
    if (!result || !activePreset) return;
    setData((current) => ({ ...current, decisions: [{ id: uid(), preset: activePreset.name, label: result.label, at: Date.now() }, ...current.decisions].slice(0, 100) }));
    setNotice("今日の決定に追加しました。");
  }

  async function startTimer() {
    if (!result?.minutes) return;
    try {
      audioContext.current ??= new AudioContext();
      await audioContext.current.resume();
    } catch { /* timer still works visually */ }
    const navigatorWithWakeLock = navigator as NavigatorWithWakeLock;
    if (navigatorWithWakeLock.wakeLock) {
      try { wakeLock.current = await navigatorWithWakeLock.wakeLock.request("screen"); } catch { setNotice("画面が消える場合があります。タイマー中は画面を開いたままにしてください。"); }
    }
    const duration = result.minutes * 60;
    setRemaining(duration);
    setTimer({ label: result.label, duration, endAt: Date.now() + duration * 1000 });
    setView("timer");
  }

  function startJourney() {
    const initialDirection = randomFrom(cardinals);
    const firstStep: JourneyStep = { id: uid(), direction: randomFrom(directions), mission: randomFrom(missions), status: "active", at: Date.now() };
    setData((current) => ({ ...current, activeJourney: { startedAt: Date.now(), duration: journeyDuration, initialDirection, steps: [firstStep], turnaroundShown: false } }));
    speak(`${initialDirection}。${firstStep.direction}。${firstStep.mission}`);
  }

  function drawJourneyStep(missionOnly = false) {
    setData((current) => {
      if (!current.activeJourney) return current;
      const steps = [...current.activeJourney.steps];
      const last = steps[steps.length - 1];
      const next: JourneyStep = {
        id: uid(),
        direction: missionOnly && last ? last.direction : randomFrom(directions),
        mission: randomFrom(missions),
        status: "active",
        at: Date.now(),
      };
      if (last?.status === "active") steps[steps.length - 1] = { ...last, status: "skipped" };
      steps.push(next);
      queueMicrotask(() => speak(`${next.direction}。${next.mission}`));
      return { ...current, activeJourney: { ...current.activeJourney, steps } };
    });
  }

  function completeStep(status: "done" | "skipped") {
    setData((current) => {
      if (!current.activeJourney) return current;
      const steps = current.activeJourney.steps.map((step, index, all) => index === all.length - 1 ? { ...step, status } : step);
      return { ...current, activeJourney: { ...current.activeJourney, steps } };
    });
  }

  function finishJourney() {
    setData((current) => {
      if (!current.activeJourney) return current;
      const steps = current.activeJourney.steps.map((step) => step.status === "active" ? { ...step, status: "skipped" as const } : step);
      const log: JourneyLog = { id: uid(), endedAt: Date.now(), ...current.activeJourney, steps };
      return { ...current, activeJourney: null, journeys: [log, ...current.journeys].slice(0, 30) };
    });
    setNotice("今日の冒険を保存しました。");
    setView("history");
  }

  function updatePreset(id: string, updater: (preset: Preset) => Preset) {
    setData((current) => ({ ...current, presets: current.presets.map((preset) => preset.id === id ? updater(preset) : preset) }));
  }

  function addCandidate() {
    const label = newItem.trim();
    if (!label || !managedPreset || managedPreset.journey) return;
    const workMinutes = managedPreset.id === "work" ? Number(label.match(/^(1|3|5|10|15)分/)?.[1] ?? 0) : undefined;
    if (managedPreset.id === "work" && !workMinutes) {
      setNotice("仕事の候補は「1分・3分・5分・10分・15分」のどれかから始めてください。");
      return;
    }
    updatePreset(managedPreset.id, (preset) => ({ ...preset, items: [...preset.items, item(label, workMinutes)] }));
    setNewItem("");
  }

  function editCandidate(candidate: Candidate) {
    if (!managedPreset) return;
    const next = window.prompt("候補を編集", candidate.label)?.trim();
    if (!next || next === candidate.label) return;
    const workMinutes = managedPreset.id === "work" ? Number(next.match(/^(1|3|5|10|15)分/)?.[1] ?? 0) : candidate.minutes;
    if (managedPreset.id === "work" && !workMinutes) {
      setNotice("仕事の候補は「1分・3分・5分・10分・15分」のどれかから始めてください。");
      return;
    }
    updatePreset(managedPreset.id, (preset) => ({ ...preset, items: preset.items.map((entry) => entry.id === candidate.id ? { ...entry, label: next, minutes: workMinutes || undefined } : entry) }));
  }

  function goHome() {
    if (view === "timer" && timer) {
      if (!window.confirm("タイマーを終了してホームへ戻りますか？")) return;
      setTimer(null);
      wakeLock.current?.release().catch(() => undefined);
      wakeLock.current = null;
    }
    setView("home");
  }

  function createPreset() {
    const name = newPreset.trim();
    if (!name) return;
    const preset: Preset = { id: uid(), name, icon: "✺", tone: "sky", description: "あなたが作ったオリジナルプリセット", custom: true, items: [] };
    setData((current) => ({ ...current, presets: [...current.presets, preset] }));
    setManageId(preset.id);
    setActiveId(preset.id);
    setNewPreset("");
  }

  function exportBackup() {
    const payload = { app: "What’s Next?", exportedAt: new Date().toISOString(), ...data };
    const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `whats-next-backup-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function importBackup(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file || file.size > 2_000_000) return setNotice("バックアップが大きすぎます。");
    try {
      const parsed: unknown = JSON.parse(await file.text());
      if (!safeData(parsed)) throw new Error("invalid");
      if (window.confirm("現在のデータを、このバックアップで置き換えますか？")) {
        setData(parsed);
        setActiveId(parsed.presets[0]?.id ?? "work");
        setNotice("バックアップを読み込みました。");
      }
    } catch {
      setNotice("このバックアップは読み込めませんでした。");
    }
    event.target.value = "";
  }

  function resetAll() {
    if (!window.confirm("自作プリセット、候補、設定、履歴が消去されます。続けますか？")) return;
    if (!window.confirm("本当にすべて初期状態に戻しますか？")) return;
    const fresh = makeDefaults();
    setData(fresh);
    setActiveId("work");
    setManageId("work");
    setResult(null);
    setNotice("初期状態に戻しました。");
    setView("home");
  }

  const currentJourneyStep = data.activeJourney?.steps.at(-1);
  const timerMinutes = Math.floor(remaining / 60).toString().padStart(2, "0");
  const timerSeconds = (remaining % 60).toString().padStart(2, "0");

  return (
    <main className="app-shell">
      <div className="ambient ambient-one" /><div className="ambient ambient-two" />
      <section className="phone-frame" aria-label="What’s Next? アプリ">
        <header className="app-header">
          <button className="brand" onClick={goHome} aria-label="ホームへ戻る">
            <span className="brand-mark">↗</span><span>What’s Next?</span>
          </button>
          <button className="icon-button" onClick={() => setView("settings")} aria-label="設定を開く">•••</button>
        </header>

        {notice && <button className="notice" onClick={() => setNotice("")} aria-live="polite">{notice}<span>×</span></button>}

        {view === "home" && activePreset && (
          <div className="view home-view">
            <div className="hero-copy"><p className="eyebrow">YOUR NEXT MOVE</p><h1>ひまな時間を、<br /><em>次の一歩</em>に。</h1></div>
            <div className="preset-grid" aria-label="プリセットを選ぶ">
              {data.presets.slice(0, 4).map((preset) => (
                <button key={preset.id} className={`preset-card ${preset.tone} ${activeId === preset.id ? "selected" : ""}`} aria-pressed={activeId === preset.id} onClick={() => { setActiveId(preset.id); setResult(null); }}>
                  <span className="preset-icon">{preset.icon}</span><span><b>{preset.name}</b><small>{preset.journey ? "冒険モード" : `${preset.items.filter((entry) => entry.enabled).length}の候補`}</small></span>
                </button>
              ))}
              {data.presets.length > 4 && <button className="more-presets" onClick={() => setView("presets")}>自作プリセットを見る <span>→</span></button>}
            </div>

            <section className={`wheel-stage ${activePreset.tone}`}>
              <div className="wheel-pointer">▼</div>
              <button className={`wheel ${spinning ? "is-spinning" : ""}`} style={{ "--rotation": `${rotation}deg` } as React.CSSProperties} onClick={spin} disabled={spinning} aria-label={activePreset.journey ? "旅モードを開く" : "ルーレットを回す"}>
                {wheelLabels.map((label, index) => <span className={`wheel-label label-${index}`} key={`${label}-${index}`}>{label}</span>)}
                <span className="wheel-center"><small>{activePreset.name}</small><b>{spinning ? "選んでいます…" : result?.label ?? (activePreset.journey ? "旅へ出よう" : "何をする？")}</b></span>
              </button>
              <p className="preset-description">{activePreset.description}</p>
            </section>

            <button className="primary-button spin-button" onClick={spin} disabled={spinning}>{activePreset.journey ? "旅モードをはじめる" : spinning ? "選んでいます…" : "ルーレットを回す"}<span>↗</span></button>
            {result && !spinning && (
              <section className="result-card" aria-live="polite">
                <div><span className="result-kicker">TODAY&apos;S PICK</span><h2>{result.label}</h2></div>
                <div className="result-actions">
                  <button onClick={acceptResult}>これに決定</button><button onClick={spin}>もう一度</button>
                  {result.minutes && <button className="timer-button" onClick={startTimer}>{result.minutes}分タイマーを開始</button>}
                </div>
              </section>
            )}
          </div>
        )}

        {view === "timer" && timer && (
          <div className="view timer-view">
            <p className="eyebrow">BREAK TIMER</p><h1>ひと休みしよう。</h1>
            <div className="timer-clock" aria-live="off"><span>{timerMinutes}</span><i>:</i><span>{timerSeconds}</span></div>
            <h2>{timer.label}</h2><p>タイマー中はこの画面を開いたままにしてください。</p>
            <button className="secondary-button" onClick={() => { setTimer(null); wakeLock.current?.release?.(); setView("home"); }}>タイマーを終了</button>
          </div>
        )}

        {view === "journey" && (
          <div className="view journey-view">
            <p className="eyebrow">BICYCLE ADVENTURE</p><h1>風まかせの旅。</h1>
            {!data.activeJourney ? (
              <>
                <div className="safety-card"><b>安全に楽しむために</b><p>操作と画面の確認は、必ず安全な場所に停車してから。交通ルールと道路状況を最優先にしてください。</p><small>GPSや位置情報は使用しません。</small></div>
                <fieldset className="duration-picker"><legend>予定時間を選ぶ</legend>{[30, 60, 90, null].map((duration) => <button key={duration ?? "free"} className={journeyDuration === duration ? "active" : ""} onClick={() => setJourneyDuration(duration)}>{duration ? `${duration}分` : "時間無制限"}</button>)}</fieldset>
                <button className="primary-button" onClick={startJourney}>最初のカードを引く <span>↗</span></button>
              </>
            ) : (
              <>
                <div className="journey-status"><span>出発</span><b>{data.activeJourney.initialDirection}</b><small>{data.activeJourney.steps.length}枚目のカード</small></div>
                {data.activeJourney.turnaroundShown && <div className="turnaround">そろそろ折り返し。安全な帰り道を選ぼう。</div>}
                {currentJourneyStep && <div className="adventure-cards" aria-live="polite"><article className="direction-card"><span>DIRECTION</span><h2>{currentJourneyStep.direction}</h2></article><article className="mission-card"><span>MISSION</span><h2>{currentJourneyStep.mission}</h2></article></div>}
                <div className="journey-actions"><button className="primary-button" onClick={() => { completeStep("done"); window.setTimeout(() => drawJourneyStep(), 0); }}>できた！ 次の冒険へ</button><button onClick={() => { completeStep("skipped"); window.setTimeout(() => drawJourneyStep(), 0); }}>今回はスキップ</button><button onClick={() => drawJourneyStep(true)}>ミッションだけ引き直す</button></div>
                <button className="text-button danger-text" onClick={finishJourney}>旅を終える</button>
                <p className="safety-note">必ず停車して操作してください。危険・通行禁止の指示は迷わず引き直しましょう。</p>
              </>
            )}
          </div>
        )}

        {view === "history" && (
          <div className="view list-view">
            <p className="eyebrow">YOUR STORY</p><h1>これまでの選択。</h1>
            <section><div className="section-heading"><h2>決定履歴</h2><span>{data.decisions.length}</span></div>{data.decisions.length ? data.decisions.map((entry) => <article className="history-row" key={entry.id}><span className="history-dot" /><div><b>{entry.label}</b><small>{entry.preset} · {new Date(entry.at).toLocaleString("ja-JP", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}</small></div></article>) : <div className="empty-state">まだ履歴はありません。<small>「これに決定」を押すと、ここに残ります。</small></div>}</section>
            <section><div className="section-heading"><h2>自転車の旅</h2><span>{data.journeys.length}</span></div>{data.journeys.map((journey) => <article className="journey-log" key={journey.id}><div><b>{journey.initialDirection}</b><small>{new Date(journey.startedAt).toLocaleDateString("ja-JP")}</small></div><span>{journey.steps.filter((step) => step.status === "done").length} ミッション達成</span><details><summary>旅の履歴を見る</summary>{journey.steps.map((step) => <p key={step.id}>→ {step.direction}<br /><small>{step.mission} · {step.status === "done" ? "できた！" : "スキップ"}</small></p>)}</details></article>)}</section>
          </div>
        )}

        {view === "presets" && managedPreset && (
          <div className="view manage-view">
            <p className="eyebrow">MAKE IT YOURS</p><h1>プリセット編集。</h1>
            <div className="preset-tabs">{data.presets.filter((preset) => !preset.journey).map((preset) => <button key={preset.id} className={manageId === preset.id ? "active" : ""} onClick={() => setManageId(preset.id)}>{preset.name}</button>)}</div>
            <button className="use-preset-button" onClick={() => { setActiveId(managedPreset.id); setResult(null); setView("home"); }}>このプリセットを使う <span>→</span></button>
            <div className="create-row"><input value={newPreset} onChange={(event) => setNewPreset(event.target.value)} placeholder="新しいプリセット名" maxLength={30} /><button onClick={createPreset}>作る</button></div>
            <section className="candidate-editor"><div className="section-heading"><h2>{managedPreset.name}の候補</h2><span>{managedPreset.items.filter((entry) => entry.enabled).length}/{managedPreset.items.length}</span></div>
              <div className="create-row"><input value={newItem} onChange={(event) => setNewItem(event.target.value)} onKeyDown={(event) => event.key === "Enter" && addCandidate()} placeholder="候補を追加" maxLength={80} /><button onClick={addCandidate}>追加</button></div>
              {managedPreset.items.map((entry) => <div className="candidate-row" key={entry.id}><label className="switch"><input type="checkbox" checked={entry.enabled} onChange={(event) => updatePreset(managedPreset.id, (preset) => ({ ...preset, items: preset.items.map((candidate) => candidate.id === entry.id ? { ...candidate, enabled: event.target.checked } : candidate) }))} /><span /></label><button className="candidate-label" onClick={() => editCandidate(entry)} aria-label={`${entry.label}を編集`}>{entry.label}<small>編集</small></button><button aria-label={`${entry.label}を削除`} onClick={() => updatePreset(managedPreset.id, (preset) => ({ ...preset, items: preset.items.filter((candidate) => candidate.id !== entry.id) }))}>×</button></div>)}
              {managedPreset.custom && <button className="text-button danger-text" onClick={() => { if (window.confirm(`「${managedPreset.name}」を削除しますか？`)) { setData((current) => ({ ...current, presets: current.presets.filter((preset) => preset.id !== managedPreset.id) })); setManageId("work"); setActiveId("work"); } }}>このプリセットを削除</button>}
            </section>
          </div>
        )}

        {view === "settings" && (
          <div className="view settings-view">
            <p className="eyebrow">SETTINGS</p><h1>使いやすく整える。</h1>
            <section className="settings-section"><h2>旅モード</h2><label className="setting-row"><span><b>音声読み上げ</b><small>方向とミッションを日本語で読み上げます</small></span><span className="switch"><input type="checkbox" checked={data.speech} onChange={(event) => setData((current) => ({ ...current, speech: event.target.checked }))} /><span /></span></label></section>
            <section className="settings-section"><h2>この端末</h2><button className="setting-row button-row" onClick={async () => { if (installPrompt) { await installPrompt.prompt(); setInstallPrompt(null); } else setNotice("ブラウザの共有メニューから「ホーム画面に追加」を選んでください。"); }}><span><b>ホーム画面に追加</b><small>アプリのように起動できます</small></span><span>↗</span></button><div className="offline-badge"><span>●</span><div><b>オフライン対応</b><small>一度読み込めば、通信なしで使えます</small></div></div></section>
            <section className="settings-section"><h2>データ</h2><button className="setting-row button-row" onClick={exportBackup}><span><b>バックアップを書き出す</b><small>候補・設定・履歴を1つのファイルへ</small></span><span>↓</span></button><button className="setting-row button-row" onClick={() => importRef.current?.click()}><span><b>バックアップを読み込む</b><small>保存した状態へ戻します</small></span><span>↑</span></button><input ref={importRef} className="visually-hidden" type="file" accept="application/json" onChange={importBackup} /><button className="reset-button" onClick={resetAll}>すべて初期状態に戻す</button></section>
            <p className="privacy-note">データはこの端末だけに保存されます。位置情報や個人情報を外部へ送信しません。</p>
          </div>
        )}

        {view !== "timer" && view !== "journey" && <nav className="bottom-nav" aria-label="メインメニュー"><button className={view === "home" ? "active" : ""} onClick={() => setView("home")}><span>◎</span>ルーレット</button><button className={view === "history" ? "active" : ""} onClick={() => setView("history")}><span>↶</span>履歴</button><button className={view === "presets" ? "active" : ""} onClick={() => setView("presets")}><span>＋</span>プリセット</button></nav>}
        {(view === "timer" || view === "journey") && <button className="floating-back" onClick={goHome} aria-label="ホームへ戻る">←</button>}
      </section>
    </main>
  );
}
