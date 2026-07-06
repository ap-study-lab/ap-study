"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import RequireAuth from "@/components/RequireAuth";
import QuestionPlayer from "@/components/QuestionPlayer";
import {
  buildMockExam,
  buildQuickSet,
  getCategories,
  shuffle,
} from "@/lib/questions";
import type { AmQuestion, SourceFilter } from "@/lib/types";
import { FIELD_NAMES } from "@/lib/types";

type Phase =
  | { kind: "setup" }
  | { kind: "playing"; questions: AmQuestion[]; mock: boolean };

function AmExamInner() {
  const params = useSearchParams();
  const initialMode = params.get("mode") === "quick" ? "quick" : "mock";
  const [tab, setTab] = useState<"mock" | "quick">(initialMode);
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [quickCount, setQuickCount] = useState(10);
  const [categories, setCategories] = useState<string[]>([]);
  const [phase, setPhase] = useState<Phase>({ kind: "setup" });

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
        sourceFilter={sourceFilter}
        immediateFeedback={!phase.mock}
        timeLimitMinutes={phase.mock ? 150 : undefined}
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

      <div className="flex rounded-lg overflow-hidden border border-slate-300">
        <button
          onClick={() => setTab("mock")}
          className={`flex-1 py-2.5 text-sm font-bold ${
            tab === "mock" ? "bg-indigo-600 text-white" : "bg-white text-slate-600"
          }`}
        >
          模擬試験 (80問)
        </button>
        <button
          onClick={() => setTab("quick")}
          className={`flex-1 py-2.5 text-sm font-bold ${
            tab === "quick" ? "bg-indigo-600 text-white" : "bg-white text-slate-600"
          }`}
        >
          クイック演習
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-5">
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
                className={`px-4 py-2 rounded-lg text-sm border ${
                  sourceFilter === v
                    ? "border-indigo-600 bg-indigo-50 text-indigo-700 font-bold"
                    : "border-slate-300 bg-white text-slate-600"
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
            全問解答後にまとめて採点され、全問に解説が付きます。
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
                    className={`px-4 py-2 rounded-lg text-sm border ${
                      quickCount === n
                        ? "border-indigo-600 bg-indigo-50 text-indigo-700 font-bold"
                        : "border-slate-300 bg-white text-slate-600"
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
                      className={`px-2.5 py-1.5 rounded-full text-xs border ${
                        on
                          ? "border-indigo-600 bg-indigo-600 text-white"
                          : "border-slate-300 bg-white text-slate-600"
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

        <button
          onClick={start}
          className="w-full py-3 rounded-lg bg-indigo-600 text-white font-bold"
        >
          開始する
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
