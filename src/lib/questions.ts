import type { AmQuestion, PmQuestion, SourceFilter, Field } from "./types";

import technology1 from "@/data/am/technology1.json";
import technology2 from "@/data/am/technology2.json";
import technology3 from "@/data/am/technology3.json";
import technology4 from "@/data/am/technology4.json";
import technology5 from "@/data/am/technology5.json";
import technology6 from "@/data/am/technology6.json";
import technology7 from "@/data/am/technology7.json";
import technology8 from "@/data/am/technology8.json";
import management from "@/data/am/management.json";
import management2 from "@/data/am/management2.json";
import strategy1 from "@/data/am/strategy1.json";
import strategy2 from "@/data/am/strategy2.json";
import strategy3 from "@/data/am/strategy3.json";
import strategy4 from "@/data/am/strategy4.json";
import pmSecurity from "@/data/pm/security.json";
import pmSecurity2 from "@/data/pm/security2.json";
import pmNetwork from "@/data/pm/network.json";
import pmDatabase from "@/data/pm/database.json";
import pmAlgorithm from "@/data/pm/algorithm.json";
import pmSysarch from "@/data/pm/sysarch.json";
import pmStrategy from "@/data/pm/strategy.json";
import pmProjectManagement from "@/data/pm/project-management.json";
import pmServiceManagement from "@/data/pm/service-management.json";
import pmEmbedded from "@/data/pm/embedded.json";
import pmAudit from "@/data/pm/audit.json";
import pmDevelopment from "@/data/pm/development.json";

export const AM_QUESTIONS: AmQuestion[] = [
  ...technology1,
  ...technology2,
  ...technology3,
  ...technology4,
  ...technology5,
  ...technology6,
  ...technology7,
  ...technology8,
  ...management,
  ...management2,
  ...strategy1,
  ...strategy2,
  ...strategy3,
  ...strategy4,
] as unknown as AmQuestion[];

export const PM_QUESTIONS: PmQuestion[] = [
  pmSecurity,
  pmSecurity2,
  pmNetwork,
  pmDatabase,
  pmAlgorithm,
  pmSysarch,
  pmStrategy,
  pmProjectManagement,
  pmServiceManagement,
  pmEmbedded,
  pmAudit,
  pmDevelopment,
] as unknown as PmQuestion[];

const amById = new Map(AM_QUESTIONS.map((q) => [q.id, q]));
const pmById = new Map(PM_QUESTIONS.map((q) => [q.id, q]));

export function getAmQuestion(id: string): AmQuestion | undefined {
  return amById.get(id);
}

export function getPmQuestion(id: string): PmQuestion | undefined {
  return pmById.get(id);
}

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function filterBySource(pool: AmQuestion[], filter: SourceFilter): AmQuestion[] {
  if (filter === "all") return pool;
  return pool.filter((q) => q.source.type === filter);
}

/** 本試験と同じ分野配分: テクノロジ50問 / マネジメント10問 / ストラテジ20問 */
const MOCK_DISTRIBUTION: Record<Field, number> = { T: 50, M: 10, S: 20 };

export function buildMockExam(sourceFilter: SourceFilter): AmQuestion[] {
  const pool = filterBySource(AM_QUESTIONS, sourceFilter);
  const picked: AmQuestion[] = [];
  const pickedIds = new Set<string>();

  for (const field of ["T", "M", "S"] as Field[]) {
    const fieldPool = shuffle(pool.filter((q) => q.field === field));
    for (const q of fieldPool.slice(0, MOCK_DISTRIBUTION[field])) {
      picked.push(q);
      pickedIds.add(q.id);
    }
  }
  // 分野内の問題数が足りない場合は他分野から補充
  if (picked.length < 80) {
    const rest = shuffle(pool.filter((q) => !pickedIds.has(q.id)));
    picked.push(...rest.slice(0, 80 - picked.length));
  }
  // 本試験と同様に テクノロジ → マネジメント → ストラテジ の順で出題
  const order: Record<Field, number> = { T: 0, M: 1, S: 2 };
  return picked.sort((a, b) => order[a.field] - order[b.field]);
}

export function buildQuickSet(
  count: number,
  sourceFilter: SourceFilter,
  categories?: string[]
): AmQuestion[] {
  let pool = filterBySource(AM_QUESTIONS, sourceFilter);
  if (categories && categories.length > 0) {
    pool = pool.filter((q) => categories.includes(q.category));
  }
  return shuffle(pool).slice(0, count);
}

export function getCategories(): { field: Field; category: string; count: number }[] {
  const map = new Map<string, { field: Field; category: string; count: number }>();
  for (const q of AM_QUESTIONS) {
    const entry = map.get(q.category);
    if (entry) {
      entry.count++;
    } else {
      map.set(q.category, { field: q.field, category: q.category, count: 1 });
    }
  }
  const order: Record<Field, number> = { T: 0, M: 1, S: 2 };
  return [...map.values()].sort((a, b) => order[a.field] - order[b.field]);
}
