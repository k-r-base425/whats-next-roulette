"use client";

import { ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";

type Candidate = { id: string; label: string; enabled: boolean; minutes?: number };
type Preset = {
  id: string;
  name: string;
  icon: string;
  tone: "coral" | "lemon" | "violet" | "mint" | "sky" | "lime";
  description: string;
  custom?: boolean;
  journey?: boolean;
  items: Candidate[];
};
type Decision = { id: string; preset: string; label: string; at: number };
type JourneyStep = {
  id: string;
  direction: string;
  route?: string;
  theme?: string;
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
type ReelDisplay = { direction: string; route: string; theme: string; mission: string };
type HistoryFeedItem = { kind: "decision"; id: string; at: number; decision: Decision } | { kind: "journey"; id: string; at: number; journey: JourneyLog };
type CandidateEditor = { presetId: string; candidateId: string; draft: string } | null;
type InstallPromptEvent = Event & { prompt: () => Promise<void> };
type WakeLockHandle = { released: boolean; release: () => Promise<void> };
type NavigatorWithWakeLock = Navigator & { wakeLock?: { request: (kind: "screen") => Promise<WakeLockHandle> } };

const uid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
const item = (label: string, minutes?: number): Candidate => ({ id: uid(), label, enabled: true, minutes });
const makeRecoveryPreset = (): Preset => ({
  id: "recovery",
  name: "回復",
  icon: "≋",
  tone: "sky",
  description: "心と体をゆるめる",
  items: [
    item("1分 深呼吸を5回する", 1), item("1分 遠くを眺める", 1), item("1分 水を飲む", 1),
    item("3分 目を閉じて休む", 3), item("3分 首と肩をゆっくり回す", 3), item("3分 静かな音を聴く", 3),
    item("5分 全身を伸ばす", 5), item("5分 温かい飲み物を飲む", 5), item("5分 何もせず休む", 5),
    item("10分 横になって休む", 10), item("10分 スマホを置いて過ごす", 10), item("10分 ゆっくり散歩する", 10),
    item("15分 短い仮眠をとる", 15), item("15分 静かな場所で休む", 15), item("15分 好きな音楽で気分を整える", 15),
  ],
});
const makeWorkoutPreset = (): Preset => ({
  id: "workout",
  name: "筋トレ",
  icon: "⇆",
  tone: "violet",
  description: "3分だけ、気持ちよく体を動かす",
  items: [
    item("3分 スクワット", 3), item("3分 腕立て伏せ", 3), item("3分 腹筋", 3),
    item("3分 プランク", 3), item("3分 ランジ", 3), item("3分 背筋", 3),
  ],
});
const makeFreePreset = (): Preset => ({
  id: "free",
  name: "フリーモード",
  icon: "✎",
  tone: "lime",
  description: "6つの枠を自由に決める",
  items: [
    item("散歩する"), item("本を読む"), item("コーヒーを飲む"),
    { ...item("＋ 自由に入力"), enabled: false },
    { ...item("＋ 自由に入力"), enabled: false },
    { ...item("＋ 自由に入力"), enabled: false },
  ],
});

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
    makeRecoveryPreset(),
    makeWorkoutPreset(),
    makeFreePreset(),
  ],
  decisions: [],
  journeys: [],
  activeJourney: null,
  speech: true,
});

const ensureDefaultPresets = (data: AppData): AppData => {
  const presets = [...data.presets];
  if (!presets.some((preset) => preset.id === "recovery")) {
    const bicycleIndex = presets.findIndex((preset) => preset.id === "bicycle");
    presets.splice(bicycleIndex >= 0 ? bicycleIndex + 1 : presets.length, 0, makeRecoveryPreset());
  }
  if (!presets.some((preset) => preset.id === "workout")) presets.push(makeWorkoutPreset());
  if (!presets.some((preset) => preset.id === "free")) presets.push(makeFreePreset());
  return {
    ...data,
    presets: presets.map((preset) => {
      if (preset.id === "free") {
        const items = preset.items.slice(0, 6);
        while (items.length < 6) items.push({ ...item("＋ 自由に入力"), enabled: false });
        return { ...preset, items };
      }
      if (["work", "recovery", "workout"].includes(preset.id)) return {
        ...preset,
        items: preset.items.map((entry) => {
          const minutes = preset.id === "workout" ? 3 : Number(entry.label.match(/^(1|3|5|10|15)分/)?.[1] ?? 0);
          const label = preset.id === "workout" ? `3分 ${entry.label.replace(/^(1|3|5|10|15)分\s*/u, "")}` : entry.label;
          return { ...entry, label, minutes: minutes || entry.minutes };
        }),
      };
      return preset;
    }),
  };
};

const STORAGE_KEY = "whats-next-app-v1";
const MAX_PRESETS = 51;
const MAX_CANDIDATES = 500;
const MAX_JOURNEY_STEPS = 1000;
const directions = ["次に安全に曲がれる場所で左へ", "次に安全に曲がれる場所で右へ", "そのまま直進", "次の信号まで直進", "次の分かれ道は好きな方へ", "景色が気になる方へ進む", "明るく走りやすい道を選ぶ"];
const routeStyles = ["緑の多い道", "静かな細道", "見晴らしのよい道", "平坦で走りやすい道", "川沿いの道", "にぎやかな通り", "住宅街の道"];
const journeyThemes = ["景色を探す", "色を探す", "店を探す", "季節を探す", "面白い名前を探す", "建物を眺める", "直感にまかせる"];
const missions = ["橋があったら渡ってみよう", "緑の多い道を探そう", "青いものを3つ見つけよう", "気になる建物を1つ見つけよう", "知らない公園を探そう", "風が気持ちいい道を選ぼう", "名前が面白い場所を探そう", "お気に入りになりそうな景色を探そう", "安全に停車して旅の写真を1枚撮ろう", "通ったことのない道を1本選ぼう", "坂道を避けるか挑むか直感で決めよう", "パン屋・本屋・喫茶店のどれかを探そう", "季節を感じるものを1つ見つけよう"];
const cardinals = ["北へ出発", "東へ出発", "南へ出発", "西へ出発"];
const journeyWheelLabels = ["北へ", "東へ", "南へ", "冒険", "西へ", "直進"];
const journeyDirectionSegments: Record<string, number> = { "北へ出発": 0, "東へ出発": 1, "南へ出発": 2, "西へ出発": 4 };
const randomFrom = <T,>(list: T[]): T => list[Math.floor(Math.random() * list.length)];
const startOfLocalDay = (time: number) => { const date = new Date(time); return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime(); };
const historyGroup = (time: number, now = Date.now()) => {
  const today = startOfLocalDay(now);
  const day = startOfLocalDay(time);
  const yesterdayDate = new Date(today);
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  if (day === today) return "今日";
  if (day === yesterdayDate.getTime()) return "昨日";
  return "それ以前";
};
const makeWheelItems = (items: Candidate[]): Candidate[] => {
  if (!items.length) return [];
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  const selected = shuffled.slice(0, 6);
  while (selected.length < 6) selected.push(shuffled[selected.length % shuffled.length]);
  return selected;
};

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === "object";
const isShortText = (value: unknown, max = 200): value is string => typeof value === "string" && value.length > 0 && value.length <= max;
const isCandidate = (value: unknown): value is Candidate => isRecord(value) && isShortText(value.id, 100) && isShortText(value.label) && typeof value.enabled === "boolean" && (value.minutes === undefined || (typeof value.minutes === "number" && [1, 3, 5, 10, 15].includes(value.minutes)));
const isPreset = (value: unknown): value is Preset => isRecord(value) && isShortText(value.id, 100) && isShortText(value.name, 50) && isShortText(value.icon, 8) && ["coral", "lemon", "violet", "mint", "sky", "lime"].includes(String(value.tone)) && isShortText(value.description) && Array.isArray(value.items) && value.items.length <= 500 && value.items.every(isCandidate);
const isStep = (value: unknown): value is JourneyStep => isRecord(value) && isShortText(value.id, 100) && isShortText(value.direction) && (value.route === undefined || isShortText(value.route)) && (value.theme === undefined || isShortText(value.theme)) && isShortText(value.mission) && ["active", "done", "skipped"].includes(String(value.status)) && typeof value.at === "number";
const isDecision = (value: unknown): value is Decision => isRecord(value) && isShortText(value.id, 100) && isShortText(value.preset, 50) && isShortText(value.label) && typeof value.at === "number";
const isJourneyLog = (value: unknown): value is JourneyLog => isRecord(value) && isShortText(value.id, 100) && typeof value.startedAt === "number" && typeof value.endedAt === "number" && isShortText(value.initialDirection, 50) && Array.isArray(value.steps) && value.steps.length <= 1000 && value.steps.every(isStep);
const isActiveJourney = (value: unknown): value is Journey => isRecord(value) && typeof value.startedAt === "number" && (value.duration === null || [30, 60, 90].includes(Number(value.duration))) && isShortText(value.initialDirection, 50) && Array.isArray(value.steps) && value.steps.length <= 1000 && value.steps.every(isStep) && typeof value.turnaroundShown === "boolean";

