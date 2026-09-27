"use client";

import { Suspense, useState, useSyncExternalStore } from "react";
import { useSearchParams } from "next/navigation";
import RequireAuth from "@/components/RequireAuth";
import QuestionPlayer from "@/components/QuestionPlayer";
import {
  buildMockExam,
  buildQuickSet,
  getCategories,
  shuffle,
} from "@/lib/questions";
import {
  clearExam,
  formatRemaining,
  getExamServerSnapshot,
  getExamSnapshot,
  subscribeExam,
} from "@/lib/examStorage";
import type { RestoredExam } from "@/lib/examStorage";
import type { AmQuestion, SourceFilter } from "@/lib/types";
import { FIELD_NAMES } from "@/lib/types";

type Phase =
  | { kind: "setup" }
  | {
      kind: "playing";
      questions: AmQuestion[];
      mock: boolean;
      /** 中断した演習の続きから始める場合 */
      restored?: RestoredExam;
    };

function AmExamInner() {
  const params = useSearchParams();
  const initialMode = params.get("mode") === "quick" ? "quick" : "mock";
  const [tab, setTab] = useState<"mock" | "quick">(initialMode);
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [quickCount, setQuickCount] = useState(10);
  const [categories, setCategories] = useState<string[]>([]);
  const [phase, setPhase] = useState<Phase>({ kind: "setup" });
  // localStorage はブラウザにしか無いので、外部ストアとして購読する
  // (静的HTML側は必ず null になるので、ハイドレーションのズレが起きない)
  const saved = useSyncExternalStore(subscribeExam, getExamSnapshot, getExamServerSnapshot);

  function resume() {
    if (!saved) return;
    setPhase({
      kind: "playing",
      questions: saved.questions,
      mock: saved.mode === "mock",
      restored: saved,
    });
    window.scrollTo(0, 0);
  }

  function discardSaved() {
    if (!confirm("中断した模擬試験を破棄します。よろしいですか?")) return;
    clearExam();
  }

  function start() {
    if (tab === "mock") {
      setPhase({ kind: "playing", questions: buildMockExam(sourceFilter), mock: true });
    } else {
      setPhase({
        kind: "playing",
        questions: buildQuickSet(quickCount, sourceFilter, categories.length ? categories : undefined),
        mock: false,
      });
    }
    window.scrollTo(0, 0);
  }

  if (phase.kind === "playing") {
    return (
      <QuestionPlayer
        questions={phase.questions}
        mode={phase.mock ? "mock" : "quick"}
        sourceFilter={phase.restored?.sourceFilter ?? sourceFilter}
        timeLimitMinutes={
          phase.restored
            ? (phase.restored.timeLimitMinutes ?? undefined)
            : phase.mock
              ? 150
              : undefined
        }
        restored={phase.restored}
        persist={phase.mock}
        onExit={() => setPhase({ kind: "setup" })}
        onRetryWrong={(wrong) =>
          setPhase({ kind: "playing", questions: shuffle(wrong), mock: false })
        }
      />
    );
  }

  const allCategories = getCategories();

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold">午前演習</h1>

      {saved && (
        <div className="card p-4 border-2 border-amber-300 bg-amber-50/60 space-y-3">
          <div>
            <div className="font-bold text-sm text-amber-800">⏸ 中断した模擬試験があります</div>
            <p className="text-xs text-amber-700 mt-1">
              {saved.revealedCount} / {saved.questions.length} 問 解答済み
              {saved.remainingSec !== null && ` ・ 残り ${formatRemaining(saved.remainingSec)}`}
            </p>
          </div>
          <div className="flex gap-2">
            <button onClick={resume} className="btn-primary flex-1 py-2.5 text-sm">
              続きから再開する ▶
            </button>
            <button onClick={discardSaved} className="btn-ghost px-4 py-2.5 text-sm">
              破棄
            </button>
          </div>
        </div>
      )}

      <div className="flex rounded-2xl p-1 bg-slate-200/70 gap-1">
        <button
          onClick={() => setTab("mock")}
          className={`flex-1 py-2.5 text-sm font-bold rounded-xl transition-all ${
            tab === "mock"
              ? "bg-white text-indigo-700 shadow-md"
              : "text-slate-500 hover:text-slate-700"
          }`}
        >
          📝 模擬試験 (80問)
        </button>
        <button
          onClick={() => setTab("quick")}
          className={`flex-1 py-2.5 text-sm font-bold rounded-xl transition-all ${
            tab === "quick"
              ? "bg-white text-indigo-700 shadow-md"
              : "text-slate-500 hover:text-slate-700"
          }`}
        >
          ⚡ クイック演習
        </button>
      </div>

      <div className="card p-5 space-y-5">
        <div>
          <div className="text-sm font-bold mb-2">出題する問題</div>
          <div className="flex gap-2">
            {(
              [
                ["all", "すべて"],
                ["past", "過去問のみ"],
                ["original", "AI問題のみ"],
              ] as [SourceFilter, string][]
            ).map(([v, label]) => (
              <button
                key={v}
                onClick={() => setSourceFilter(v)}
                className={`pill-toggle ${
                  sourceFilter === v ? "pill-toggle-on" : "pill-toggle-off"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {tab === "mock" ? (
          <p className="text-sm text-slate-500 leading-relaxed">
            本試験と同じ構成: 80問 / 150分 / テクノロジ50問・マネジメント10問・ストラテジ20問。
            1問解答するごとに正誤と解説が表示されます(解答した問題は変更できません)。
            タイマーは一時停止でき、ブラウザを閉じても続きから再開できます。
          </p>
        ) : (
          <>
            <div>
              <div className="text-sm font-bold mb-2">問題数</div>
              <div className="flex gap-2">
                {[5, 10, 20].map((n) => (
                  <button
                    key={n}
                    onClick={() => setQuickCount(n)}
                    className={`pill-toggle ${
                      quickCount === n ? "pill-toggle-on" : "pill-toggle-off"
                    }`}
                  >
                    {n}問
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div className="text-sm font-bold mb-1">
                分野の絞り込み <span className="font-normal text-slate-400">(未選択 = 全分野)</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {allCategories.map((c) => {
                  const on = categories.includes(c.category);
                  return (
                    <button
                      key={c.category}
                      onClick={() =>
                        setCategories((prev) =>
                          on ? prev.filter((x) => x !== c.category) : [...prev, c.category]
                        )
                      }
                      className={`px-2.5 py-1.5 rounded-full text-xs border transition-all ${
                        on
                          ? "border-transparent bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-bold shadow-sm"
                          : "border-slate-300 bg-white text-slate-600 hover:border-indigo-300 hover:text-indigo-700"
                      }`}
                    >
                      {c.category}
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-slate-400 mt-1.5">
                {(["T", "M", "S"] as const)
                  .map((f) => FIELD_NAMES[f])
                  .join(" / ")}{" "}
                の順に並んでいます
              </p>
            </div>
          </>
        )}

        <button onClick={start} className="btn-primary w-full py-3">
          開始する 🚀
        </button>
      </div>
    </div>
  );
}

export default function AmExamPage() {
  return (
    <RequireAuth>
      <Suspense fallback={null}>
        <AmExamInner />
      </Suspense>
    </RequireAuth>
  );
}
