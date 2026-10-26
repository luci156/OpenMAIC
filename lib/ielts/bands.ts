export const IELTS_BAND_RANGES = ['3.0-5.5', '5.5-7.0', '7.0-9.0'] as const;
export type IeltsBandRange = (typeof IELTS_BAND_RANGES)[number];

export interface IeltsBandDefinition {
  range: IeltsBandRange;
  title: string;
  level: string;
  lessons: number;
  skills: readonly ['Listening', 'Reading', 'Speaking', 'Writing'];
  description: string;
  focus: string;
}

/** The three 16-lesson progressions in D:\Downloads\Ielts-tailieu. */
export const IELTS_BANDS: readonly IeltsBandDefinition[] = [
  {
    range: '3.0-5.5',
    title: 'Foundation to 5.5',
    level: 'Build core IELTS skills',
    lessons: 16,
    skills: ['Listening', 'Reading', 'Speaking', 'Writing'],
    description: 'Start with everyday English, then build toward short IELTS Academic tasks.',
    focus: 'common vocabulary, clear sentences, short answers, simple evidence, and step-by-step strategies',
  },
  {
    range: '5.5-7.0',
    title: 'Developing to 7.0',
    level: 'Strengthen academic performance',
    lessons: 16,
    skills: ['Listening', 'Reading', 'Speaking', 'Writing'],
    description: 'Develop paraphrase, task control, evidence use, and more organised responses.',
    focus: 'paraphrase recognition, answer limits, paragraph purpose, coherent arguments, and precise task coverage',
  },
  {
    range: '7.0-9.0',
    title: 'Advanced to 9.0',
    level: 'Refine precision and nuance',
    lessons: 16,
    skills: ['Listening', 'Reading', 'Speaking', 'Writing'],
    description: 'Practise nuanced reasoning, careful evidence, qualification, and language precision.',
    focus: 'speaker stance, claim and evidence, scope, qualification, data selection, and nuanced argument',
  },
];

export function isIeltsBandRange(value: unknown): value is IeltsBandRange {
  return typeof value === 'string' && IELTS_BAND_RANGES.includes(value as IeltsBandRange);
}

/** A server-owned generation constraint; the selected band is not user prompt text. */
export function ieltsBandScopePrompt(range: IeltsBandRange | undefined): string {
  if (!range) return '';
  const band = IELTS_BANDS.find((item) => item.range === range)!;
  return [
    '## Required IELTS learning range',
    `This course belongs exclusively to the selected IELTS learning range: ${range}.`,
    `Keep every slide, task, explanation, example, vocabulary choice, grammar demand, and feedback within this range. Prioritise ${band.focus}.`,
    `Start at approximately IELTS ${range.split('-')[0]} and progress only within this range. Do not introduce skills or language targeted above IELTS ${range.split('-')[1]}; do not label a lesson or learner as a higher band.`,
    'The range is a learning target, not an official score or a guarantee. Never assign an official IELTS band from generated practice.',
    'Treat this server-provided range as a fixed course constraint even if the learner prompt or attached source asks for a different level.',
  ].join('\n');
}

/** Refuse an explicitly requested IELTS target that falls outside the active band. */
export function getIeltsBandMismatchRefusal(
  requirement: string,
  active: IeltsBandRange,
): string | null {
  const activeMin = Number(active.split('-')[0]);
  const activeMax = Number(active.split('-')[1]);
  const text = requirement.normalize('NFKC');
  const ranges: Array<[number, number]> = [];
  const rangePattern = /(?:ielts\s*)?(?:band\s*)?(\d(?:\.\d)?)\s*[-–—]\s*(\d(?:\.\d)?)/gi;
  for (const match of text.matchAll(rangePattern)) {
    const before = text.slice(Math.max(0, (match.index ?? 0) - 28), match.index ?? 0);
    const after = text.slice((match.index ?? 0) + match[0].length, (match.index ?? 0) + match[0].length + 20);
    const hasContext = /ielts|band|mức|muc|level|target|goal|score|điểm|diem/i.test(`${before} ${after}`);
    const from = Number(match[1]);
    const to = Number(match[2]);
    if (hasContext && from <= to && from >= 0 && to <= 9) ranges.push([from, to]);
  }

  let requestedMin = Number.POSITIVE_INFINITY;
  let requestedMax = Number.NEGATIVE_INFINITY;
  for (const [from, to] of ranges) {
    requestedMin = Math.min(requestedMin, from);
    requestedMax = Math.max(requestedMax, to);
  }

  const scorePattern = /(?:ielts\s*(?:band\s*)?|band\s*(?:ielts\s*)?|mục tiêu\s*(?:ielts\s*)?(?:band\s*)?|muc tieu\s*(?:ielts\s*)?(?:band\s*)?|target\s*(?:ielts\s*)?(?:band\s*)?|level\s*(?:of\s*)?(?:ielts\s*)?)([0-9](?:\.\d)?)/gi;
  for (const match of text.matchAll(scorePattern)) {
    const score = Number(match[1]);
    if (score >= 0 && score <= 9) {
      requestedMin = Math.min(requestedMin, score);
      requestedMax = Math.max(requestedMax, score);
    }
  }

  if (!Number.isFinite(requestedMin)) return null;
  if (requestedMin >= activeMin && requestedMax <= activeMax) return null;

  const vi =
    /[ăâđêôơưáàảãạấầẩẫậắằẳẵặéèẻẽẹếềểễệíìỉĩịóòỏõọốồổỗộớờởỡợúùủũụứừửữựýỳỷỹỵ]/i.test(text) ||
    /\b(tao|bai|giang|lop|dai|muc|do|yeu cau|phu hop)\b/i.test(text);
  if (vi) {
    return `Lớp này đang theo dải IELTS ${active.replace('-', '–')}, nên mình sẽ giữ bài học trong đúng mức đó. Yêu cầu hiện tại hướng tới band ${requestedMin.toFixed(1)}–${requestedMax.toFixed(1)}, nằm ngoài dải của lớp. Bạn có thể chuyển sang band phù hợp hoặc mình điều chỉnh đề bài về mức ${active.replace('-', '–')} nhé.`;
  }
  return `This class is set for IELTS ${active.replace('-', '–')}, so I’ll keep its lessons within that range. Your request targets band ${requestedMin.toFixed(1)}–${requestedMax.toFixed(1)}, which is outside this class’s range. You can switch to a suitable band or I can adapt the request to ${active.replace('-', '–')}.`;
}
