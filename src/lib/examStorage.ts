import { getAmQuestion } from "./questions";
import type { AmQuestion, SessionMode, SourceFilter } from "./types";

const STORAGE_KEY = "ap-study:exam-progress:v1";

/** 中断した演習の進行状態。localStorage に保存する形 */
export interface SavedExam {
  v: 1;
  mode: SessionMode;
  sourceFilter: SourceFilter;
  questionIds: string[];
  answers: (number | null)[];
  /** 何問目まで解答(=解説表示)済みか */
  revealedCount: number;
  current: number;
  timeLimitMinutes: number | null;
  /** 残り秒数。タイマー無しの演習では null */
  remainingSec: number | null;
  /** 続きから解いても同じ ap_sessions 行に記録するための ID */
  sessionId: string | null;
  savedAt: string;
}

/** 保存データを問題本体まで解決したもの */
export interface RestoredExam extends SavedExam {
  questions: AmQuestion[];
}

const MODES: SessionMode[] = ["mock", "quick", "review", "pm"];
const SOURCE_FILTERS: SourceFilter[] = ["all", "past", "original"];
const MAX_QUESTIONS = 200;

function isIndex(v: unknown, maxExclusive: number): v is number {
  return typeof v === "number" && Number.isInteger(v) && v >= 0 && v < maxExclusive;
}

/**
 * localStorage の内容は書き換えられうるので、読み込み時に必ず検証する。
 * 少しでも壊れていれば復帰させず null を返す(壊れたデータで演習が始まる方が困る)。
 */
function parse(raw: string): RestoredExam | null {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof data !== "object" || data === null) return null;
  const d = data as Record<string, unknown>;

  if (d.v !== 1) return null;
  if (!MODES.includes(d.mode as SessionMode)) return null;
  if (!SOURCE_FILTERS.includes(d.sourceFilter as SourceFilter)) return null;

  const ids = d.questionIds;
  if (!Array.isArray(ids) || ids.length === 0 || ids.length > MAX_QUESTIONS) return null;
  if (!ids.every((id) => typeof id === "string")) return null;

  const questions: AmQuestion[] = [];
  for (const id of ids as string[]) {
    const q = getAmQuestion(id);
    // 問題データが差し替わって ID が消えている場合は復帰不能
    if (!q) return null;
    questions.push(q);
  }

  const answers = d.answers;
  if (!Array.isArray(answers) || answers.length !== questions.length) return null;
  const okAnswers = answers.every(
    (a, i) =>
      a === null ||
      (typeof a === "number" && Number.isInteger(a) && a >= 0 && a < questions[i].choices.length)
  );
  if (!okAnswers) return null;

  if (!isIndex(d.current, questions.length)) return null;
  if (!isIndex(d.revealedCount, questions.length + 1)) return null;

  const limit = d.timeLimitMinutes;
  if (limit !== null && !(typeof limit === "number" && limit > 0 && limit <= 600)) return null;

  const remaining = d.remainingSec;
  if (limit === null) {
    if (remaining !== null) return null;
  } else if (
    !(
      typeof remaining === "number" &&
      Number.isInteger(remaining) &&
      remaining >= 0 &&
      remaining <= (limit as number) * 60
    )
  ) {
    return null;
  }

  const sessionId = d.sessionId;
  if (sessionId !== null && !(typeof sessionId === "string" && sessionId.length <= 64)) {
    return null;
  }

  return {
    v: 1,
    mode: d.mode as SessionMode,
    sourceFilter: d.sourceFilter as SourceFilter,
    questionIds: ids as string[],
    answers: answers as (number | null)[],
    revealedCount: d.revealedCount as number,
    current: d.current as number,
    timeLimitMinutes: limit as number | null,
    remainingSec: remaining as number | null,
    sessionId: sessionId as string | null,
    savedAt: typeof d.savedAt === "string" ? d.savedAt : new Date().toISOString(),
    questions,
  };
}

function readRaw(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

const listeners = new Set<() => void>();

function notify() {
  for (const cb of listeners) cb();
}

export function saveExam(state: Omit<SavedExam, "v" | "savedAt">): void {
  if (typeof window === "undefined") return;
  const payload: SavedExam = { v: 1, ...state, savedAt: new Date().toISOString() };
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // プライベートモードや容量超過では保存できないが、演習自体は続行させる
  }
  notify();
}

export function loadExam(): RestoredExam | null {
  const raw = readRaw();
  return raw ? parse(raw) : null;
}

export function clearExam(): void {
  if (typeof window !== "undefined") {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // 消せなくても実害はない
    }
  }
  notify();
}

// --- useSyncExternalStore 用 ---
// getSnapshot は同じ内容なら同じ参照を返す必要があるので、生の文字列でキャッシュする
let cachedRaw: string | null = null;
let cachedValue: RestoredExam | null = null;

export function subscribeExam(onChange: () => void): () => void {
  listeners.add(onChange);
  // 別タブでの更新も拾う
  if (typeof window !== "undefined") window.addEventListener("storage", onChange);
  return () => {
    listeners.delete(onChange);
    if (typeof window !== "undefined") window.removeEventListener("storage", onChange);
  };
}

export function getExamSnapshot(): RestoredExam | null {
  const raw = readRaw();
  if (raw === cachedRaw) return cachedValue;
  cachedRaw = raw;
  cachedValue = raw ? parse(raw) : null;
  return cachedValue;
}

/** 静的HTML側には保存データが存在しないので必ず null */
export function getExamServerSnapshot(): RestoredExam | null {
  return null;
}

/** 「残り 12:34」用 */
export function formatRemaining(sec: number): string {
  const mm = Math.floor(sec / 60);
  const ss = sec % 60;
  return `${mm}:${String(ss).padStart(2, "0")}`;
}
