'use client';

import Link from 'next/link';
import { ArrowUpRight, BookOpen, Headphones, Mic2, PenLine, Sparkles } from 'lucide-react';
import { IELTS_BANDS } from '@/lib/ielts/bands';
import { useI18n } from '@/lib/hooks/use-i18n';
import { ieltsAppCopy } from '@/lib/i18n/ielts-app-copy';

const SKILL_ICONS = [Headphones, BookOpen, Mic2, PenLine] as const;

const vietnameseBands = {
  '3.0-5.5': {
    title: 'Nền tảng đến 5.5',
    level: 'Xây kỹ năng IELTS cốt lõi',
    description: 'Bắt đầu với tiếng Anh thường ngày, rồi luyện các dạng bài IELTS Academic ngắn.',
    focus: 'Từ vựng thông dụng · câu rõ ràng · chiến lược từng bước',
  },
  '5.5-7.0': {
    title: 'Phát triển đến 7.0',
    level: 'Củng cố kỹ năng học thuật',
    description: 'Luyện paraphrase, kiểm soát yêu cầu đề, dùng dẫn chứng và tổ chức câu trả lời.',
    focus: 'Paraphrase · mục đích đoạn văn · lập luận mạch lạc',
  },
  '7.0-9.0': {
    title: 'Nâng cao đến 9.0',
    level: 'Tinh chỉnh độ chính xác và sắc thái',
    description: 'Luyện suy luận tinh tế, chọn dẫn chứng, giới hạn phạm vi và diễn đạt chính xác.',
    focus: 'Lập trường · bằng chứng · sắc thái · lập luận nâng cao',
  },
} as const;

export default function BandSelectionPage() {
  const { locale } = useI18n();
  const vi = locale.toLowerCase().startsWith('vi');
  const c = (key: Parameters<typeof ieltsAppCopy>[1]) => ieltsAppCopy(locale, key);

  return (
    <main className="relative min-h-[100dvh] overflow-hidden bg-slate-50 px-4 pb-14 pt-28 text-slate-950 dark:bg-slate-950 dark:text-white sm:px-8 sm:pt-32">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(79,70,229,0.12),_transparent_55%),radial-gradient(ellipse_at_bottom_right,_rgba(14,165,233,0.06),_transparent_45%)] dark:bg-[radial-gradient(ellipse_at_top,_rgba(79,70,229,0.2),_transparent_55%),radial-gradient(ellipse_at_bottom_right,_rgba(14,165,233,0.1),_transparent_45%)]" />
      <section className="relative mx-auto max-w-6xl">
        <div className="mx-auto max-w-2xl text-center">
          <div className="mx-auto mb-5 flex size-12 items-center justify-center rounded-2xl border border-violet-300/20 bg-violet-400/10 text-violet-200">
            <Sparkles className="size-6" />
          </div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-violet-600 dark:text-violet-300">{c('appName')}</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">{c('chooseBand')}</h1>
          <p className="mx-auto mt-4 max-w-xl text-sm leading-6 text-slate-600 dark:text-slate-400 sm:text-base">{c('chooseBandDescription')}</p>
        </div>

        <div className="mt-10 grid gap-4 md:grid-cols-3 md:gap-5">
          {IELTS_BANDS.map((band, index) => {
            const local = vietnameseBands[band.range];
            const title = vi ? local.title : band.title;
            const level = vi ? local.level : band.level;
            const description = vi ? local.description : band.description;
            const focus = vi ? local.focus : band.focus;
            return (
              <Link
                key={band.range}
                href={`/?band=${encodeURIComponent(band.range)}`}
                className="group relative flex min-h-[340px] flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white/75 p-6 shadow-xl shadow-slate-200/40 backdrop-blur transition duration-300 hover:-translate-y-1 hover:border-violet-300/50 hover:bg-white hover:shadow-violet-200/40 dark:border-white/10 dark:bg-white/[0.045] dark:shadow-black/20 dark:hover:border-violet-300/35 dark:hover:bg-white/[0.075] dark:hover:shadow-violet-950/30 sm:p-7"
              >
                <div className="absolute -right-10 -top-10 size-36 rounded-full bg-violet-500/10 blur-3xl transition group-hover:bg-violet-400/20" />
                <div className="relative flex items-center justify-between">
                  <span className="rounded-full border border-violet-300/30 bg-violet-300/10 px-3 py-1 text-xs font-semibold text-violet-700 dark:border-violet-300/20 dark:text-violet-200">{c('lessons')}</span>
                  <span className="text-sm text-slate-500">0{index + 1}</span>
                </div>
                <div className="relative mt-8">
                  <p className="text-sm font-medium text-slate-600 dark:text-slate-400">{level}</p>
                  <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950 dark:text-white">{band.range}</h2>
                  <p className="mt-1 text-sm font-medium text-violet-700 dark:text-violet-200">{title}</p>
                  <p className="mt-4 min-h-[48px] text-sm leading-6 text-slate-600 dark:text-slate-400">{description}</p>
                </div>
                <div className="relative mt-6 grid grid-cols-4 gap-2">
                  {band.skills.map((skill, skillIndex) => {
                    const Icon = SKILL_ICONS[skillIndex]!;
                    return (
                      <span key={skill} className="flex flex-col items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-1 py-2.5 text-[10px] text-slate-600 dark:border-white/[0.06] dark:bg-black/10 dark:text-slate-400">
                        <Icon className="size-4 text-violet-600/80 dark:text-violet-200/80" />{skill}
                      </span>
                    );
                  })}
                </div>
                <p className="relative mt-5 text-xs leading-5 text-slate-500">{focus}</p>
                <div className="relative mt-auto flex items-center justify-between pt-6 text-sm font-semibold text-violet-700 dark:text-violet-200">
                  <span>{c('selectBand')}</span>
                  <ArrowUpRight className="size-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                </div>
              </Link>
            );
          })}
        </div>
        <p className="mt-6 text-center text-xs text-slate-500 dark:text-slate-600">
          {vi ? 'Dải band là mục tiêu luyện tập, không phải kết quả thi IELTS chính thức.' : 'Band ranges are learning targets, not official IELTS scores.'}
        </p>
      </section>
    </main>
  );
}
