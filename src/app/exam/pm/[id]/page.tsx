import { PM_QUESTIONS } from "@/lib/questions";
import PmDetailClient from "./PmDetailClient";

// 静的エクスポート(GitHub Pages)用に全大問のページを事前生成する
export function generateStaticParams() {
  return PM_QUESTIONS.map((pm) => ({ id: pm.id }));
}

export default async function PmDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <PmDetailClient id={id} />;
}
