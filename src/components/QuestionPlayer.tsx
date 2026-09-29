"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AmQuestion, AnswerRecord, SessionMode, SourceFilter } from "@/lib/types";
import { CHOICE_LABELS, FIELD_NAMES } from "@/lib/types";
import { createSession, finishSession, recordAttempts } from "@/lib/db";
import { clearExam, formatRemaining, saveExam } from "@/lib/examStorage";
import type { RestoredExam } from "@/lib/examStorage";
import {
  deleteRemoteProgress,
  flushProgressNow,
  scheduleProgressPush,
} from "@/lib/progressSync";

interface Props {
  questions: AmQuestion[];
  mode: SessionMode;
  sourceFilter: SourceFilter;
  /** 指定すると制限時間付き(一時停止可)になる */
  timeLimitMinutes?: number;
  /** 中断した演習の続きから始める場合の保存データ */
  restored?: RestoredExam | null;
  /** 進行状況を localStorage に保存し、リロード後に再開できるようにする */
  persist?: boolean;
  onExit: () => void;
  onRetryWrong?: (wrong: AmQuestion[]) => void;
}

function toRecord(q: AmQuestion, selected: number): AnswerRecord {
  return {
    questionId: q.id,
    exam: "am",
    field: q.field,
    category: q.category,
    source: q.source.type,
    selected: CHOICE_LABELS[selected],
    isCorrect: selected === q.answer,
  };
}

export function SourceBadge({ q }: { q: AmQuestion }) {
  return q.source.type === "past" ? (
    <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
      過去問 {q.source.label}
    </span>
  ) : (
    <span className="text-xs px-2 py-0.5 rounded-full bg-sky-100 text-sky-800">
      AI作成
    </span>
  );
}

export function CategoryBadge({ q }: { q: AmQuestion }) {
  return (
    <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
      {FIELD_NAMES[q.field]}・{q.category}
    </span>
  );
}

export function ExplanationBox({ q, selected }: { q: AmQuestion; selected: number | null }) {
  const correct = selected === q.answer;
  return (
    <div className="mt-4 space-y-3">
      <div
        className={`rounded-lg px-4 py-3 font-bold text-sm ${
          correct ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
        }`}
      >
        {correct ? "正解! " : "不正解… "}
        正解は「{CHOICE_LABELS[q.answer]}」
        {selected !== null && !correct && ` (あなたの解答: ${CHOICE_LABELS[selected]})`}
      </div>
      <div className="rounded-lg bg-slate-50 border border-slate-200 px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap">
        <div className="font-bold text-slate-700 mb-1">解説</div>
        {q.explanation}
      </div>
    </div>
  );
}

function ChoiceList({
  q,
  selected,
  revealed,
  onSelect,
}: {
  q: AmQuestion;
  selected: number | null;
  revealed: boolean;
  onSelect: (i: number) => void;
}) {
  return (
    <div className="space-y-2">
      {q.choices.map((choice, i) => {
        let cls =
          "border-slate-200 bg-white hover:border-indigo-400 hover:-translate-y-px hover:shadow-md hover:shadow-indigo-100 active:bg-indigo-50";
        let chipCls = "bg-slate-100 text-slate-600";
        if (revealed) {
          if (i === q.answer) {
            cls = "border-emerald-500 bg-emerald-50/80";
            chipCls = "bg-emerald-500 text-white";
          } else if (i === selected) {
            cls = "border-rose-400 bg-rose-50/80";
            chipCls = "bg-rose-400 text-white";
          } else {
            cls = "border-slate-200 bg-white opacity-60";
          }
        } else if (i === selected) {
          cls = "border-indigo-600 bg-indigo-50/80 shadow-md shadow-indigo-100";
          chipCls = "bg-gradient-to-br from-indigo-600 to-violet-600 text-white";
        }
        return (
          <button
            key={i}
            disabled={revealed}
            onClick={() => onSelect(i)}
            className={`w-full text-left border-2 rounded-xl px-3 py-2.5 text-sm leading-relaxed transition-all flex gap-2.5 items-start ${cls}`}
          >
            <span
              className={`shrink-0 w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold mt-0.5 transition-colors ${chipCls}`}
            >
              {CHOICE_LABELS[i]}
            </span>
            <span className="whitespace-pre-wrap">{choice}</span>
          </button>
        );
      })}
    </div>
  );
}

