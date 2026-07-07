"use client";

import { useEffect, useMemo, useState } from "react";
import RequireAuth from "@/components/RequireAuth";
import { fetchAttempts, fetchSessions } from "@/lib/db";
import type { AttemptRow, SessionRow, Field } from "@/lib/types";
import { FIELD_NAMES } from "@/lib/types";

const MODE_LABELS: Record<string, string> = {
  mock: "模擬試験",
  quick: "クイック演習",
  review: "復習",
  pm: "午後演習",
};

interface Bucket {
  total: number;
  correct: number;
}

function Bar({ label, bucket, sub }: { label: string; bucket: Bucket; sub?: string }) {
  const rate = bucket.total > 0 ? Math.round((bucket.correct / bucket.total) * 100) : 0;
  return (
    <div>
      <div className="flex justify-between text-xs text-slate-600 mb-0.5 gap-2">
        <span className="truncate">
          {label}
          {sub && <span className="text-slate-400 ml-1">{sub}</span>}
        </span>
        <span className="shrink-0">
          {bucket.correct}/{bucket.total} ({rate}%)
        </span>
      </div>
      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${
            rate >= 70 ? "bg-emerald-500" : rate >= 50 ? "bg-amber-400" : "bg-rose-400"
          }`}
          style={{ width: `${rate}%` }}
        />
      </div>
    </div>
  );
}

function StatsInner() {
  const [attempts, setAttempts] = useState<AttemptRow[] | null>(null);
  const [sessions, setSessions] = useState<SessionRow[]>([]);

  useEffect(() => {
    fetchAttempts().then(setAttempts);
    fetchSessions().then(setSessions);
  }, []);

  const stats = useMemo(() => {
    if (!attempts) return null;
    const overall: Bucket = { total: 0, correct: 0 };
    const byField = new Map<string, Bucket>();
    const byCategory = new Map<string, { field: string | null; bucket: Bucket }>();
    for (const a of attempts) {
      overall.total++;
      if (a.is_correct) overall.correct++;
      if (a.field) {
        const f = byField.get(a.field) ?? { total: 0, correct: 0 };
        f.total++;
        if (a.is_correct) f.correct++;
        byField.set(a.field, f);
      }
      if (a.category) {
        const c = byCategory.get(a.category) ?? {
          field: a.field,
          bucket: { total: 0, correct: 0 },
        };
        c.bucket.total++;
        if (a.is_correct) c.bucket.correct++;
        byCategory.set(a.category, c);
      }
    }
    // 苦手分野 = 3問以上解いていて正答率が低い順
    const weak = [...byCategory.entries()]
      .filter(([, v]) => v.bucket.total >= 3)
      .sort(
        (a, b) =>
          a[1].bucket.correct / a[1].bucket.total - b[1].bucket.correct / b[1].bucket.total
      );
    return { overall, byField, byCategory, weak };
  }, [attempts]);

  if (!attempts || !stats) {
    return <div className="text-center py-16 text-slate-400 text-sm">読み込み中...</div>;
  }

  if (attempts.length === 0) {
    return (
      <div className="text-center py-16 text-slate-400 text-sm">
        まだ解答履歴がありません。演習すると成績がここに表示されます。
      </div>
    );
  }

  const overallRate = Math.round((stats.overall.correct / stats.overall.total) * 100);

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold">成績・分析</h1>

      <div className="grid grid-cols-3 gap-2">
        <div className="card p-3 text-center">
          <div className="text-2xl font-bold text-indigo-700">{stats.overall.total}</div>
          <div className="text-xs text-slate-500">累計解答数</div>
        </div>
        <div className="card p-3 text-center">
          <div
            className={`text-2xl font-bold ${overallRate >= 60 ? "text-emerald-600" : "text-rose-600"}`}
          >
            {overallRate}%
          </div>
          <div className="text-xs text-slate-500">通算正答率</div>
        </div>
        <div className="card p-3 text-center">
          <div className="text-2xl font-bold text-violet-600">{sessions.length}</div>
          <div className="text-xs text-slate-500">演習回数</div>
        </div>
      </div>

      {stats.weak.length > 0 && (
        <div className="card p-4">
          <div className="font-bold text-sm mb-1">苦手分野 TOP5</div>
          <p className="text-xs text-slate-400 mb-3">3問以上解いた分野のうち正答率が低い順</p>
          <div className="space-y-2.5">
            {stats.weak.slice(0, 5).map(([cat, v]) => (
              <Bar
                key={cat}
                label={cat}
                sub={v.field ? FIELD_NAMES[v.field as Field] : "午後"}
                bucket={v.bucket}
              />
            ))}
          </div>
        </div>
      )}

      <div className="card p-4">
        <div className="font-bold text-sm mb-3">大分類別の正答率</div>
        <div className="space-y-2.5">
          {(["T", "M", "S"] as const).map((f) => {
            const b = stats.byField.get(f);
            if (!b) return null;
            return <Bar key={f} label={FIELD_NAMES[f]} bucket={b} />;
          })}
        </div>
      </div>

      <div className="card p-4">
        <div className="font-bold text-sm mb-3">分野別の正答率 (全分野)</div>
        <div className="space-y-2.5">
          {[...stats.byCategory.entries()].map(([cat, v]) => (
            <Bar
              key={cat}
              label={cat}
              sub={v.field ? FIELD_NAMES[v.field as Field] : "午後"}
              bucket={v.bucket}
            />
          ))}
        </div>
      </div>

      <div className="card p-4">
        <div className="font-bold text-sm mb-3">演習履歴</div>
        {sessions.length === 0 ? (
          <p className="text-sm text-slate-400">完了した演習がまだありません</p>
        ) : (
          <div className="space-y-1.5">
            {sessions.map((s) => {
              const rate = s.total > 0 ? Math.round((s.correct / s.total) * 100) : 0;
              const d = new Date(s.started_at);
              return (
                <div
                  key={s.id}
                  className="flex items-center justify-between border border-slate-200 rounded-lg px-3 py-2 text-sm"
                >
                  <div>
                    <span className="font-medium">{MODE_LABELS[s.mode] ?? s.mode}</span>
                    <span className="text-xs text-slate-400 ml-2">
                      {d.getFullYear()}/{d.getMonth() + 1}/{d.getDate()}{" "}
                      {d.getHours()}:{String(d.getMinutes()).padStart(2, "0")}
                    </span>
                  </div>
                  <div
                    className={`font-bold ${rate >= 60 ? "text-emerald-600" : "text-rose-600"}`}
                  >
                    {s.correct}/{s.total} ({rate}%)
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default function StatsPage() {
  return (
    <RequireAuth>
      <StatsInner />
    </RequireAuth>
  );
}
