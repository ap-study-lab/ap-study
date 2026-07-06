import { getSupabase } from "./supabase";
import type {
  AnswerRecord,
  AttemptRow,
  SessionMode,
  SessionRow,
  SourceFilter,
} from "./types";

export async function createSession(
  mode: SessionMode,
  sourceFilter: SourceFilter
): Promise<string | null> {
  const supabase = getSupabase();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return null;
  const { data, error } = await supabase
    .from("ap_sessions")
    .insert({ user_id: userData.user.id, mode, source_filter: sourceFilter })
    .select("id")
    .single();
  if (error) {
    console.error("createSession failed:", error.message);
    return null;
  }
  return data.id;
}

export async function finishSession(
  sessionId: string,
  total: number,
  correct: number,
  detail?: unknown
): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase
    .from("ap_sessions")
    .update({ total, correct, detail, finished_at: new Date().toISOString() })
    .eq("id", sessionId);
  if (error) console.error("finishSession failed:", error.message);
}

export async function recordAttempts(
  records: AnswerRecord[],
  sessionId: string | null
): Promise<void> {
  if (records.length === 0) return;
  const supabase = getSupabase();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return;
  const rows = records.map((r) => ({
    user_id: userData.user!.id,
    session_id: sessionId,
    question_id: r.questionId,
    exam: r.exam,
    field: r.field,
    category: r.category,
    source: r.source,
    selected: r.selected,
    is_correct: r.isCorrect,
  }));
  const { error } = await supabase.from("ap_attempts").insert(rows);
  if (error) console.error("recordAttempts failed:", error.message);
}

export async function fetchAttempts(): Promise<AttemptRow[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("ap_attempts")
    .select(
      "id, question_id, exam, field, category, source, selected, is_correct, answered_at, session_id"
    )
    .order("answered_at", { ascending: true })
    .limit(20000);
  if (error) {
    console.error("fetchAttempts failed:", error.message);
    return [];
  }
  return (data ?? []) as AttemptRow[];
}

export async function fetchSessions(): Promise<SessionRow[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("ap_sessions")
    .select("id, mode, source_filter, total, correct, started_at, finished_at")
    .not("finished_at", "is", null)
    .order("started_at", { ascending: false })
    .limit(100);
  if (error) {
    console.error("fetchSessions failed:", error.message);
    return [];
  }
  return (data ?? []) as SessionRow[];
}

/** 質問ごとの最新解答状況。最後に解いたときに間違えた問題 = 要復習 */
export interface QuestionStatus {
  questionId: string;
  exam: "am" | "pm";
  attempts: number;
  correctCount: number;
  lastCorrect: boolean;
  lastAnsweredAt: string;
}

export function summarizeByQuestion(attempts: AttemptRow[]): Map<string, QuestionStatus> {
  const map = new Map<string, QuestionStatus>();
  for (const a of attempts) {
    const cur = map.get(a.question_id);
    if (cur) {
      cur.attempts++;
      if (a.is_correct) cur.correctCount++;
      cur.lastCorrect = a.is_correct;
      cur.lastAnsweredAt = a.answered_at;
    } else {
      map.set(a.question_id, {
        questionId: a.question_id,
        exam: a.exam,
        attempts: 1,
        correctCount: a.is_correct ? 1 : 0,
        lastCorrect: a.is_correct,
        lastAnsweredAt: a.answered_at,
      });
    }
  }
  return map;
}
