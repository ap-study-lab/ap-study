import { getSupabase } from "./supabase";
import {
  clearExam,
  loadExam,
  parseExamPayload,
  toPayload,
  writeExam,
} from "./examStorage";
import type { RestoredExam, SavedExam } from "./examStorage";

/**
 * 中断中の演習を端末間で同期する層。
 *
 * - 画面が読むのは常に localStorage(examStorage)。ここはその裏側でサーバーと突き合わせる
 * - 競合は savedAt が新しい方を採用する(サーバー側の ap_save_progress も同じ判定をする)
 * - オフラインでも演習は続行でき、復帰時にまとめて送る
 */

// 「どの保存時点までサーバーに送れたか」の記録。
// これがローカルの savedAt と一致しているのにサーバーが空なら、別端末で採点/破棄されたと判断できる
const SYNCED_KEY = "ap-study:exam-progress-synced:v1";
const PUSH_DEBOUNCE_MS = 5000;

function readSyncedMark(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(SYNCED_KEY);
  } catch {
    return null;
  }
}

function writeSyncedMark(savedAt: string | null): void {
  if (typeof window === "undefined") return;
  try {
    if (savedAt === null) window.localStorage.removeItem(SYNCED_KEY);
    else window.localStorage.setItem(SYNCED_KEY, savedAt);
  } catch {
    // 記録できなくても同期自体は動く(毎回送り直しになるだけ)
  }
}

/** 未ログインなら同期そのものを行わない(無駄な通信とエラーを出さない) */
async function hasSession(): Promise<boolean> {
  try {
    const { data } = await getSupabase().auth.getSession();
    return data.session !== null;
  } catch {
    return false;
  }
}

/** サーバーへ保存。成功したら true */
async function push(payload: SavedExam): Promise<boolean> {
  if (!(await hasSession())) return false;
  try {
    const { error } = await getSupabase().rpc("ap_save_progress", {
      p_payload: payload,
      p_saved_at: payload.savedAt,
    });
    if (error) {
      console.error("progress push failed:", error.message);
      return false;
    }
    writeSyncedMark(payload.savedAt);
    return true;
  } catch {
    // オフラインなど。次の保存かオンライン復帰時に送り直す
    return false;
  }
}

async function fetchRemote(): Promise<RestoredExam | null> {
  if (!(await hasSession())) return null;
  try {
    const { data, error } = await getSupabase()
      .from("ap_exam_progress")
      .select("payload")
      .maybeSingle();
    if (error) {
      console.error("progress fetch failed:", error.message);
      return null;
    }
    if (!data) return null;
    // サーバーから来た JSON もローカルと同じ検証を通す
    return parseExamPayload(data.payload);
  } catch {
    return null;
  }
}

export async function deleteRemoteProgress(): Promise<void> {
  writeSyncedMark(null);
  if (!(await hasSession())) return;
  try {
    const { data: userData } = await getSupabase().auth.getUser();
    if (!userData.user) return;
    const { error } = await getSupabase()
      .from("ap_exam_progress")
      .delete()
      .eq("user_id", userData.user.id);
    if (error) console.error("progress delete failed:", error.message);
  } catch {
    // 消せなかった場合、別端末には中断データが残る。
    // その端末で再開して採点すれば消えるので、ここでは何もしない
  }
}

/** ローカルの最新状態をサーバーへ送る(未送信なら) */
export async function flushProgress(): Promise<void> {
  const local = loadExam();
  if (!local) return;
  if (readSyncedMark() === local.savedAt) return;
  await push(toPayload(local));
}

let pushTimer: ReturnType<typeof setTimeout> | null = null;

/** 解答のたびに送ると通信が多すぎるので、少し待ってからまとめて送る */
export function scheduleProgressPush(): void {
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(() => {
    pushTimer = null;
    void flushProgress();
  }, PUSH_DEBOUNCE_MS);
}

/** 一時停止・中断など、確実に送っておきたい場面用 */
export async function flushProgressNow(): Promise<void> {
  if (pushTimer) {
    clearTimeout(pushTimer);
    pushTimer = null;
  }
  await flushProgress();
}

/**
 * 起動時の突き合わせ。新しい方を採用して localStorage に反映する。
 * 画面側は localStorage を購読しているので、取り込んだ時点で表示が切り替わる。
 */
export async function syncProgressOnLoad(): Promise<void> {
  if (!(await hasSession())) return;
  const local = loadExam();
  const remote = await fetchRemote();

  if (remote && (!local || remote.savedAt > local.savedAt)) {
    // 別端末で進めた分を取り込む
    writeExam(toPayload(remote));
    writeSyncedMark(remote.savedAt);
    return;
  }

  if (local && !remote) {
    if (readSyncedMark() === local.savedAt) {
      // 送信済みなのにサーバーに無い = 別端末で採点または破棄された
      clearExam();
      writeSyncedMark(null);
    } else {
      // まだ送れていないローカル分(オフラインで解いた等)を送る
      await push(toPayload(local));
    }
    return;
  }

  if (local && remote && local.savedAt > remote.savedAt) {
    await push(toPayload(local));
  } else if (local && remote) {
    // 同じ状態。送信済みの印だけ合わせておく
    writeSyncedMark(remote.savedAt);
  }
}