function TimerBadge({ remaining, running }: { remaining: number; running: boolean }) {
  const cls = !running
    ? "bg-amber-100 text-amber-700"
    : remaining < 600
      ? "bg-rose-100 text-rose-700"
      : "bg-slate-100 text-slate-600";
  return (
    <span className={`font-mono text-sm px-2 py-1 rounded ${cls}`}>
      残り {formatRemaining(remaining)}
    </span>
  );
}

export default function QuestionPlayer({
  questions,
  mode,
  sourceFilter,
  timeLimitMinutes,
  restored,
  persist = false,
  onExit,
  onRetryWrong,
}: Props) {
  const [current, setCurrent] = useState(restored?.current ?? 0);
  const [answers, setAnswers] = useState<(number | null)[]>(
    () => restored?.answers ?? questions.map(() => null)
  );
  // 何問目まで解答(=解説表示)済みか
  const [revealedCount, setRevealedCount] = useState(restored?.revealedCount ?? 0);
  const [finished, setFinished] = useState(false);
  const [remaining, setRemaining] = useState<number | null>(() => {
    if (restored && restored.remainingSec !== null) return restored.remainingSec;
    return timeLimitMinutes ? timeLimitMinutes * 60 : null;
  });
  // 中断から戻ったときは止めた状態で開く(開いた瞬間に時間が減り始めないように)
  const [running, setRunning] = useState(() => !restored);
  const sessionIdRef = useRef<string | null>(null);
  const sessionReady = useRef<Promise<void> | null>(null);
  const finishingRef = useRef(false);

  const timed = remaining !== null;
  const paused = timed && !running;
  const q = questions[current];
  const answered = answers.filter((a) => a !== null).length;
  const currentRevealed = current < revealedCount;

  useEffect(() => {
    if (sessionReady.current) return;
    if (restored?.sessionId) {
      // 続きから: 同じ ap_sessions 行に解答を積み足す
      sessionIdRef.current = restored.sessionId;
      sessionReady.current = Promise.resolve();
    } else {
      sessionReady.current = createSession(mode, sourceFilter).then((id) => {
        sessionIdRef.current = id;
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- 進行状況の保存 ---
  const stateRef = useRef({ current, answers, revealedCount, remaining });
  // 5秒おきの保存や pagehide からも最新値を読めるようにしておく
  // (この効果は下の保存用 useEffect より先に宣言しておくこと)
  useEffect(() => {
    stateRef.current = { current, answers, revealedCount, remaining };
  }, [current, answers, revealedCount, remaining]);

  const save = useCallback(() => {
    if (!persist || finished) return;
    const s = stateRef.current;
    saveExam({
      mode,
      sourceFilter,
      questionIds: questions.map((qq) => qq.id),
      answers: s.answers,
      revealedCount: s.revealedCount,
      current: s.current,
      timeLimitMinutes: timeLimitMinutes ?? null,
      remainingSec: s.remaining,
      sessionId: sessionIdRef.current,
    });
    // 他の端末でも続きから再開できるようにサーバーへ送る(まとめて後送り)
    scheduleProgressPush();
  }, [persist, finished, mode, sourceFilter, questions, timeLimitMinutes]);

  // 解答・移動・一時停止のたびに保存
  useEffect(() => {
    save();
  }, [save, current, answers, revealedCount, running]);

  // 一時停止・再開の時点は確実にサーバーへ反映しておく(端末を持ち替える場面なので)
  useEffect(() => {
    if (!persist) return;
    void flushProgressNow();
  }, [persist, running]);

  // 残り時間は毎秒変わるので、書き込みは5秒おきに間引く
  useEffect(() => {
    if (!persist || finished || !running || !timed) return;
    const t = setInterval(save, 5000);
    return () => clearInterval(t);
  }, [persist, finished, running, timed, save]);

  // スマホでタブを閉じる・アプリを切り替える直前にも保存しておく
  useEffect(() => {
    if (!persist) return;
    const onHide = () => save();
    window.addEventListener("pagehide", onHide);
    return () => window.removeEventListener("pagehide", onHide);
  }, [persist, save]);

  // --- タイマー ---
  useEffect(() => {
    if (!running || finished || !timed) return;
    const t = setInterval(() => {
      setRemaining((r) => (r === null ? null : Math.max(0, r - 1)));
    }, 1000);
    return () => clearInterval(t);
  }, [running, finished, timed]);

  async function finish() {
    if (finishingRef.current) return;
    finishingRef.current = true;
    const correct = questions.filter((qq, i) => answers[i] === qq.answer).length;
    if (sessionReady.current) await sessionReady.current;
    if (sessionIdRef.current) {
      await finishSession(sessionIdRef.current, questions.length, correct);
    }
    if (persist) {
      clearExam();
      // 他の端末に中断データが残らないようにサーバー側も消す
      void deleteRemoteProgress();
    }
    setFinished(true);
  }

  // 時間切れは自動採点
  useEffect(() => {
    if (remaining === 0 && !finished) finish();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remaining, finished]);

  async function selectChoice(i: number) {
    if (finished || paused) return;
    const next = [...answers];
    next[current] = i;
    setAnswers(next);
    if (current >= revealedCount) {
      setRevealedCount(current + 1);
      // 即時記録 (セッション作成完了を待ってから)
      if (sessionReady.current) await sessionReady.current;
      recordAttempts([toRecord(q, i)], sessionIdRef.current);
    }
  }

  function handleFinishEarly() {
    const unanswered = questions.length - answered;
    if (
      unanswered > 0 &&
      !confirm(
        `未解答が ${unanswered} 問あります。採点しますか?\n(未解答は不正解として扱われます)`
      )
    ) {
      return;
    }
    finish();
  }

  function handleExit() {
    if (persist) {
      if (
        !confirm("演習を中断します。\n進行状況は保存され、他の端末からでも続きから再開できます。")
      ) {
        return;
      }
      save();
      void flushProgressNow();
    } else if (!confirm("演習を中断して戻りますか?")) {
      return;
    }
    onExit();
  }

  if (questions.length === 0) {
    return (
      <div className="text-center py-12 text-slate-500">
        <p>出題できる問題がありません。</p>
        <button onClick={onExit} className="mt-4 text-indigo-600 underline">
          戻る
        </button>
      </div>
    );
  }

  if (finished) {
    return (
      <ResultView
        questions={questions}
        answers={answers}
        onExit={onExit}
        onRetryWrong={onRetryWrong}
      />
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="text-sm text-slate-500 font-medium">
          問{current + 1} / {questions.length}
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          {timed && <TimerBadge remaining={remaining as number} running={running} />}
          {timed && (
            <button
              onClick={() => setRunning((r) => !r)}
              className="text-xs font-bold px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-600 hover:border-indigo-400 hover:text-indigo-700 transition-colors"
            >
              {running ? "⏸ 一時停止" : "▶ 再開"}
            </button>
          )}
          <button onClick={handleExit} className="text-xs text-slate-400 hover:text-slate-600">
            中断
          </button>
        </div>
      </div>

      <div className="h-2 bg-slate-200/80 rounded-full mb-4 overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full transition-all"
          style={{ width: `${(answered / questions.length) * 100}%` }}
        />
      </div>

      {paused ? (
        <div className="card p-8 text-center space-y-4">
          <div className="text-4xl">⏸</div>
          <div>
            <div className="font-bold">一時停止中</div>
            <p className="text-sm text-slate-500 mt-1">
              残り {formatRemaining(remaining as number)} / {answered} 問解答済み
            </p>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            問題文は伏せています。
            <br />
            このままブラウザを閉じても、次に開いたときここから再開できます。
          </p>
          <button onClick={() => setRunning(true)} className="btn-primary px-6 py-2.5 text-sm">
            ▶ 再開する
          </button>
        </div>
      ) : (
        <div className="card p-4 sm:p-6">
          <div className="flex gap-2 flex-wrap mb-3">
            <CategoryBadge q={q} />
            <SourceBadge q={q} />
          </div>
          <p className="text-sm sm:text-base leading-relaxed whitespace-pre-wrap mb-4 font-medium">
            {q.question}
          </p>
          <ChoiceList
            q={q}
            selected={answers[current]}
            revealed={currentRevealed}
            onSelect={selectChoice}
          />
          {currentRevealed && <ExplanationBox q={q} selected={answers[current]} />}
        </div>
      )}

      {!paused && (
        <div className="flex items-center justify-between mt-4 gap-2">
          <button
            onClick={() => setCurrent((c) => Math.max(0, c - 1))}
            disabled={current === 0}
            className="btn-ghost px-4 py-2 text-sm"
          >
            ← 前へ
          </button>
          <div className="flex items-center gap-2">
            {timed && !(current === questions.length - 1 && currentRevealed) && (
              <button onClick={handleFinishEarly} className="btn-ghost px-3 py-2 text-xs">
                終了して採点
              </button>
            )}
            {current === questions.length - 1 && currentRevealed ? (
              <button onClick={finish} className="btn-primary px-6 py-2 text-sm">
                結果を見る ✨
              </button>
            ) : (
              <button
                onClick={() => setCurrent((c) => Math.min(questions.length - 1, c + 1))}
                disabled={!currentRevealed}
                className="btn-primary px-5 py-2 text-sm"
              >
                次へ →
              </button>
            )}
          </div>
        </div>
      )}

      {timed && !paused && (
        <div className="mt-6 card p-3">
          <div className="text-xs text-slate-500 mb-2">問題一覧 (解答済みの問題に戻れます)</div>
          <div className="grid grid-cols-10 gap-1.5">
            {questions.map((_, i) => {
              const reachable = i <= revealedCount;
              return (
                <button
                  key={i}
                  onClick={() => reachable && setCurrent(i)}
                  disabled={!reachable}
                  className={`h-8 rounded-lg text-xs font-medium transition-colors ${
                    i === current
                      ? "bg-gradient-to-br from-indigo-600 to-violet-600 text-white font-bold shadow-sm"
                      : answers[i] !== null
                        ? "bg-indigo-100 text-indigo-700 hover:bg-indigo-200"
                        : reachable
                          ? "bg-slate-100 text-slate-400 hover:bg-slate-200"
                          : "bg-slate-50 text-slate-300 cursor-not-allowed"
                  }`}
                >
                  {i + 1}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function ResultView({
  questions,
  answers,
  onExit,
  onRetryWrong,
}: {
  questions: AmQuestion[];
  answers: (number | null)[];
  onExit: () => void;
  onRetryWrong?: (wrong: AmQuestion[]) => void;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const correct = questions.filter((q, i) => answers[i] === q.answer).length;
  const rate = Math.round((correct / questions.length) * 100);
  const wrong = questions.filter((q, i) => answers[i] !== q.answer);

  const fieldStats = useMemo(() => {
    const stats: Record<string, { total: number; correct: number }> = {};
    questions.forEach((q, i) => {
      const key = FIELD_NAMES[q.field];
      stats[key] ??= { total: 0, correct: 0 };
      stats[key].total++;
      if (answers[i] === q.answer) stats[key].correct++;
    });
    return stats;
  }, [questions, answers]);

  return (
    <div className="space-y-4">
      <div
        className={`rounded-2xl p-8 text-center text-white shadow-xl ${
          rate >= 60
            ? "bg-gradient-to-br from-indigo-600 via-violet-600 to-purple-600 shadow-indigo-600/30"
            : "bg-gradient-to-br from-slate-600 to-slate-700 shadow-slate-600/30"
        }`}
      >
        <div className="text-sm opacity-80 mb-1">
          {rate >= 60 ? "🎉 お見事!" : "💪 あと少し!"} 正答率
        </div>
        <div className="text-6xl font-extrabold tracking-tight">{rate}%</div>
        <div className="mt-2 opacity-90">
          {correct} / {questions.length} 問正解
          {questions.length >= 80 && (
            <span className="block text-xs mt-1 opacity-70">
              (本試験の合格基準は 60% 以上)
            </span>
          )}
        </div>
      </div>

      <div className="card p-4">
        <div className="font-bold text-sm mb-3">分野別</div>
        <div className="space-y-2">
          {Object.entries(fieldStats).map(([name, s]) => {
            const r = Math.round((s.correct / s.total) * 100);
            return (
              <div key={name}>
                <div className="flex justify-between text-xs text-slate-600 mb-0.5">
                  <span>{name}</span>
                  <span>
                    {s.correct}/{s.total} ({r}%)
                  </span>
                </div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${r >= 60 ? "bg-emerald-500" : "bg-rose-400"}`}
                    style={{ width: `${r}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex gap-2">
        {wrong.length > 0 && onRetryWrong && (
          <button
            onClick={() => onRetryWrong(wrong)}
            className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-rose-500 to-pink-600 text-white text-sm font-bold shadow-lg shadow-rose-500/25 transition-all hover:brightness-110 active:scale-[0.98]"
          >
            🔁 間違えた {wrong.length} 問を解き直す
          </button>
        )}
        <button onClick={onExit} className="btn-ghost flex-1 py-2.5 text-sm">
          終了する
        </button>
      </div>

      <div className="card p-4">
        <div className="font-bold text-sm mb-3">全問題の解説 (タップで開閉)</div>
        <div className="space-y-1.5">
          {questions.map((q, i) => {
            const isCorrect = answers[i] === q.answer;
            const open = openId === q.id;
            return (
              <div key={q.id} className="border border-slate-200 rounded-lg overflow-hidden">
                <button
                  onClick={() => setOpenId(open ? null : q.id)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm bg-slate-50"
                >
                  <span
                    className={`shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                      isCorrect ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
                    }`}
                  >
                    {isCorrect ? "○" : "×"}
                  </span>
                  <span className="text-slate-400 text-xs shrink-0">問{i + 1}</span>
                  <span className="truncate">{q.question}</span>
                </button>
                {open && (
                  <div className="p-3">
                    <div className="flex gap-2 flex-wrap mb-2">
                      <CategoryBadge q={q} />
                      <SourceBadge q={q} />
                    </div>
                    <p className="text-sm whitespace-pre-wrap mb-3">{q.question}</p>
                    <div className="space-y-1 text-sm mb-2">
                      {q.choices.map((c, ci) => (
                        <div
                          key={ci}
                          className={`px-2 py-1 rounded ${
                            ci === q.answer
                              ? "bg-emerald-50 font-medium"
                              : ci === answers[i]
                                ? "bg-rose-50"
                                : ""
                          }`}
                        >
                          <span className="font-bold mr-1">{CHOICE_LABELS[ci]}</span>
                          {c}
                          {ci === q.answer && (
                            <span className="text-emerald-600 text-xs ml-1">← 正解</span>
                          )}
                          {ci === answers[i] && ci !== q.answer && (
                            <span className="text-rose-500 text-xs ml-1">← あなたの解答</span>
                          )}
                        </div>
                      ))}
                    </div>
                    <div className="text-sm bg-slate-50 rounded p-3 whitespace-pre-wrap leading-relaxed">
                      {q.explanation}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
