export type Field = "T" | "M" | "S";
export type SourceType = "past" | "original";
export type SourceFilter = "all" | "past" | "original";
export type ExamKind = "am" | "pm";
export type SessionMode = "mock" | "quick" | "review" | "pm";

export interface QuestionSource {
  type: SourceType;
  /** 例: "令和5年 秋期" / "AIオリジナル" */
  label: string;
}

export interface AmQuestion {
  id: string;
  field: Field;
  category: string;
  source: QuestionSource;
  question: string;
  choices: string[];
  /** 正解の選択肢 index (0=ア, 1=イ, 2=ウ, 3=エ) */
  answer: number;
  explanation: string;
}

export interface PmSubQuestion {
  id: string;
  type: "choice" | "text";
  question: string;
  choices?: string[];
  answer?: number;
  modelAnswer?: string;
  explanation: string;
}

export interface PmQuestion {
  id: string;
  category: string;
  title: string;
  source: QuestionSource;
  scenario: string;
  subQuestions: PmSubQuestion[];
}

/** 1問の解答結果 (記録用) */
export interface AnswerRecord {
  questionId: string;
  exam: ExamKind;
  field: Field | null;
  category: string;
  source: SourceType;
  selected: string;
  isCorrect: boolean;
}

export interface AttemptRow {
  id: string;
  question_id: string;
  exam: ExamKind;
  field: string | null;
  category: string | null;
  source: string | null;
  selected: string | null;
  is_correct: boolean;
  answered_at: string;
  session_id: string | null;
}

export interface SessionRow {
  id: string;
  mode: SessionMode;
  source_filter: SourceFilter;
  total: number;
  correct: number;
  started_at: string;
  finished_at: string | null;
}

export const FIELD_NAMES: Record<Field, string> = {
  T: "テクノロジ系",
  M: "マネジメント系",
  S: "ストラテジ系",
};

export const CHOICE_LABELS = ["ア", "イ", "ウ", "エ", "オ", "カ"];