function safeData(value: unknown): value is AppData {
  if (!isRecord(value) || value.version !== 1 || typeof value.speech !== "boolean") return false;
  const presets = value.presets;
  if (!Array.isArray(presets)) return false;
  const migratedSystemAllowance = presets.length <= MAX_PRESETS + 3 && ["recovery", "workout", "free"].every((id) => presets.some((preset) => isRecord(preset) && preset.id === id));
  if (presets.length < 1 || (presets.length > MAX_PRESETS && !migratedSystemAllowance) || !presets.every(isPreset)) return false;
  if (!presets.some((preset) => !preset.journey)) return false;
  if (!Array.isArray(value.decisions) || value.decisions.length > 1000 || !value.decisions.every(isDecision)) return false;
  if (!Array.isArray(value.journeys) || value.journeys.length > 100 || !value.journeys.every(isJourneyLog)) return false;
  return value.activeJourney === null || isActiveJourney(value.activeJourney);
}

function PresetGlyph({ id }: { id: string }) {
  const common = { fill: "none", stroke: "currentColor", strokeWidth: 2.2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  if (id === "work") return <svg viewBox="0 0 32 32" aria-hidden="true"><path {...common} d="M5 11h22v15H5zM11 11V7h10v4M5 16h22M14 16v4h4v-4" /></svg>;
  if (id === "play") return <svg viewBox="0 0 32 32" aria-hidden="true"><path {...common} d="M9 12h14c3 0 5 3 6 10 .4 3-3 5-5 3l-4-4h-8l-4 4c-2 2-5-.1-5-3 1-7 3-10 6-10Z" /><path {...common} d="M9 16v5M6.5 18.5h5M22 17h.1M25 20h.1" /></svg>;
  if (id === "solo") return <svg viewBox="0 0 32 32" aria-hidden="true"><path {...common} d="M5 7c5-1 8 0 11 3v16c-3-3-6-4-11-3V7Zm22 0c-5-1-8 0-11 3v16c3-3 6-4 11-3V7Z" /></svg>;
  if (id === "bicycle") return <svg viewBox="0 0 32 32" aria-hidden="true"><circle {...common} cx="8" cy="22" r="5" /><circle {...common} cx="24" cy="22" r="5" /><path {...common} d="m8 22 5-9 5 9H8Zm10 0 4-11h4M12 10h5M13 13h8" /></svg>;
  if (id === "recovery") return <svg viewBox="0 0 32 32" aria-hidden="true"><path {...common} d="M4 10c4-4 7 4 11 0s7 4 13 0M4 16c4-4 7 4 11 0s7 4 13 0M4 22c4-4 7 4 11 0s7 4 13 0" /></svg>;
  if (id === "workout") return <svg viewBox="0 0 32 32" aria-hidden="true"><path {...common} d="M3 13v6m4-9v12m18-9v6m-4-9v12M7 16h18M11 13v6m10-6v6" /></svg>;
  if (id === "free") return <svg viewBox="0 0 32 32" aria-hidden="true"><path {...common} d="m7 23-1 4 4-1L25 11l-4-4L7 23Zm11-13 4 4M5 28h12" /></svg>;
  return <svg viewBox="0 0 32 32" aria-hidden="true"><path {...common} d="M16 4v24M4 16h24M8 8l16 16M24 8 8 24" /></svg>;
}

function WheelGlyph({ presetId, index, label = "", empty = false }: { presetId: string; index: number; label?: string; empty?: boolean }) {
  const common = { fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  if (empty) return <span className="wheel-empty-glyph" aria-hidden="true">＋</span>;
  const workoutGlyphIndex: Record<string, number> = { "スクワット": 0, "腕立て伏せ": 1, "腹筋": 2, "プランク": 3, "ランジ": 4, "背筋": 5 };
  const resolvedIndex = presetId === "workout" ? (workoutGlyphIndex[label.replace(/^3分\s*/u, "")] ?? index) : index;
  const key = presetId === "bicycle" ? `journey-${index}` : `${presetId}-${resolvedIndex}`;
  const glyphs: Record<string, React.ReactNode> = {
    "journey-0": <svg viewBox="0 0 32 32"><path {...common} d="m3 26 9-16 6 10 4-7 7 13H3Z" /></svg>,
    "journey-1": <svg viewBox="0 0 32 32"><circle {...common} cx="16" cy="16" r="6"/><path {...common} d="M16 3v5m0 16v5M3 16h5m16 0h5M7 7l4 4m10 10 4 4m0-18-4 4M11 21l-4 4"/></svg>,
    "journey-2": <svg viewBox="0 0 32 32"><path {...common} d="M16 28V13m0 1c-4-5-8-5-11-1 5 0 8 2 11 6m0-5c4-5 8-5 11-1-5 0-8 2-11 6M9 28h14"/></svg>,
    "journey-3": <svg viewBox="0 0 32 32"><path {...common} d="m16 4 3.5 7.3 8 .9-5.9 5.4 1.6 7.9-7.2-4-7.2 4 1.6-7.9-5.9-5.4 8-.9L16 4Z"/></svg>,
    "journey-4": <svg viewBox="0 0 32 32"><path {...common} d="M3 12c5-5 8 5 13 0s8 5 13 0M3 20c5-5 8 5 13 0s8 5 13 0"/></svg>,
    "journey-5": <svg viewBox="0 0 32 32"><path {...common} d="M16 28V5m0 0-7 7m7-7 7 7"/></svg>,
    "workout-0": <svg viewBox="0 0 32 32"><circle {...common} cx="18" cy="5" r="2.5"/><path {...common} d="m17 9-4 6 5 3m-8-3-4 6h8l-2 7m7-10 5 9"/></svg>,
    "workout-1": <svg viewBox="0 0 32 32"><circle {...common} cx="26" cy="10" r="2.5"/><path {...common} d="M4 21h22M9 20l5-8 8 3 4 6M7 24h20"/></svg>,
    "workout-2": <svg viewBox="0 0 32 32"><circle {...common} cx="22" cy="7" r="2.5"/><path {...common} d="M5 24h22M9 22c0-8 4-12 10-12l3 8 5 3M6 19l5 2"/></svg>,
    "workout-3": <svg viewBox="0 0 32 32"><circle {...common} cx="26" cy="14" r="2.5"/><path {...common} d="M4 19h21M8 18l5-7 8 3 4 5M7 23h20"/></svg>,
    "workout-4": <svg viewBox="0 0 32 32"><circle {...common} cx="17" cy="5" r="2.5"/><path {...common} d="m16 9-3 7 5 3m-7-3-6 4 8 2-2 6m7-9 7 8"/></svg>,
    "workout-5": <svg viewBox="0 0 32 32"><circle {...common} cx="19" cy="8" r="2.5"/><path {...common} d="M5 24h23M9 22l5-9 7 4 5 5M6 18l6 2"/></svg>,
    "free-0": <svg viewBox="0 0 32 32"><circle {...common} cx="16" cy="6" r="3"/><path {...common} d="m15 10-4 8 6 3m-8-6-5 5m13 1-4 8m5-14 6 5 4-1"/></svg>,
    "free-1": <svg viewBox="0 0 32 32"><path {...common} d="M4 7c5-1 8 0 12 4v16c-4-4-7-5-12-4V7Zm24 0c-5-1-8 0-12 4v16c4-4 7-5 12-4V7Z"/></svg>,
    "free-2": <svg viewBox="0 0 32 32"><path {...common} d="M6 12h18v7c0 5-3 8-9 8s-9-3-9-8v-7Zm18 2h2a4 4 0 0 1 0 8h-3M11 4c-3 3 2 4-1 7m7-7c-3 3 2 4-1 7"/></svg>,
  };
  if (glyphs[key]) return <span className="wheel-glyph" aria-hidden="true">{glyphs[key]}</span>;
  const generic = [
    <path {...common} key="a" d="M6 8h20v17H6zM10 13h12m-12 5h8" />,
    <path {...common} key="b" d="M16 4v24M4 16h24M8 8l16 16M24 8 8 24" />,
    <path {...common} key="c" d="M5 22c5-8 8 5 13-3s7 2 9-8M6 27h20" />,
    <path {...common} key="d" d="M16 4c5 5 8 8 8 14a8 8 0 0 1-16 0c0-6 3-9 8-14Z" />,
    <path {...common} key="e" d="M5 8h22v18H5zM9 12h14M9 17h10M9 22h7" />,
    <path {...common} key="f" d="m16 4 3.5 7.3 8 .9-5.9 5.4 1.6 7.9-7.2-4-7.2 4 1.6-7.9-5.9-5.4 8-.9L16 4Z" />,
  ];
  return <span className="wheel-glyph" aria-hidden="true"><svg viewBox="0 0 32 32">{generic[index % generic.length]}</svg></span>;
}

function ActionGlyph({ kind }: { kind: "spin" | "map" | "edit" }) {
  const common = { fill: "none", stroke: "currentColor", strokeWidth: 2.2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  if (kind === "map") return <svg viewBox="0 0 32 32" aria-hidden="true"><path {...common} d="m4 8 8-4 8 4 8-4v20l-8 4-8-4-8 4V8Zm8-4v20m8-16v20"/></svg>;
  if (kind === "edit") return <svg viewBox="0 0 32 32" aria-hidden="true"><path {...common} d="m6 23-1 5 5-1L26 11l-5-5L6 23Zm12-14 5 5M5 29h17"/></svg>;
  return <svg viewBox="0 0 32 32" aria-hidden="true"><path {...common} d="M25 9a11 11 0 1 0 2 10M25 4v7h-7"/></svg>;
}

export default function Home() {
  const [data, setData] = useState<AppData>(() => makeDefaults());
  const [hydrated, setHydrated] = useState(false);
  const [persistenceEnabled, setPersistenceEnabled] = useState(false);
  const [view, setView] = useState<View>("home");
  const [activeId, setActiveId] = useState("work");
  const [result, setResult] = useState<SpinResult>(null);
  const [spinning, setSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [wheelSet, setWheelSet] = useState<{ presetId: string; items: Candidate[] } | null>(null);
  const [notice, setNotice] = useState("");
  const [manageId, setManageId] = useState("work");
  const [newItem, setNewItem] = useState("");
  const [newPreset, setNewPreset] = useState("");
  const [candidateEditor, setCandidateEditor] = useState<CandidateEditor>(null);
  const [creatingPreset, setCreatingPreset] = useState(false);
  const [customPickerOpen, setCustomPickerOpen] = useState(false);
  const [localDayKey, setLocalDayKey] = useState(() => startOfLocalDay(Date.now()));
  const [journeyDuration, setJourneyDuration] = useState<number | null>(30);
  const [journeySpinning, setJourneySpinning] = useState(false);
  const [reelDisplay, setReelDisplay] = useState<ReelDisplay>({ direction: directions[0], route: routeStyles[0], theme: journeyThemes[0], mission: missions[0] });
  const [remaining, setRemaining] = useState(0);
  const [timer, setTimer] = useState<{ label: string; endAt: number; duration: number } | null>(null);
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const presetTabsRef = useRef<HTMLDivElement>(null);
  const candidateDialogRef = useRef<HTMLElement>(null);
  const candidateReturnFocus = useRef<HTMLElement | null>(null);
  const wakeLock = useRef<WakeLockHandle | null>(null);
  const audioContext = useRef<AudioContext | null>(null);
  const reelInterval = useRef<number | null>(null);
  const reelTimeout = useRef<number | null>(null);
  const spinTimeout = useRef<number | null>(null);

  const activePreset = data.presets.find((preset) => preset.id === activeId) ?? data.presets[0];
  const managedPreset = data.presets.find((preset) => preset.id === manageId) ?? data.presets[0];
  const systemHomePresets = ["work", "play", "solo", "recovery", "bicycle", "workout", "free"].map((id) => data.presets.find((preset) => preset.id === id)).filter((preset): preset is Preset => Boolean(preset));
  const homePresets = activePreset?.custom ? [...systemHomePresets, activePreset] : systemHomePresets;
  const enabledItems = useMemo(() => activePreset?.items.filter((entry) => entry.enabled) ?? [], [activePreset]);
  const previewWheelItems = useMemo(() => activePreset?.id === "free" ? activePreset.items.slice(0, 6) : enabledItems.length ? Array.from({ length: 6 }, (_, index) => enabledItems[Math.floor(index * enabledItems.length / 6)]) : [], [activePreset, enabledItems]);
  const visibleWheelItems = wheelSet?.presetId === activePreset?.id ? wheelSet.items : previewWheelItems;
  const editablePresets = data.presets.filter((preset) => !preset.journey);
  const customPresets = editablePresets.filter((preset) => preset.custom);
  const historyFeed = useMemo<HistoryFeedItem[]>(() => [
    ...data.decisions.map((decision) => ({ kind: "decision" as const, id: decision.id, at: decision.at, decision })),
    ...data.journeys.map((journey) => ({ kind: "journey" as const, id: journey.id, at: journey.startedAt, journey })),
  ].sort((a, b) => b.at - a.at), [data.decisions, data.journeys]);
  const groupedHistory = useMemo(() => {
    const groups = new Map<string, HistoryFeedItem[]>();
    for (const label of ["今日", "昨日", "それ以前"]) groups.set(label, []);
    for (const entry of historyFeed) groups.get(historyGroup(entry.at, localDayKey))?.push(entry);
    return [...groups.entries()].filter(([, entries]) => entries.length > 0);
  }, [historyFeed, localDayKey]);
  const monthlyStats = useMemo(() => {
    const now = new Date(localDayKey);
    const start = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 1).getTime();
    return {
      decisions: data.decisions.filter((entry) => entry.at >= start && entry.at < end).length,
      journeys: data.journeys.filter((entry) => entry.startedAt >= start && entry.startedAt < end).length,
    };
  }, [data.decisions, data.journeys, localDayKey]);
  const editingCandidate = candidateEditor
    ? data.presets.find((preset) => preset.id === candidateEditor.presetId)?.items.find((entry) => entry.id === candidateEditor.candidateId)
    : undefined;
  const wheelLabels = useMemo(() => {
    if (activePreset?.journey) return journeyWheelLabels;
    return visibleWheelItems.map((entry) => {
      const shortLabel = activePreset?.id === "workout" ? entry.label.replace(/^3分\s*/u, "") : entry.label;
      return shortLabel.length > 9 ? `${shortLabel.slice(0, 8)}…` : shortLabel;
    });
  }, [activePreset, visibleWheelItems]);
  const centerResult = result?.label.replace(/^\d+分\s*/u, "");
  const workoutDetails: Record<string, string> = {
    "3分 スクワット": "下半身を鍛える", "3分 腕立て伏せ": "胸と腕を鍛える", "3分 腹筋": "お腹を鍛える",
    "3分 プランク": "体幹を鍛える", "3分 ランジ": "脚とバランスを鍛える", "3分 背筋": "背中を鍛える",
  };
  const speak = useCallback((text: string) => {
    if (!data.speech || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "ja-JP";
    const japanese = window.speechSynthesis.getVoices().find((voice) => voice.lang.startsWith("ja"));
    if (japanese) utterance.voice = japanese;
    window.speechSynthesis.speak(utterance);
  }, [data.speech]);

  const requestTimerWakeLock = useCallback(async () => {
    if (document.visibilityState !== "visible") return;
    const navigatorWithWakeLock = navigator as NavigatorWithWakeLock;
    if (!navigatorWithWakeLock.wakeLock || wakeLock.current?.released === false) return;
    try {
      wakeLock.current = await navigatorWithWakeLock.wakeLock.request("screen");
    } catch {
      setNotice("画面が消える場合があります。タイマー中は画面を開いたままにしてください。");
    }
  }, []);

  useEffect(() => {
    let savedData: AppData | null = null;
    let loadFailed = false;
    let canPersist = true;
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed: unknown = JSON.parse(saved);
        if (safeData(parsed)) {
          savedData = ensureDefaultPresets(parsed);
        } else {
          loadFailed = true;
          canPersist = false;
        }
      }
    } catch {
      loadFailed = true;
      canPersist = false;
    }
    queueMicrotask(() => {
      if (savedData) setData(savedData);
      if (loadFailed) setNotice("保存データを読み込めませんでした。元のデータは上書きせず保護しています。バックアップを読み込むか、初期状態へ戻してください。");
      setPersistenceEnabled(canPersist);
      setHydrated(true);
    });
    const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register(`${basePath}/sw.js`).catch(() => undefined);
    } else if ("serviceWorker" in navigator) {
      navigator.serviceWorker.getRegistrations().then((registrations) => Promise.all(registrations.map((registration) => registration.unregister()))).catch(() => undefined);
      if ("caches" in window) caches.keys().then((keys) => Promise.all(keys.filter((key) => key.startsWith("whats-next-")).map((key) => caches.delete(key)))).catch(() => undefined);
    }
    const captureInstall = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", captureInstall);
    return () => window.removeEventListener("beforeinstallprompt", captureInstall);
  }, []);

  useEffect(() => {
    if (!hydrated || !persistenceEnabled) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      queueMicrotask(() => setNotice("保存できませんでした。端末の空き容量を確認してください。"));
    }
  }, [data, hydrated, persistenceEnabled]);

  useEffect(() => () => {
    if (reelInterval.current) window.clearInterval(reelInterval.current);
    if (reelTimeout.current) window.clearTimeout(reelTimeout.current);
    if (spinTimeout.current) window.clearTimeout(spinTimeout.current);
  }, []);

  useEffect(() => {
    if (!spinTimeout.current) return;
    window.clearTimeout(spinTimeout.current);
    spinTimeout.current = null;
    queueMicrotask(() => setSpinning(false));
  }, [activeId, view]);

  useEffect(() => {
    const now = new Date();
    const nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime();
    const id = window.setTimeout(() => setLocalDayKey(startOfLocalDay(Date.now())), nextMidnight - now.getTime() + 250);
    return () => window.clearTimeout(id);
  }, [localDayKey]);

  useEffect(() => {
    if (view !== "presets") return;
    const frame = window.requestAnimationFrame(() => {
      presetTabsRef.current?.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]')?.scrollIntoView({ block: "nearest", inline: "nearest" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [manageId, view]);

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
        setNotice("時間になりました。ゆっくり次の行動へ移ろう。");
        setView("home");
      }
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [timer]);

  useEffect(() => {
    if (!timer) return;
    const restoreWakeLock = () => {
      if (document.visibilityState === "visible") void requestTimerWakeLock();
    };
    document.addEventListener("visibilitychange", restoreWakeLock);
    return () => document.removeEventListener("visibilitychange", restoreWakeLock);
  }, [timer, requestTimerWakeLock]);

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
    const rotateToSegment = (segment: number) => setRotation((current) => {
      const currentAngle = ((current % 360) + 360) % 360;
      const targetAngle = (390 - segment * 60) % 360;
      const alignment = (targetAngle - currentAngle + 360) % 360;
      return current + 720 + alignment;
    });
    if (activePreset.journey) {
      setSpinning(true);
      setResult(null);
      const chosen = randomFrom(cardinals);
      const segment = journeyDirectionSegments[chosen];
      rotateToSegment(segment);
      spinTimeout.current = window.setTimeout(() => {
        setResult({ label: chosen });
        setSpinning(false);
        spinTimeout.current = null;
        speak(chosen);
      }, window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 80 : 850);
      return;
    }
    if (activePreset.id === "free") {
      const freeItems = activePreset.items.slice(0, 6);
      const enabledSegments = freeItems.map((entry, index) => entry.enabled ? index : -1).filter((index) => index >= 0);
      if (!enabledSegments.length) {
        setNotice("まずは6つの枠から、1つ以上の内容を入力してオンにしよう。");
        return;
      }
      const segment = randomFrom(enabledSegments);
      const chosen = freeItems[segment];
      setSpinning(true);
      setResult(null);
      setWheelSet({ presetId: activePreset.id, items: freeItems });
      rotateToSegment(segment);
      spinTimeout.current = window.setTimeout(() => {
        setResult({ label: chosen.label });
        setSpinning(false);
        spinTimeout.current = null;
        speak(chosen.label);
      }, window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 80 : 850);
      return;
    }
    if (!enabledItems.length) {
      setNotice("回せる候補がありません。候補を1つ以上オンにしてみよう。");
      return;
    }
    setSpinning(true);
    setResult(null);
    const nextWheelItems = makeWheelItems(enabledItems);
    const segment = Math.floor(Math.random() * 6);
    const chosen = nextWheelItems[segment];
    setWheelSet({ presetId: activePreset.id, items: nextWheelItems });
    rotateToSegment(segment);
    const workMinutes = activePreset.id === "work" ? Number(chosen.label.match(/^(1|3|5|10|15)分/)?.[1] ?? 0) : chosen.minutes;
    spinTimeout.current = window.setTimeout(() => {
      setResult({ label: chosen.label, minutes: workMinutes || undefined });
      setSpinning(false);
      spinTimeout.current = null;
      speak(chosen.label);
    }, window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 80 : 850);
  }

  function acceptResult() {
    if (!result || !activePreset) return;
    setData((current) => ({ ...current, decisions: [{ id: uid(), preset: activePreset.name, label: result.label, at: Date.now() }, ...current.decisions].slice(0, 1000) }));
    setNotice("今日の決定に追加しました。");
  }

  function reuseDecision(decision: Decision) {
    const preset = data.presets.find((entry) => !entry.journey && entry.name === decision.preset && entry.items.some((candidate) => candidate.label === decision.label));
    const candidate = preset?.items.find((entry) => entry.label === decision.label);
    if (!preset || !candidate) {
      setNotice("この候補は現在のプリセットに見つかりませんでした。");
      return;
    }
    setActiveId(preset.id);
    setResult({ label: candidate.label, minutes: candidate.minutes });
    setView("home");
  }

  async function startTimer() {
    if (!result?.minutes) return;
    const duration = result.minutes * 60;
    setRemaining(duration);
    setTimer({ label: result.label, duration, endAt: Date.now() + duration * 1000 });
    setView("timer");
    try {
      audioContext.current ??= new AudioContext();
      void audioContext.current.resume().catch(() => undefined);
    } catch { /* timer still works visually */ }
    await requestTimerWakeLock();
  }

  function makeJourneyStep(previous?: JourneyStep, missionOnly = false): JourneyStep {
    return {
      id: uid(),
      direction: missionOnly && previous ? previous.direction : randomFrom(directions),
      route: missionOnly && previous ? previous.route : randomFrom(routeStyles),
      theme: missionOnly && previous ? previous.theme : randomFrom(journeyThemes),
      mission: randomFrom(missions),
      status: "active",
      at: Date.now(),
    };
  }

  function animateJourneyStep(step: JourneyStep) {
    if (reelInterval.current) window.clearInterval(reelInterval.current);
    if (reelTimeout.current) window.clearTimeout(reelTimeout.current);
    setJourneySpinning(true);
    reelInterval.current = window.setInterval(() => setReelDisplay({
      direction: randomFrom(directions), route: randomFrom(routeStyles), theme: randomFrom(journeyThemes), mission: randomFrom(missions),
    }), 90);
    const delay = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 80 : 1250;
    reelTimeout.current = window.setTimeout(() => {
      if (reelInterval.current) window.clearInterval(reelInterval.current);
      setReelDisplay({ direction: step.direction, route: step.route ?? routeStyles[0], theme: step.theme ?? journeyThemes[0], mission: step.mission });
      setJourneySpinning(false);
      speak(`${step.direction}。${step.route ?? ""}。${step.theme ?? ""}。${step.mission}`);
    }, delay);
  }

  function openJourney() {
    setView("journey");
  }

  function startJourney() {
    const initialDirection = result && cardinals.includes(result.label) ? result.label : randomFrom(cardinals);
    const firstStep = makeJourneyStep();
    setData((current) => ({ ...current, activeJourney: { startedAt: Date.now(), duration: journeyDuration, initialDirection, steps: [firstStep], turnaroundShown: false } }));
    animateJourneyStep(firstStep);
  }

  function drawJourneyStep(status: "done" | "skipped", missionOnly = false) {
    const previous = data.activeJourney?.steps.at(-1);
    if (!previous) return;
    if ((data.activeJourney?.steps.length ?? 0) >= MAX_JOURNEY_STEPS) {
      setNotice("旅の記録が上限に達しました。現在の旅を終了して、新しい旅を始めてください。");
      return;
    }
    const nextStep = makeJourneyStep(previous, missionOnly);
    setData((current) => {
      if (!current.activeJourney) return current;
      if (current.activeJourney.steps.length >= MAX_JOURNEY_STEPS) return current;
      const steps = [...current.activeJourney.steps];
      const last = steps[steps.length - 1];
      if (last?.status === "active") steps[steps.length - 1] = { ...last, status };
      steps.push(nextStep);
      return { ...current, activeJourney: { ...current.activeJourney, steps } };
    });
    queueMicrotask(() => animateJourneyStep(nextStep));
  }

  function finishJourney() {
    if (reelInterval.current) window.clearInterval(reelInterval.current);
    if (reelTimeout.current) window.clearTimeout(reelTimeout.current);
    setJourneySpinning(false);
    setData((current) => {
      if (!current.activeJourney) return current;
      const steps = current.activeJourney.steps.map((step) => step.status === "active" ? { ...step, status: "skipped" as const } : step);
      const log: JourneyLog = { id: uid(), endedAt: Date.now(), ...current.activeJourney, steps };
      return { ...current, activeJourney: null, journeys: [log, ...current.journeys].slice(0, 100) };
    });
    setNotice("今日の冒険を保存しました。");
    setView("history");
  }

  function updatePreset(id: string, updater: (preset: Preset) => Preset) {
    setData((current) => ({ ...current, presets: current.presets.map((preset) => preset.id === id ? updater(preset) : preset) }));
    setWheelSet((current) => current?.presetId === id ? null : current);
    if (activeId === id) setResult(null);
  }

  function addCandidate() {
    const label = newItem.trim();
    if (!label || !managedPreset || managedPreset.journey) return;
    if (managedPreset.id === "free") {
      setNotice("フリーモードは6つの固定枠を鉛筆ボタンから編集できます。");
      return;
    }
    if (managedPreset.items.length >= MAX_CANDIDATES) {
      setNotice(`候補は1つのプリセットにつき${MAX_CANDIDATES}件までです。`);
      return;
    }
    const timedPreset = ["work", "recovery", "workout"].includes(managedPreset.id);
    const minutes = managedPreset.id === "workout" ? Number(label.match(/^3分/) ? 3 : 0) : timedPreset ? Number(label.match(/^(1|3|5|10|15)分/)?.[1] ?? 0) : undefined;
    if (timedPreset && !minutes) {
      setNotice(managedPreset.id === "workout" ? "筋トレの候補は「3分」から始めてください。" : `${managedPreset.name}の候補は「1分・3分・5分・10分・15分」のどれかから始めてください。`);
      return;
    }
    updatePreset(managedPreset.id, (preset) => ({ ...preset, items: [...preset.items, item(label, minutes)] }));
    setNewItem("");
  }

  function closeCandidateEditor() {
    const returnTarget = candidateReturnFocus.current;
    setCandidateEditor(null);
    window.requestAnimationFrame(() => {
      if (returnTarget?.isConnected) returnTarget.focus();
      else document.querySelector<HTMLElement>(".candidate-add-row input, .create-preset-toggle")?.focus();
    });
  }

  function handleCandidateDialogKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      closeCandidateEditor();
      return;
    }
    if (event.key !== "Tab") return;
    const focusable = [...(candidateDialogRef.current?.querySelectorAll<HTMLElement>("input:not([disabled]), button:not([disabled])") ?? [])];
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function editCandidate(candidate: Candidate) {
    if (!managedPreset) return;
    candidateReturnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setCandidateEditor({ presetId: managedPreset.id, candidateId: candidate.id, draft: managedPreset.id === "free" && candidate.label === "＋ 自由に入力" ? "" : candidate.label });
  }

  function saveCandidateEdit() {
    if (!candidateEditor) return;
    const preset = data.presets.find((entry) => entry.id === candidateEditor.presetId);
    const next = candidateEditor.draft.trim();
    if (!preset || !next) {
      setNotice("候補の内容を入力してください。");
      return;
    }
    const timedPreset = ["work", "recovery", "workout"].includes(preset.id);
    const minutes = preset.id === "workout" ? Number(next.match(/^3分/) ? 3 : 0) : timedPreset ? Number(next.match(/^(1|3|5|10|15)分/)?.[1] ?? 0) : preset.items.find((entry) => entry.id === candidateEditor.candidateId)?.minutes;
    if (timedPreset && !minutes) {
      setNotice(preset.id === "workout" ? "筋トレの候補は「3分」から始めてください。" : `${preset.name}の候補は「1分・3分・5分・10分・15分」のどれかから始めてください。`);
      return;
    }
    updatePreset(preset.id, (current) => ({ ...current, items: current.items.map((entry) => entry.id === candidateEditor.candidateId ? { ...entry, label: next, minutes: minutes || undefined, enabled: preset.id === "free" ? true : entry.enabled } : entry) }));
    closeCandidateEditor();
    setNotice("候補を更新しました。");
  }

  function deleteCandidateFromEditor() {
    if (!candidateEditor) return;
    const preset = data.presets.find((entry) => entry.id === candidateEditor.presetId);
    const candidate = preset?.items.find((entry) => entry.id === candidateEditor.candidateId);
    if (!preset || !candidate) return;
    if (preset.id === "free") {
      updatePreset(preset.id, (current) => ({ ...current, items: current.items.map((entry) => entry.id === candidate.id ? { ...entry, label: "＋ 自由に入力", enabled: false, minutes: undefined } : entry) }));
      closeCandidateEditor();
      setNotice("フリー枠を空に戻しました。");
      return;
    }
    if (!window.confirm(`「${candidate.label}」を削除しますか？`)) return;
    updatePreset(preset.id, (current) => ({ ...current, items: current.items.filter((entry) => entry.id !== candidate.id) }));
    closeCandidateEditor();
    setNotice("候補を削除しました。");
  }

  function goHome() {
    if (view === "timer" && timer) {
      if (!window.confirm("タイマーを終了してホームへ戻りますか？")) return;
      setTimer(null);
      wakeLock.current?.release().catch(() => undefined);
      wakeLock.current = null;
    }
    if (view === "journey" && journeySpinning) {
      if (reelInterval.current) window.clearInterval(reelInterval.current);
      if (reelTimeout.current) window.clearTimeout(reelTimeout.current);
      setJourneySpinning(false);
    }
    setView("home");
  }

  function openSettings() {
    if (view === "timer" && timer) {
      if (!window.confirm("タイマーを終了して設定を開きますか？")) return;
      setTimer(null);
      wakeLock.current?.release().catch(() => undefined);
      wakeLock.current = null;
    }
    if (view === "journey" && journeySpinning) {
      if (reelInterval.current) window.clearInterval(reelInterval.current);
      if (reelTimeout.current) window.clearTimeout(reelTimeout.current);
      setJourneySpinning(false);
    }
    setView("settings");
  }

  function createPreset() {
    const name = newPreset.trim();
    if (!name) return;
    if (data.presets.length >= MAX_PRESETS) {
      setNotice(`プリセットは${MAX_PRESETS}件まで作成できます。`);
      return;
    }
    const preset: Preset = { id: uid(), name, icon: "✺", tone: "sky", description: "あなたが作ったオリジナルプリセット", custom: true, items: [] };
    setData((current) => ({ ...current, presets: [...current.presets, preset] }));
    setManageId(preset.id);
    setActiveId(preset.id);
    setNewPreset("");
    setCreatingPreset(false);
    setCustomPickerOpen(true);
  }

  function deleteCustomPreset(preset: Preset) {
    if (!preset.custom || !window.confirm(`「${preset.name}」を削除しますか？`)) return;
    setData((current) => ({ ...current, presets: current.presets.filter((entry) => entry.id !== preset.id) }));
    const fallback = data.presets.find((entry) => !entry.journey && entry.id !== preset.id) ?? data.presets[0];
    setManageId(fallback.id);
    if (activeId === preset.id) setActiveId(fallback.id);
    setResult(null);
    setWheelSet(null);
    setNewItem("");
    setCustomPickerOpen(false);
    setCandidateEditor(null);
    setNotice("自作プリセットを削除しました。");
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
        const migrated = ensureDefaultPresets(parsed);
        setData(migrated);
        setActiveId(migrated.presets[0]?.id ?? "work");
        setManageId(migrated.presets.find((preset) => !preset.journey)?.id ?? "work");
        setResult(null);
        setWheelSet(null);
        setNewItem("");
        setNewPreset("");
        setCandidateEditor(null);
        setCreatingPreset(false);
        setCustomPickerOpen(false);
        setPersistenceEnabled(true);
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
    setPersistenceEnabled(true);
    setData(fresh);
    setActiveId("work");
    setManageId("work");
    setResult(null);
    setWheelSet(null);
    setNewItem("");
    setNewPreset("");
    setCandidateEditor(null);
    setCreatingPreset(false);
    setCustomPickerOpen(false);
    setTimer(null);
    wakeLock.current?.release().catch(() => undefined);
    wakeLock.current = null;
    if (reelInterval.current) window.clearInterval(reelInterval.current);
    if (reelTimeout.current) window.clearTimeout(reelTimeout.current);
    setJourneySpinning(false);
    setNotice("初期状態に戻しました。");
    setView("home");
  }

  const currentJourneyStep = data.activeJourney?.steps.at(-1);
  const settledReels: ReelDisplay = currentJourneyStep ? {
    direction: currentJourneyStep.direction,
    route: currentJourneyStep.route ?? "自由な道",
    theme: currentJourneyStep.theme ?? "直感にまかせる",
    mission: currentJourneyStep.mission,
  } : reelDisplay;
  const visibleReels = journeySpinning ? reelDisplay : settledReels;
  const journeyReels = [
    { key: "direction", label: "方角", value: visibleReels.direction, tone: "mint" },
    { key: "route", label: "道", value: visibleReels.route, tone: "lemon" },
    { key: "theme", label: "テーマ", value: visibleReels.theme, tone: "violet" },
    { key: "mission", label: "ミッション", value: visibleReels.mission, tone: "coral" },
  ] as const;
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
          <button className="icon-button" onClick={openSettings} aria-label="設定を開く">⚙</button>
        </header>

        {notice && <button className="notice" onClick={() => setNotice("")} aria-live="polite">{notice}<span>×</span></button>}

        {view === "home" && activePreset && (
          <div className="view home-view">
            <section className="mode-question" aria-labelledby="mode-question-title">
              <svg className="prompt-avatar" viewBox="0 0 88 82" aria-hidden="true">
                <path d="M10 72c1-17 11-27 27-29 17 2 26 12 27 29" />
                <circle cx="37" cy="29" r="23" />
                <circle className="avatar-eye" cx="29" cy="26" r="2" /><circle className="avatar-eye" cx="45" cy="26" r="2" />
                <path d="M29 35c5 5 11 5 16 0M62 43l13 8-2-15" />
                <text x="67" y="21">?</text>
              </svg>
              <div><h1 id="mode-question-title">いま、どんな時間にする？</h1><p><span>●</span> {homePresets.length}つのモードから選ぶ <span>●</span></p></div>
            </section>
            <div className="preset-grid" aria-label="プリセットを選ぶ">
              {homePresets.map((preset) => (
                <button key={preset.id} className={`preset-card ${preset.tone} ${preset.id === "free" ? "free-card" : ""} ${activeId === preset.id ? "selected" : ""}`} aria-pressed={activeId === preset.id} disabled={spinning} onClick={() => { setActiveId(preset.id); setResult(null); }}>
                  {activeId === preset.id && <span className="preset-check" aria-hidden="true">✓</span>}
                  <span className="preset-icon"><PresetGlyph id={preset.id} /></span><span className="preset-copy"><b>{preset.name}</b>{preset.id === "free" && <small>6つの枠を自由に決める</small>}</span><span className="preset-arrow" aria-hidden="true">›</span>
                </button>
              ))}
            </div>

            <section className={`wheel-stage ${activePreset.tone}`}>
              <div className="wheel-pointer">▼</div>
              <button className={`wheel wheel-${activePreset.id} ${spinning ? "is-spinning" : ""}`} style={{ "--rotation": `${rotation}deg` } as React.CSSProperties} onClick={spin} disabled={spinning} aria-label={activePreset.journey ? "旅の出発方角を決める" : "ルーレットを回す"}>
                {wheelLabels.map((label, index) => {
                  const entry = visibleWheelItems[index];
                  const empty = activePreset.id === "free" && !entry?.enabled;
                  const minutes = activePreset.journey || empty ? undefined : (entry?.minutes ?? (Number(entry?.label.match(/^(1|3|5|10|15)分/u)?.[1] ?? 0) || undefined));
                  return <span className={`wheel-label label-${index} ${empty ? "empty-wheel-label" : ""}`} key={`${label}-${index}`}><WheelGlyph presetId={activePreset.id} index={index} label={entry?.label ?? label} empty={empty} /><strong>{label}</strong>{minutes && <i>{minutes}分</i>}</span>;
                })}
                <span className="wheel-center"><small>{activePreset.id === "workout" ? "3分\nトレーニング" : activePreset.id === "free" ? "フリー" : activePreset.journey ? "" : activePreset.name}</small><b>{spinning ? "選んでいます…" : centerResult ?? (activePreset.journey ? "旅へ\n出よう" : activePreset.id === "workout" ? "何を鍛える？" : "何をする？")}</b></span>
              </button>
              <p className="preset-description">{activePreset.id === "free" ? "6つすべて、好きな内容に変更できます" : activePreset.description}</p>
            </section>

            <div className="home-action-stack">
              <button className="primary-button spin-button" onClick={spin} disabled={spinning}><ActionGlyph kind="spin" />{activePreset.journey ? (spinning ? "方角を選んでいます…" : "旅のルーレットを回す") : activePreset.id === "workout" ? (spinning ? "選んでいます…" : "筋トレを決める") : activePreset.id === "free" ? (spinning ? "選んでいます…" : "フリールーレットを回す") : spinning ? "選んでいます…" : "ルーレットを回す"}</button>
              {activePreset.journey && <button className="mode-secondary-action journey-open-button" disabled={spinning} onClick={openJourney}><ActionGlyph kind="map" />旅モードを開く</button>}
              {activePreset.id === "free" && <button className="mode-secondary-action free-edit-button" disabled={spinning} onClick={() => { setManageId("free"); setCustomPickerOpen(false); setView("presets"); }}><ActionGlyph kind="edit" />6つの内容を編集</button>}
            </div>
            {result && !spinning && (
              activePreset.id === "workout" ? <section className="workout-result-card" aria-live="polite">
                <span className="workout-result-icon"><WheelGlyph presetId="workout" index={Math.max(0, visibleWheelItems.findIndex((entry) => entry.label === result.label))} label={result.label} /></span>
                <span className="workout-result-copy"><b>{centerResult}・3分</b><small>{workoutDetails[result.label] ?? "全身を気持ちよく動かす"}</small></span>
                <button onClick={() => { acceptResult(); void startTimer(); }}><span aria-hidden="true">▶</span>スタート</button>
              </section> : <section className="result-card" aria-live="polite">
                <div><span className="result-kicker">TODAY&apos;S PICK</span><h2>{result.label}</h2></div>
                <div className="result-actions">
                  {activePreset.journey ? <button onClick={openJourney}>この方角で旅へ</button> : <button onClick={acceptResult}>これに決定</button>}<button onClick={spin}>もう一度</button>
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
            <button className="secondary-button" onClick={() => { setTimer(null); wakeLock.current?.release?.().catch(() => undefined); wakeLock.current = null; setView("home"); }}>タイマーを終了</button>
          </div>
        )}

        {view === "journey" && (
          <div className="view journey-view">
            <p className="eyebrow">BICYCLE ADVENTURE</p><h1>風まかせの旅。</h1>
            {!data.activeJourney ? (
              <>
                <div className="safety-card"><b>安全に楽しむために</b><p>操作と画面の確認は、必ず安全な場所に停車してから。交通ルールと道路状況を最優先にしてください。</p><small>GPSや位置情報は使用しません。</small></div>
                <fieldset className="duration-picker"><legend>予定時間を選ぶ</legend>{[30, 60, 90, null].map((duration) => <button type="button" key={duration ?? "free"} className={journeyDuration === duration ? "active" : ""} aria-pressed={journeyDuration === duration} onClick={() => setJourneyDuration(duration)}>{duration ? `${duration}分` : "時間無制限"}</button>)}</fieldset>
                <button className="primary-button" onClick={startJourney}>4つの旅リールを回す <span>↗</span></button>
              </>
            ) : (
              <>
                <div className="journey-status"><span>出発</span><b>{data.activeJourney.initialDirection}</b><small>{data.activeJourney.steps.length}回目</small></div>
                {data.activeJourney.turnaroundShown && <div className="turnaround">そろそろ折り返し。安全な帰り道を選ぼう。</div>}
                <section className={`reel-machine ${journeySpinning ? "is-spinning" : ""}`} aria-label="旅の4連ルーレット" aria-busy={journeySpinning}>
                  <div className="reel-machine-header"><span>TRIP SLOT 04</span><b>{journeySpinning ? "ぐるぐる選択中…" : "次の冒険が決まりました"}</b></div>
                  <div className="reel-grid" aria-live="polite">
                    {journeyReels.map((reel, index) => <article className={`journey-reel ${reel.tone} reel-${index}`} key={reel.key}><span>{reel.label}</span><div className="reel-window"><div className="reel-strip"><i>{reel.value}</i><b>{reel.value}</b><i>{reel.value}</i></div></div></article>)}
                  </div>
                </section>
                {currentJourneyStep && !journeySpinning && <div className="mission-outcome"><span>NEXT MISSION</span><h2>{currentJourneyStep.mission}</h2><p>{currentJourneyStep.direction} · {currentJourneyStep.route ?? "自由な道"} · {currentJourneyStep.theme ?? "直感にまかせる"}</p></div>}
                <div className="journey-actions"><button className="primary-button" disabled={journeySpinning} onClick={() => drawJourneyStep("done")}>できた！ 次を回す <span>↗</span></button><button disabled={journeySpinning} onClick={() => drawJourneyStep("skipped")}>スキップして次を回す</button><button disabled={journeySpinning} onClick={() => drawJourneyStep("skipped", true)}>ミッションだけ回し直す</button></div>
                <button className="text-button danger-text" disabled={journeySpinning} onClick={finishJourney}>旅を終える</button>
                <p className="safety-note">必ず停車して操作してください。危険・通行禁止の指示は迷わず引き直しましょう。</p>
              </>
            )}
          </div>
        )}

        {view === "history" && (
          <div className="view list-view history-view">
            <p className="eyebrow">YOUR STORY</p><h1>これまでの選択。</h1>
            <section className="history-stats" aria-labelledby="monthly-stats-title"><h2 id="monthly-stats-title" className="visually-hidden">今月の記録</h2><article className="coral"><span className="stat-icon" aria-hidden="true">▦</span><div><small>今月</small><b>{monthlyStats.decisions}<i>回</i></b></div></article><article className="mint"><span className="stat-icon" aria-hidden="true">♧</span><div><small>旅</small><b>{monthlyStats.journeys}<i>回</i></b></div></article></section>
            {historyFeed.length === 0 ? <div className="empty-state history-empty">まだ履歴はありません。<small>「これに決定」を押すと、ここに残ります。</small></div> : groupedHistory.map(([group, entries]) => (
              <section className="history-group" key={group}><h2>{group}</h2><div className="history-timeline">
                {entries.map((entry) => entry.kind === "decision" ? (() => {
                  const preset = data.presets.find((item) => item.name === entry.decision.preset);
                  const date = new Date(entry.at);
                  const datePrefix = group === "それ以前" ? `${date.toLocaleDateString("ja-JP", { month: "numeric", day: "numeric" })} · ` : "";
                  const time = date.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" });
                  return <button className="history-card" key={entry.id} onClick={() => reuseDecision(entry.decision)} aria-label={`${entry.decision.preset}、${entry.decision.label}、${datePrefix}${time}をもう一度使う`}><span className={`history-mode-icon ${preset?.tone ?? "violet"}`}><PresetGlyph id={preset?.id ?? "custom"} /></span><span className="history-card-copy"><b>{entry.decision.label}</b><small><em>{entry.decision.preset}</em> · {datePrefix}{time}</small></span><span className="history-chevron" aria-hidden="true">›</span></button>;
                })() : <article className="journey-history-card" key={entry.id}><div className="journey-illustration" aria-hidden="true"><PresetGlyph id="bicycle" /><span>⚑</span></div><div className="journey-history-copy"><small>{new Date(entry.journey.startedAt).toLocaleDateString("ja-JP", { month: "numeric", day: "numeric" })}</small><h3>自転車の旅</h3><b>{entry.journey.initialDirection}</b><p>{entry.journey.steps.filter((step) => step.status === "done").length}ミッション達成</p></div><details><summary>旅の履歴を見る <span>›</span></summary><div>{entry.journey.steps.map((step) => <p key={step.id}>→ {step.direction}<br /><small>{step.mission} · {step.status === "done" ? "できた！" : step.status === "skipped" ? "スキップ" : "未完了"}</small></p>)}</div></details></article>)}
              </div></section>
            ))}
          </div>
        )}

        {view === "presets" && managedPreset && (
          <div className="view manage-view">
            <p className="eyebrow">MAKE IT YOURS</p><h1>じぶん用に整える。</h1>
            <div ref={presetTabsRef} className="preset-mode-tabs" role="tablist" aria-label="編集するプリセット">
              {editablePresets.filter((preset) => !preset.custom && ["work", "play", "solo", "recovery", "workout", "free"].includes(preset.id)).map((preset) => <button key={preset.id} role="tab" aria-selected={manageId === preset.id} className={manageId === preset.id ? "active" : ""} onClick={() => { setManageId(preset.id); setCustomPickerOpen(false); }}><PresetGlyph id={preset.id} /><span>{preset.id === "solo" ? "一人" : preset.id === "free" ? "フリー" : preset.name}</span></button>)}
              <button role="tab" aria-selected={Boolean(managedPreset.custom)} className={managedPreset.custom ? "active custom-tab" : "custom-tab"} onClick={() => { setCustomPickerOpen(true); if (customPresets[0]) setManageId(customPresets[0].id); else setCreatingPreset(true); }}><PresetGlyph id="custom" /><span>自作</span></button>
            </div>

            {customPickerOpen && <section className="custom-preset-picker" aria-label="自作プリセット一覧">
              <div className="custom-picker-heading"><b>自作プリセット</b><small>{customPresets.length}件</small></div>
              {customPresets.length ? <div>{customPresets.map((preset) => <button key={preset.id} className={manageId === preset.id ? "active" : ""} onClick={() => setManageId(preset.id)}>{preset.name}<span>→</span></button>)}</div> : <p>まだ自作プリセットがありません。下のボタンから最初のひとつを作れます。</p>}
            </section>}

            <section className={`preset-summary-card ${managedPreset.tone}`}>
              <span className="summary-glyph"><PresetGlyph id={managedPreset.id} /></span>
              <div><small>SELECTED PRESET</small><h2>{managedPreset.name}</h2><p>{managedPreset.description}</p><b>{managedPreset.items.filter((entry) => entry.enabled).length}個の候補が有効</b></div>
              <button onClick={() => { setActiveId(managedPreset.id); setResult(null); setView("home"); }}>このプリセットを使う <span>→</span></button>
            </section>

            <section className="candidate-editor"><div className="preset-candidate-header"><h2>{managedPreset.id === "free" ? "6つの内容" : `${managedPreset.name}の候補`}</h2><span>{managedPreset.items.filter((entry) => entry.enabled).length}/{managedPreset.items.length}</span></div>
              {managedPreset.id === "free" ? <p className="free-editor-note">鉛筆ボタンから6つすべてを自由に変更できます。空に戻した枠は抽選されません。</p> : <div className="candidate-add-row"><input value={newItem} onChange={(event) => setNewItem(event.target.value)} onKeyDown={(event) => event.key === "Enter" && addCandidate()} placeholder={managedPreset.id === "workout" ? "例：3分 バーピー" : managedPreset.id === "work" || managedPreset.id === "recovery" ? "例：5分 ストレッチする" : "新しい候補を入力"} maxLength={80} aria-label={`${managedPreset.name}へ追加する候補`} /><button onClick={addCandidate} disabled={managedPreset.items.length >= MAX_CANDIDATES}>追加</button></div>}
              <div className="candidate-list">{managedPreset.items.map((entry) => {
                const displayLabel = entry.minutes ? entry.label.replace(/^(1|3|5|10|15)分\s*/u, "") : entry.label;
                return <article className={`candidate-row ${entry.enabled ? "" : "disabled"}`} key={entry.id}><label className="switch"><input type="checkbox" checked={entry.enabled} aria-label={`${entry.label}を${entry.enabled ? "抽選対象から外す" : "抽選対象にする"}`} onChange={(event) => { if (managedPreset.id === "free" && entry.label === "＋ 自由に入力" && event.target.checked) { editCandidate(entry); return; } updatePreset(managedPreset.id, (preset) => ({ ...preset, items: preset.items.map((candidate) => candidate.id === entry.id ? { ...candidate, enabled: event.target.checked } : candidate) })); }} /><span /></label><div className="candidate-copy"><b>{displayLabel}</b>{entry.minutes && <span className="duration-pill">{entry.minutes}分</span>}</div><button className="candidate-edit-button" onClick={() => editCandidate(entry)} aria-label={`${entry.label}を編集`}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 16-1 4 4-1L19 8l-3-3L5 16Zm9-9 3 3" /></svg></button></article>;
              })}</div>
              {!managedPreset.items.length && <div className="empty-state">候補がまだありません。<small>上の入力欄から追加してみましょう。</small></div>}
              {managedPreset.custom && <button className="text-button danger-text delete-preset-button" onClick={() => deleteCustomPreset(managedPreset)}>このプリセットを削除</button>}
            </section>
            <button className="create-preset-toggle" onClick={() => setCreatingPreset((current) => !current)}>＋ 新しいプリセットを作る</button>
            {creatingPreset && <section className="preset-create-panel"><label htmlFor="new-preset-name">プリセット名</label><div><input id="new-preset-name" value={newPreset} onChange={(event) => setNewPreset(event.target.value)} onKeyDown={(event) => event.key === "Enter" && createPreset()} placeholder="例：雨の日" maxLength={30} autoFocus /><button onClick={createPreset} disabled={data.presets.length >= MAX_PRESETS}>作る</button></div><button className="text-button" onClick={() => setCreatingPreset(false)}>キャンセル</button></section>}
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

        {view !== "timer" && view !== "journey" && <nav className="bottom-nav" aria-label="メインメニュー"><button className={view === "home" ? "active" : ""} aria-current={view === "home" ? "page" : undefined} onClick={() => setView("home")}><span className="nav-wheel" aria-hidden="true">✺</span>ルーレット</button><button className={view === "history" ? "active" : ""} aria-current={view === "history" ? "page" : undefined} onClick={() => setView("history")}><span className="nav-clock" aria-hidden="true">◷</span>履歴</button><button className={view === "presets" ? "active" : ""} aria-current={view === "presets" ? "page" : undefined} onClick={() => setView("presets")}><span className="nav-star" aria-hidden="true">☆</span>プリセット</button></nav>}
        {(view === "timer" || view === "journey") && <button className="floating-back" onClick={goHome} aria-label="ホームへ戻る">←</button>}
        {candidateEditor && editingCandidate && <div className="editor-backdrop" onKeyDown={handleCandidateDialogKeyDown} onMouseDown={(event) => { if (event.currentTarget === event.target) closeCandidateEditor(); }}><section ref={candidateDialogRef} className="candidate-dialog" role="dialog" aria-modal="true" aria-labelledby="candidate-dialog-title"><p className="eyebrow">EDIT CANDIDATE</p><h2 id="candidate-dialog-title">候補を編集</h2><label htmlFor="candidate-edit-input">候補の内容</label><input id="candidate-edit-input" value={candidateEditor.draft} onChange={(event) => setCandidateEditor({ ...candidateEditor, draft: event.target.value })} onKeyDown={(event) => event.key === "Enter" && !event.nativeEvent.isComposing && saveCandidateEdit()} maxLength={80} autoFocus /><div className="dialog-actions"><button className="dialog-save" onClick={saveCandidateEdit}>保存</button><button onClick={closeCandidateEditor}>キャンセル</button></div><button className="dialog-delete" onClick={deleteCandidateFromEditor}>{candidateEditor.presetId === "free" ? "この枠を空に戻す" : "この候補を削除"}</button></section></div>}
      </section>
    </main>
  );
}
