'use client';

import { memo, useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { answerIncludesOption } from '@/lib/quiz/grading';
import {
  PieChart,
  CheckCircle2,
  XCircle,
  RotateCcw,
  ChevronRight,
  ChevronLeft,
  Check,
  Volume2,
  VolumeX,
  BookOpenText,
  Loader2,
  Sparkles,
  Timer,
  Triangle,
  Diamond,
  Circle,
  Square,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useI18n } from '@/lib/hooks/use-i18n';
import { createLogger } from '@/lib/logger';

const log = createLogger('QuizView');
import type { QuizQuestion } from '@/lib/types/stage';
import { SpeechButton } from '@/components/audio/speech-button';
import { gradeChoiceQuestions, isShortAnswer, type QuestionResult } from '@/lib/quiz/grading';
import { renderQuizMathText } from '@/lib/quiz/math-text';
import { writeDraftRecovery } from '@/lib/quiz/persistence';
import {
  createQuizAttemptWriter,
  loadQuizAttemptState,
  QuizRetryProgressedError,
  type QuizAttemptWriter,
} from '@/lib/quiz/runtime';
import {
  createQuizViewLifetime,
  isQuizRuntimeReady,
  persistQuizReview,
  persistQuizRetry,
  persistQuizSubmission,
  quizViewStateFromAttempt,
  runQuizPersistenceTransition,
  type QuizRuntimeGate,
  type QuizViewLifetime,
} from '@/lib/quiz/view-state';

const KAHOOT_OPTION_COLORS = [
  'bg-[#e21b3c] hover:bg-[#c81735] text-white',
  'bg-[#1368ce] hover:bg-[#0f57ae] text-white',
  'bg-[#f2c500] hover:bg-[#d9b200] text-[#342900]',
  'bg-[#26890c] hover:bg-[#1f700a] text-white',
];
const KAHOOT_OPTION_SHAPES = [Triangle, Diamond, Circle, Square];
const QUESTION_TIME_LIMIT = 20;

function hasQuizAnswer(answer: string | string[] | undefined): boolean {
  return Array.isArray(answer) ? answer.length > 0 : !!answer?.trim();
}

function KahootFireworks() {
  const { t } = useI18n();
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timeout = setTimeout(() => setVisible(false), 1700);
    return () => clearTimeout(timeout);
  }, []);

  if (!visible) return null;

  const bursts = [
    { left: '22%', top: '34%' },
    { left: '50%', top: '24%' },
    { left: '78%', top: '36%' },
  ];
  const colors = ['#ff4b6e', '#ffd43b', '#37d5ff', '#9b6bff', '#44e28a'];

  return (
    <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden" aria-live="polite">
      {bursts.map((burst, burstIndex) => (
        <div key={burstIndex} className="absolute" style={burst}>
          {Array.from({ length: 12 }, (_, index) => {
            const angle = (Math.PI * 2 * index) / 12;
            const distance = 54 + (index % 3) * 16;
            return (
              <motion.span
                key={index}
                className="absolute block h-2 w-2 rounded-sm"
                style={{
                  left: -4,
                  top: -4,
                  backgroundColor: colors[(index + burstIndex) % colors.length],
                }}
                initial={{ x: 0, y: 0, opacity: 1, scale: 0.4, rotate: 0 }}
                animate={{
                  x: Math.cos(angle) * distance,
                  y: Math.sin(angle) * distance,
                  opacity: 0,
                  scale: 1,
                  rotate: 180 + index * 24,
                }}
                transition={{ duration: 1.1, ease: 'easeOut', delay: burstIndex * 0.08 }}
              />
            );
          })}
        </div>
      ))}
      <motion.div
        initial={{ opacity: 0, scale: 0.7, y: 8 }}
        animate={{ opacity: [0, 1, 1, 0], scale: [0.7, 1.05, 1, 1], y: [8, 0, 0, -8] }}
        transition={{ duration: 1.7, times: [0, 0.18, 0.72, 1] }}
        className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center gap-2 rounded-full bg-emerald-400 px-5 py-3 text-lg font-black text-emerald-950 shadow-xl"
      >
        <Sparkles className="h-5 w-5" /> {t('quiz.correct')}!
      </motion.div>
    </div>
  );
}

function createQuizMusic() {
  const AudioContextConstructor = window.AudioContext;
  if (!AudioContextConstructor) return null;

  try {
    const context = new AudioContextConstructor();
    void context.resume().catch(() => {});
    // An original, lightweight chiptune-style loop. This intentionally does not
    // use or reproduce Kahoot's copyrighted theme recording.
    const notes = [659.25, 783.99, 987.77, 783.99, 880, 1046.5, 783.99, 659.25];
    let noteIndex = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let stopped = false;

    const playNote = () => {
      if (stopped) return;
      if (context.state !== 'running') {
        timer = setTimeout(playNote, 100);
        return;
      }
      const now = context.currentTime;
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = 'triangle';
      oscillator.frequency.value = notes[noteIndex % notes.length];
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.022, now + 0.018);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.19);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(now);
      oscillator.stop(now + 0.2);
      noteIndex += 1;
      timer = setTimeout(playNote, noteIndex % 4 === 0 ? 360 : 260);
    };

    playNote();
    return {
      stop() {
        stopped = true;
        if (timer) clearTimeout(timer);
        void context.close();
      },
    };
  } catch {
    return null;
  }
}

// ─── Types ──────────────────────────────────────────────────────────────────

type Phase = 'not_started' | 'answering' | 'submitting' | 'grading' | 'reviewing';

interface QuizViewProps {
  readonly questions: QuizQuestion[];
  readonly sceneId: string;
  readonly stageId: string;
}

const QuizMathText = memo(function QuizMathText({
  text,
  className,
  allowDisplayMode = false,
}: {
  text: string;
  className?: string;
  allowDisplayMode?: boolean;
}) {
  const segments = useMemo(() => renderQuizMathText(text), [text]);
  if (segments.length === 1 && segments[0].type === 'text') {
    return <span className={className}>{segments[0].value}</span>;
  }

  return (
    <span className={className}>
      {segments.map((segment, index) => {
        if (segment.type === 'text') {
          return <span key={index}>{segment.value}</span>;
        }

        return (
          <span
            key={index}
            className={cn(
              allowDisplayMode && segment.displayMode
                ? 'block my-1 overflow-x-auto [&_.katex-display]:!my-0'
                : 'inline-block align-baseline [&_.katex-display]:!my-0',
            )}
            dangerouslySetInnerHTML={{ __html: segment.html }}
          />
        );
      })}
    </span>
  );
});

/** Call /api/quiz-grade for a single short-answer question. */
async function gradeShortAnswerQuestion(
  q: QuizQuestion,
  userAnswer: string,
  language: string,
): Promise<QuestionResult> {
  const pts = q.points ?? 1;
  try {
    // The server grades with the workspace's classroom model.
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };

    const res = await fetch('/api/quiz-grade', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        question: q.question,
        userAnswer,
        points: pts,
        commentPrompt: q.commentPrompt,
        language,
      }),
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as { score: number; comment: string };
    const earned = Math.max(0, Math.min(pts, data.score));
    return {
      questionId: q.id,
      correct: earned >= pts * 0.8,
      status: earned >= pts * 0.8 ? 'correct' : 'incorrect',
      earned,
      aiComment: data.comment,
    };
  } catch (err) {
    log.error('[quiz-view] AI grading failed for', q.id, err);
    // Fallback: give half credit
    return {
      questionId: q.id,
      correct: null,
      status: 'incorrect',
      earned: Math.round(pts * 0.5),
      aiComment:
        language === 'zh-CN'
          ? '评分服务暂时不可用，已给予基础分。'
          : 'Grading service unavailable. Base score given.',
    };
  }
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function QuizCover({
  questionCount,
  totalPoints,
  onStart,
}: {
  questionCount: number;
  totalPoints: number;
  onStart: () => void;
}) {
  const { t } = useI18n();

  return (
    <div className="w-full h-full flex flex-col items-center justify-center gap-4 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-0 right-0 p-6 opacity-[0.03]">
        <PieChart className="w-52 h-52 text-violet-500" />
      </div>
      <div className="absolute bottom-0 left-0 p-6 opacity-[0.02]">
        <BookOpenText className="w-40 h-40 text-violet-500 rotate-12" />
      </div>

      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 20 }}
        className="w-16 h-16 bg-gradient-to-br from-violet-100 to-purple-50 dark:from-violet-900/50 dark:to-purple-900/30 rounded-2xl flex items-center justify-center shadow-lg shadow-violet-100 dark:shadow-violet-900/30 ring-1 ring-violet-200/50 dark:ring-violet-700/50"
      >
        <PieChart className="w-8 h-8 text-violet-500" />
      </motion.div>

      <motion.div
        initial={{ y: 10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="text-center z-10"
      >
        <h3 className="text-xl font-bold text-white">{t('quiz.title')}</h3>
        <p className="text-sm text-white/75 mt-1">{t('quiz.subtitle')}</p>
      </motion.div>

      <motion.div
        initial={{ y: 10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="flex gap-5 text-sm z-10"
      >
        <div className="flex items-center gap-2 text-white/80">
          <div className="w-7 h-7 rounded-lg bg-white/15 flex items-center justify-center">
            <BookOpenText className="w-3.5 h-3.5 text-white" />
          </div>
          <span>
            {questionCount} {t('quiz.questionsCount')}
          </span>
        </div>
        <div className="flex items-center gap-2 text-white/80">
          <div className="w-7 h-7 rounded-lg bg-white/15 flex items-center justify-center">
            <PieChart className="w-3.5 h-3.5 text-white" />
          </div>
          <span>
            {t('quiz.totalPrefix')} {totalPoints} {t('quiz.pointsSuffix')}
          </span>
        </div>
      </motion.div>

      <motion.button
        initial={{ y: 10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.3 }}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={onStart}
        className="mt-1 px-8 py-2.5 bg-[#1368ce] text-white rounded-xl font-bold shadow-lg hover:bg-[#0f57ae] transition-shadow z-10 flex items-center gap-2"
      >
        {t('quiz.startQuiz')}
        <ChevronRight className="w-4 h-4" />
      </motion.button>
    </div>
  );
}

function SingleChoiceQuestion({
  question,
  index,
  value,
  onChange,
  disabled,
  result,
  gameMode = false,
}: {
  question: QuizQuestion;
  index: number;
  value?: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  result?: QuestionResult;
  gameMode?: boolean;
}) {
  const isReview = !!result;

  return (
    <QuestionCard question={question} index={index} result={result} gameMode={gameMode}>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {question.options?.map((opt, optionIndex) => {
          const OptionShape = KAHOOT_OPTION_SHAPES[optionIndex % KAHOOT_OPTION_SHAPES.length];
          const selected = value === opt.value;
          const isCorrectOpt = isReview && answerIncludesOption(question, opt.value);
          const isWrong = isReview && selected && result?.status === 'incorrect';

          return (
            <button
              key={opt.value}
              disabled={disabled}
              onClick={() => !disabled && onChange(opt.value)}
              className={cn(
                cn(
                  'flex min-h-[76px] items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all text-sm font-semibold',
                  gameMode &&
                    'min-h-[104px] justify-center gap-4 px-5 text-center text-base sm:text-lg',
                ),
                // Default state
                !isReview &&
                  `${KAHOOT_OPTION_COLORS[optionIndex % KAHOOT_OPTION_COLORS.length]} border-transparent shadow-sm hover:-translate-y-0.5 hover:shadow-md`,
                !isReview && selected && 'outline outline-2 outline-white/80 outline-offset-[-4px]',
                // Review states
                isReview &&
                  isCorrectOpt &&
                  'border-emerald-400 bg-emerald-50 dark:bg-emerald-900/30',
                isReview &&
                  isWrong &&
                  !isCorrectOpt &&
                  'border-red-300 bg-red-50 dark:bg-red-900/30',
                isReview &&
                  !isCorrectOpt &&
                  !selected &&
                  'border-gray-100 dark:border-gray-700 opacity-60',
                disabled && !isReview && 'cursor-default',
              )}
            >
              <span
                className={cn(
                  'w-9 h-9 rounded-lg flex items-center justify-center text-sm font-black shrink-0 transition-colors',
                  !isReview && !selected && 'bg-black/15 text-current',
                  !isReview && selected && 'bg-black/15 text-current',
                  isReview && isCorrectOpt && 'bg-emerald-500 text-white',
                  isReview && isWrong && !isCorrectOpt && 'bg-red-400 text-white',
                  isReview &&
                    !isCorrectOpt &&
                    !selected &&
                    'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500',
                )}
              >
                {gameMode ? <OptionShape className="h-5 w-5 fill-current" /> : opt.value}
              </span>
              <span
                className={cn(
                  'flex-1',
                  !isReview && 'text-white',
                  isReview && 'text-gray-800 dark:text-gray-100',
                  isReview && !isCorrectOpt && !selected && 'text-gray-400 dark:text-gray-500',
                )}
              >
                <QuizMathText
                  text={opt.label}
                  className={gameMode ? 'font-bold leading-snug' : undefined}
                />
              </span>
              {isReview && isCorrectOpt && (
                <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
              )}
              {isReview && isWrong && !isCorrectOpt && (
                <XCircle className="w-5 h-5 text-red-400 shrink-0" />
              )}
            </button>
          );
        })}
      </div>
    </QuestionCard>
  );
}

function MultipleChoiceQuestion({
  question,
  index,
  value,
  onChange,
  disabled,
  result,
  gameMode = false,
}: {
  question: QuizQuestion;
  index: number;
  value?: string[];
  onChange: (value: string[]) => void;
  disabled?: boolean;
  result?: QuestionResult;
  gameMode?: boolean;
}) {
  const isReview = !!result;
  const selected = value ?? [];

  const toggle = (optValue: string) => {
    if (disabled) return;
    if (selected.includes(optValue)) {
      onChange(selected.filter((v) => v !== optValue));
    } else {
      onChange([...selected, optValue]);
    }
  };

  const { t } = useI18n();

  return (
    <QuestionCard question={question} index={index} result={result} gameMode={gameMode}>
      {!isReview && (
        <p className="text-xs text-gray-400 dark:text-gray-500 mb-2">
          {t('quiz.multipleChoiceHint')}
        </p>
      )}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {question.options?.map((opt, optionIndex) => {
          const OptionShape = KAHOOT_OPTION_SHAPES[optionIndex % KAHOOT_OPTION_SHAPES.length];
          const isSelected = selected.includes(opt.value);
          const isCorrectOpt = isReview && answerIncludesOption(question, opt.value);
          const isWrong = isReview && isSelected && !isCorrectOpt;

          return (
            <button
              key={opt.value}
              disabled={disabled}
              onClick={() => toggle(opt.value)}
              className={cn(
                cn(
                  'flex min-h-[76px] items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all text-sm font-semibold',
                  gameMode &&
                    'min-h-[104px] justify-center gap-4 px-5 text-center text-base sm:text-lg',
                ),
                !isReview &&
                  `${KAHOOT_OPTION_COLORS[optionIndex % KAHOOT_OPTION_COLORS.length]} border-transparent shadow-sm hover:-translate-y-0.5 hover:shadow-md`,
                !isReview &&
                  isSelected &&
                  'outline outline-2 outline-white/80 outline-offset-[-4px]',
                isReview &&
                  isCorrectOpt &&
                  'border-emerald-400 bg-emerald-50 dark:bg-emerald-900/30',
                isReview && isWrong && 'border-red-300 bg-red-50 dark:bg-red-900/30',
                isReview &&
                  !isCorrectOpt &&
                  !isSelected &&
                  'border-gray-100 dark:border-gray-700 opacity-60',
                disabled && !isReview && 'cursor-default',
              )}
            >
              <span
                className={cn(
                  'w-9 h-9 rounded-lg flex items-center justify-center text-sm font-black shrink-0 transition-colors',
                  !isReview && !isSelected && 'bg-black/15 text-current',
                  !isReview && isSelected && 'bg-black/15 text-current',
                  isReview && isCorrectOpt && 'bg-emerald-500 text-white',
                  isReview && isWrong && 'bg-red-400 text-white',
                  isReview &&
                    !isCorrectOpt &&
                    !isSelected &&
                    'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500',
                )}
              >
                {gameMode && !isReview ? (
                  isSelected ? (
                    <Check className="h-5 w-5" />
                  ) : (
                    <OptionShape className="h-5 w-5 fill-current" />
                  )
                ) : !isReview && isSelected ? (
                  <Check className="w-3.5 h-3.5" />
                ) : (
                  opt.value
                )}
              </span>
              <span
                className={cn(
                  'flex-1',
                  !isReview && 'text-white',
                  isReview && 'text-gray-800 dark:text-gray-100',
                  isReview && !isCorrectOpt && !isSelected && 'text-gray-400 dark:text-gray-500',
                )}
              >
                <QuizMathText
                  text={opt.label}
                  className={gameMode ? 'font-bold leading-snug' : undefined}
                />
              </span>
              {isReview && isCorrectOpt && (
                <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
              )}
              {isReview && isWrong && <XCircle className="w-5 h-5 text-red-400 shrink-0" />}
            </button>
          );
        })}
      </div>
    </QuestionCard>
  );
}

function ShortAnswerQuestion({
  question,
  index,
  value,
  onChange,
  disabled,
  result,
  gameMode = false,
}: {
  question: QuizQuestion;
  index: number;
  value?: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  result?: QuestionResult;
  gameMode?: boolean;
}) {
  const isReview = !!result;
  const { t } = useI18n();
  // Ref to track latest value for voice transcription append
  const valueRef = useRef(value);
  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  return (
    <QuestionCard question={question} index={index} result={result} gameMode={gameMode}>
      {!isReview ? (
        <div className="relative">
          <textarea
            value={value ?? ''}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            placeholder={t('quiz.inputPlaceholder')}
            className="w-full min-h-[100px] p-3 pb-10 rounded-xl border border-gray-200 dark:border-gray-600 text-sm resize-none focus:outline-none focus:border-violet-300 dark:focus:border-violet-600 focus:ring-2 focus:ring-violet-100 dark:focus:ring-violet-900/50 transition-all disabled:bg-gray-50 dark:disabled:bg-gray-800 disabled:text-gray-500 dark:bg-gray-800/50 dark:text-gray-200 dark:placeholder:text-gray-500"
          />
          <SpeechButton
            size="sm"
            disabled={disabled}
            className="absolute bottom-3 left-3"
            onTranscription={(text) => {
              const cur = valueRef.current ?? '';
              onChange(cur + (cur ? ' ' : '') + text);
            }}
          />
          <span className="absolute bottom-3 right-3 text-xs text-gray-300 dark:text-gray-600">
            {(value ?? '').length} {t('quiz.charCount')}
          </span>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700 text-sm text-gray-700 dark:text-gray-300">
            <p className="text-xs text-gray-400 dark:text-gray-500 mb-1">{t('quiz.yourAnswer')}</p>
            {value ? (
              <QuizMathText text={value} />
            ) : (
              <span className="text-gray-400 dark:text-gray-500 italic">
                {t('quiz.notAnswered')}
              </span>
            )}
          </div>
          {result.aiComment && (
            <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-violet-50 dark:bg-violet-900/30 border border-violet-100 dark:border-violet-800">
              <Sparkles className="w-4 h-4 text-violet-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-medium text-violet-600 dark:text-violet-400 mb-0.5">
                  {t('quiz.aiComment')}
                </p>
                <p className="text-xs text-violet-600/80 dark:text-violet-400/80">
                  <QuizMathText text={result.aiComment} />
                </p>
              </div>
              <span className="ml-auto text-xs font-bold text-violet-600 dark:text-violet-400 shrink-0">
                {result.earned}/{question.points ?? 1}
                {t('quiz.pointsSuffix')}
              </span>
            </div>
          )}
        </div>
      )}
    </QuestionCard>
  );
}

function QuestionCard({
  question,
  index,
  result,
  children,
  gameMode = false,
}: {
  question: QuizQuestion;
  index: number;
  result?: QuestionResult;
  children: React.ReactNode;
  gameMode?: boolean;
}) {
  const { t } = useI18n();
  const isReview = !!result;
  const pts = question.points ?? 1;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className={cn(
        'rounded-2xl border p-5 relative overflow-hidden',
        gameMode && !isReview && 'border-white/10 bg-[#1c2a3d] text-white p-5 sm:p-6 shadow-xl',
        !gameMode && 'bg-white dark:bg-gray-800',
        !isReview && !gameMode && 'border-gray-150 dark:border-gray-700 shadow-sm',
        isReview &&
          result.status === 'correct' &&
          'border-emerald-200 dark:border-emerald-800 shadow-sm shadow-emerald-50 dark:shadow-emerald-900/20',
        isReview &&
          result.status === 'incorrect' &&
          'border-red-200 dark:border-red-800 shadow-sm shadow-red-50 dark:shadow-red-900/20',
      )}
    >
      {/* Left accent */}
      <div
        className={cn(
          'absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl',
          !isReview && 'bg-violet-400',
          isReview && result.status === 'correct' && 'bg-emerald-400',
          isReview && result.status === 'incorrect' && 'bg-red-400',
        )}
      />

      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-start gap-3">
          <span
            className={cn(
              'w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0',
              !isReview &&
                !gameMode &&
                'bg-violet-100 dark:bg-violet-900/50 text-violet-600 dark:text-violet-400',
              !isReview && gameMode && 'bg-violet-600/25 text-violet-300',
              isReview &&
                result.status === 'correct' &&
                'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400',
              isReview &&
                result.status === 'incorrect' &&
                'bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-400',
            )}
          >
            {index + 1}
          </span>
          <div>
            <div
              className={cn(
                'leading-relaxed',
                gameMode && !isReview
                  ? 'text-lg font-bold text-white sm:text-xl'
                  : 'text-sm font-medium text-gray-800 dark:text-gray-100',
              )}
            >
              <QuizMathText text={question.question} allowDisplayMode />
            </div>
            <p
              className={cn(
                'text-xs mt-0.5',
                gameMode && !isReview ? 'text-white/55' : 'text-gray-400',
              )}
            >
              {question.type === 'single'
                ? t('quiz.singleChoice')
                : question.type === 'multiple'
                  ? t('quiz.multipleChoice')
                  : t('quiz.shortAnswer')}
              {' · '}
              {pts} {t('quiz.pointsSuffix')}
            </p>
          </div>
        </div>
        {isReview && (
          <div className="shrink-0 ml-2">
            {result.status === 'correct' && <CheckCircle2 className="w-6 h-6 text-emerald-500" />}
            {result.status === 'incorrect' && <XCircle className="w-6 h-6 text-red-400" />}
          </div>
        )}
      </div>

      {/* Body */}
      {children}

      {/* Analysis (review only) */}
      {isReview && question.analysis && (
        <div className="mt-3 p-3 rounded-lg bg-blue-50/70 dark:bg-blue-900/30 border border-blue-100 dark:border-blue-800 text-xs text-blue-700 dark:text-blue-300 leading-relaxed">
          <span className="font-medium">{t('quiz.analysis')}</span>
          <QuizMathText text={question.analysis} allowDisplayMode />
        </div>
      )}
    </motion.div>
  );
}

function ScoreBanner({
  score,
  total,
  results,
}: {
  score: number;
  total: number;
  results: QuestionResult[];
}) {
  const { t } = useI18n();
  const pct = total > 0 ? Math.round((score / total) * 100) : 0;
  const correctCount = results.filter((r) => r.status === 'correct').length;
  const incorrectCount = results.filter((r) => r.status === 'incorrect').length;

  const color = pct >= 80 ? 'emerald' : pct >= 60 ? 'amber' : 'red';
  const colorMap = {
    emerald: {
      bg: 'from-emerald-500 to-teal-500',
      shadow: 'shadow-emerald-200/50 dark:shadow-emerald-900/50',
      ring: 'bg-emerald-400/30',
      text: t('quiz.excellent'),
    },
    amber: {
      bg: 'from-amber-500 to-yellow-500',
      shadow: 'shadow-amber-200/50 dark:shadow-amber-900/50',
      ring: 'bg-amber-400/30',
      text: t('quiz.keepGoing'),
    },
    red: {
      bg: 'from-red-500 to-rose-500',
      shadow: 'shadow-red-200/50 dark:shadow-red-900/50',
      ring: 'bg-red-400/30',
      text: t('quiz.needsReview'),
    },
  };
  const c = colorMap[color];

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className={cn('rounded-2xl p-6 bg-gradient-to-r text-white shadow-lg', c.bg, c.shadow)}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-white/80 text-sm font-medium">{c.text}</p>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-4xl font-black">{score}</span>
            <span className="text-white/60 text-lg">/ {total}</span>
          </div>
          <div className="flex gap-3 mt-3 text-xs">
            <span className="flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> {correctCount} {t('quiz.correct')}
            </span>
            <span className="flex items-center gap-1">
              <XCircle className="w-3.5 h-3.5" /> {incorrectCount} {t('quiz.incorrect')}
            </span>
          </div>
        </div>

        {/* Percentage ring */}
        <div className="relative w-20 h-20">
          <svg className="w-20 h-20 -rotate-90" viewBox="0 0 80 80">
            <circle
              cx="40"
              cy="40"
              r="34"
              fill="none"
              stroke="rgba(255,255,255,0.2)"
              strokeWidth="6"
            />
            <motion.circle
              cx="40"
              cy="40"
              r="34"
              fill="none"
              stroke="white"
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={`${2 * Math.PI * 34}`}
              initial={{ strokeDashoffset: 2 * Math.PI * 34 }}
              animate={{ strokeDashoffset: 2 * Math.PI * 34 * (1 - pct / 100) }}
              transition={{ duration: 1, ease: 'easeOut', delay: 0.3 }}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-lg font-black">{pct}%</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────

export function QuizView({ questions, sceneId, stageId }: QuizViewProps) {
  const { t, locale } = useI18n();

  const [phase, setPhase] = useState<Phase>('not_started');
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const [results, setResults] = useState<QuestionResult[]>([]);
  const [activeQuestionIndex, setActiveQuestionIndex] = useState(0);
  const [secondsRemaining, setSecondsRemaining] = useState(QUESTION_TIME_LIMIT);
  const [timedOutQuestions, setTimedOutQuestions] = useState<Record<string, boolean>>({});
  const [celebrationNonce, setCelebrationNonce] = useState(0);
  const [musicEnabled, setMusicEnabled] = useState(true);
  const [runtimeGate, setRuntimeGate] = useState<QuizRuntimeGate>({ status: 'loading' });
  const [hydrationVersion, setHydrationVersion] = useState(0);
  const [retrying, setRetrying] = useState(false);
  const answersRef = useRef(answers);
  answersRef.current = answers;
  const questionsRef = useRef(questions);
  questionsRef.current = questions;
  const viewLifetimeRef = useRef<QuizViewLifetime | null>(null);
  viewLifetimeRef.current ??= createQuizViewLifetime();
  const viewLifetime = viewLifetimeRef.current;
  const runtimeWriterRef = useRef<QuizAttemptWriter | null>(null);
  runtimeWriterRef.current ??= createQuizAttemptWriter({
    onError: (error) => log.warn('Failed to persist quiz runtime:', error),
  });
  const runtimeWriter = runtimeWriterRef.current;
  const quizMusicRef = useRef<{ stop: () => void } | null>(null);

  const stopQuizMusic = useCallback(() => {
    quizMusicRef.current?.stop();
    quizMusicRef.current = null;
  }, []);

  useEffect(() => () => stopQuizMusic(), [stopQuizMusic]);

  useEffect(() => {
    return () => {
      void runtimeWriter.flushDraft();
    };
  }, [runtimeWriter]);

  useEffect(() => {
    let cancelled = false;
    setRuntimeGate({ status: 'loading' });
    setRetrying(false);
    void loadQuizAttemptState({ stageId, sceneId })
      .then(({ attemptId: nextAttemptId, state }) => {
        if (cancelled) return;
        const next = quizViewStateFromAttempt(state);
        setPhase(next.phase);
        setAnswers(next.answers);
        setResults(next.results);
        setTimedOutQuestions({});
        setMusicEnabled(next.phase !== 'answering');
        const firstUnanswered = questionsRef.current.findIndex(
          (question) => !hasQuizAnswer(next.answers[question.id]),
        );
        setActiveQuestionIndex(firstUnanswered < 0 ? 0 : firstUnanswered);
        setRuntimeGate({ status: 'ready', attemptId: nextAttemptId });
      })
      .catch((error) => {
        log.warn('Failed to hydrate quiz runtime:', error);
        if (!cancelled) setRuntimeGate({ status: 'error' });
      });
    return () => {
      cancelled = true;
      viewLifetime.invalidate();
      void runtimeWriter.flushDraft();
    };
  }, [hydrationVersion, runtimeWriter, sceneId, stageId, viewLifetime]);

  const attemptId = isQuizRuntimeReady(runtimeGate) ? runtimeGate.attemptId : null;

  const totalPoints = useMemo(
    () => questions.reduce((sum, q) => sum + (q.points ?? 1), 0),
    [questions],
  );

  const activeQuestion = questions[activeQuestionIndex];
  const currentQuestionAnswered = activeQuestion
    ? hasQuizAnswer(answers[activeQuestion.id])
    : false;
  const currentQuestionTimedOut = activeQuestion ? !!timedOutQuestions[activeQuestion.id] : false;
  const currentQuestionResult = activeQuestion
    ? results.find((result) => result.questionId === activeQuestion.id)
    : undefined;
  const currentQuestionSettled = !!currentQuestionResult || currentQuestionTimedOut;
  const allQuestionsSettled = questions.every(
    (question) =>
      (question.type === 'short_answer'
        ? hasQuizAnswer(answers[question.id])
        : results.some((result) => result.questionId === question.id)) ||
      !!timedOutQuestions[question.id],
  );

  useEffect(() => {
    if (
      phase !== 'answering' ||
      !activeQuestion ||
      currentQuestionSettled ||
      (activeQuestion.type === 'short_answer' && currentQuestionAnswered)
    ) {
      return;
    }

    const startedAt = Date.now();
    setSecondsRemaining(QUESTION_TIME_LIMIT);
    const timer = setInterval(() => {
      const remaining = Math.max(
        0,
        QUESTION_TIME_LIMIT - Math.floor((Date.now() - startedAt) / 1000),
      );
      setSecondsRemaining(remaining);
      if (remaining === 0) {
        clearInterval(timer);
        setTimedOutQuestions((previous) => ({ ...previous, [activeQuestion.id]: true }));
        if (activeQuestion.type !== 'short_answer') {
          const result = gradeChoiceQuestions([activeQuestion], {
            [activeQuestion.id]: answersRef.current[activeQuestion.id] ?? '',
          })[0];
          setResults((previous) => [
            ...previous.filter((item) => item.questionId !== activeQuestion.id),
            result,
          ]);
          if (result.correct) setCelebrationNonce((nonce) => nonce + 1);
        }
      }
    }, 250);

    return () => clearInterval(timer);
  }, [phase, activeQuestion, currentQuestionAnswered, currentQuestionSettled]);

  const handleSetAnswer = useCallback(
    (questionId: string, value: string | string[]) => {
      setAnswers((prev) => {
        const next = { ...prev, [questionId]: value };
        if (attemptId) {
          writeDraftRecovery(sceneId, attemptId, next);
          runtimeWriter.scheduleDraft({
            stageId,
            sceneId,
            attemptId,
            answers: next,
          });
        }
        return next;
      });
    },
    [attemptId, runtimeWriter, sceneId, stageId],
  );

  const handleCheckCurrentChoice = useCallback(() => {
    if (
      !activeQuestion ||
      activeQuestion.type === 'short_answer' ||
      currentQuestionSettled ||
      !hasQuizAnswer(answers[activeQuestion.id])
    ) {
      return;
    }
    const result = gradeChoiceQuestions([activeQuestion], answers)[0];
    if (!result) return;
    setResults((previous) => [
      ...previous.filter((item) => item.questionId !== activeQuestion.id),
      result,
    ]);
    if (result.correct) setCelebrationNonce((nonce) => nonce + 1);
  }, [activeQuestion, answers, currentQuestionSettled]);

  const handleSubmit = useCallback(async () => {
    if (!attemptId) return;
    stopQuizMusic();
    setPhase('submitting');
    await runQuizPersistenceTransition(
      () => persistQuizSubmission({ stageId, sceneId, attemptId, answers }, runtimeWriter),
      viewLifetime,
      () => setPhase('grading'),
      (error) => {
        log.warn('Failed to persist quiz submission:', error);
        setRuntimeGate({ status: 'error' });
      },
    );
  }, [attemptId, answers, runtimeWriter, sceneId, stageId, viewLifetime, stopQuizMusic]);

  // When entering grading phase, grade choice questions locally + call API for short-answer
  useEffect(() => {
    if (phase !== 'grading') return;
    let cancelled = false;

    (async () => {
      // 1. Grade choice questions locally (instant)
      const choiceResults = gradeChoiceQuestions(questions, answers);

      // 2. Grade short-answer questions via AI API (parallel)
      const shortAnswerQs = questions.filter(isShortAnswer);
      const aiResults = await Promise.all(
        shortAnswerQs.map((q) =>
          gradeShortAnswerQuestion(q, (answers[q.id] as string) ?? '', locale),
        ),
      );

      if (cancelled) return;

      // 3. Merge results in original question order
      const allResultsMap = new Map<string, QuestionResult>();
      for (const r of [...choiceResults, ...aiResults]) {
        allResultsMap.set(r.questionId, r);
      }
      const ordered = questions.map((q) => allResultsMap.get(q.id)!).filter(Boolean);

      if (!attemptId) {
        setRuntimeGate({ status: 'error' });
        return;
      }
      try {
        await persistQuizReview(
          { stageId, sceneId, attemptId, answers, results: ordered },
          runtimeWriter,
        );
      } catch (error) {
        log.warn('Failed to persist quiz review:', error);
        if (!cancelled) setRuntimeGate({ status: 'error' });
        return;
      }
      if (cancelled) return;
      setResults(ordered);
      setPhase('reviewing');
    })();

    return () => {
      cancelled = true;
    };
  }, [phase, questions, answers, locale, sceneId, stageId, attemptId, runtimeWriter]);

  const handleRetry = useCallback(async () => {
    if (!attemptId || retrying) return;
    setRetrying(true);
    runtimeWriter.cancelDraft();
    await runQuizPersistenceTransition(
      () => persistQuizRetry({ stageId, sceneId, attemptId }, runtimeWriter),
      viewLifetime,
      () => {
        stopQuizMusic();
        setPhase('not_started');
        setActiveQuestionIndex(0);
        setAnswers({});
        setResults([]);
        setTimedOutQuestions({});
        setCelebrationNonce(0);
        setRetrying(false);
      },
      (error) => {
        log.warn('Failed to persist quiz retry:', error);
        setRetrying(false);
        if (error instanceof QuizRetryProgressedError) {
          setHydrationVersion((version) => version + 1);
          return;
        }
        setRuntimeGate({ status: 'error' });
      },
    );
  }, [attemptId, retrying, runtimeWriter, sceneId, stageId, viewLifetime, stopQuizMusic]);

  const handleStart = useCallback(() => {
    if (musicEnabled) quizMusicRef.current = createQuizMusic();
    setPhase('answering');
  }, [musicEnabled]);

  const toggleMusic = useCallback(() => {
    if (musicEnabled) {
      stopQuizMusic();
      setMusicEnabled(false);
      return;
    }
    if (phase === 'answering') quizMusicRef.current = createQuizMusic();
    setMusicEnabled(true);
  }, [musicEnabled, phase, stopQuizMusic]);

  const earnedScore = useMemo(() => results.reduce((sum, r) => sum + r.earned, 0), [results]);

  const resultMap = useMemo(() => {
    const map: Record<string, QuestionResult> = {};
    results.forEach((r) => {
      map[r.questionId] = r;
    });
    return map;
  }, [results]);

  if (runtimeGate.status === 'error') {
    return (
      <div className="flex h-full w-full items-center justify-center bg-gray-50 dark:bg-gray-900">
        <button
          type="button"
          onClick={() => setHydrationVersion((version) => version + 1)}
          className="flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-violet-700"
        >
          <RotateCcw className="h-4 w-4" />
          {t('quiz.retry')}
        </button>
      </div>
    );
  }

  if (!isQuizRuntimeReady(runtimeGate)) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-gray-50 dark:bg-gray-900">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="w-full h-full bg-[#101827] text-white overflow-hidden flex flex-col">
      <AnimatePresence mode="wait">
        {phase === 'not_started' && (
          <motion.div
            key="cover"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, x: -20 }}
            className="flex-1"
          >
            <QuizCover
              questionCount={questions.length}
              totalPoints={totalPoints}
              onStart={handleStart}
            />
          </motion.div>
        )}

        {phase === 'answering' && (
          <motion.div
            key="answering"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="relative flex min-h-0 flex-1 items-center justify-center p-2 sm:p-4"
          >
            <div className="flex h-full max-h-[780px] min-h-0 w-full max-w-[960px] flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#111b2d] shadow-2xl shadow-black/30">
              <div className="shrink-0 border-b border-white/10 bg-[#101827]">
                <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="flex items-center gap-2 font-bold text-white">
                      <span className="h-2 w-2 animate-pulse rounded-full bg-violet-400" />
                      {t('quiz.answering')}
                    </span>
                    <span className="text-white/50">
                      {activeQuestionIndex + 1} / {questions.length}
                    </span>
                    <span className="rounded-full bg-amber-500/20 px-3 py-1 font-bold text-amber-200">
                      {earnedScore} {t('quiz.pointsSuffix')}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        'flex min-w-[76px] items-center justify-center gap-1.5 rounded-xl bg-white/10 px-3 py-1.5 text-xl font-black tabular-nums',
                        secondsRemaining <= 5 &&
                          !currentQuestionResult &&
                          'bg-red-500/20 text-red-200',
                      )}
                    >
                      <Timer className="h-4 w-4" /> {secondsRemaining}s
                    </span>
                    <button
                      type="button"
                      onClick={toggleMusic}
                      aria-label={musicEnabled ? t('quiz.muteMusic') : t('quiz.enableMusic')}
                      title={musicEnabled ? t('quiz.muteMusic') : t('quiz.enableMusic')}
                      className="rounded-full p-2 text-white/80 transition hover:bg-white/10 hover:text-white"
                    >
                      {musicEnabled ? (
                        <Volume2 className="h-5 w-5" />
                      ) : (
                        <VolumeX className="h-5 w-5" />
                      )}
                    </button>
                  </div>
                </div>
                <div
                  className="h-2 w-full bg-white/10"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={questions.length}
                  aria-valuenow={activeQuestionIndex + (currentQuestionAnswered ? 1 : 0)}
                >
                  <div
                    className="h-full bg-gradient-to-r from-violet-500 via-fuchsia-500 to-amber-400 transition-all duration-300"
                    style={{
                      width: `${questions.length ? ((activeQuestionIndex + (currentQuestionAnswered ? 1 : 0)) / questions.length) * 100 : 0}%`,
                    }}
                  />
                </div>
                <div className="h-1 w-full bg-white/5" aria-hidden="true">
                  <div
                    className={cn(
                      'h-full transition-[width,background-color] duration-200',
                      secondsRemaining <= 5 ? 'bg-red-400' : 'bg-amber-300',
                    )}
                    style={{ width: `${(secondsRemaining / QUESTION_TIME_LIMIT) * 100}%` }}
                  />
                </div>
              </div>

              <div className="flex min-h-0 flex-1 items-center justify-center overflow-y-auto bg-[#1a2739] p-3 sm:p-6">
                {activeQuestion && (
                  <div className="my-auto w-full max-w-[800px]">
                    {activeQuestion.type === 'single' ? (
                      <SingleChoiceQuestion
                        key={activeQuestion.id}
                        question={activeQuestion}
                        index={activeQuestionIndex}
                        value={answers[activeQuestion.id] as string | undefined}
                        onChange={(v) => handleSetAnswer(activeQuestion.id, v)}
                        disabled={currentQuestionSettled}
                        result={currentQuestionResult}
                        gameMode
                      />
                    ) : activeQuestion.type === 'multiple' ? (
                      <MultipleChoiceQuestion
                        key={activeQuestion.id}
                        question={activeQuestion}
                        index={activeQuestionIndex}
                        value={answers[activeQuestion.id] as string[] | undefined}
                        onChange={(v) => handleSetAnswer(activeQuestion.id, v)}
                        disabled={currentQuestionSettled}
                        result={currentQuestionResult}
                        gameMode
                      />
                    ) : (
                      <ShortAnswerQuestion
                        key={activeQuestion.id}
                        question={activeQuestion}
                        index={activeQuestionIndex}
                        value={answers[activeQuestion.id] as string | undefined}
                        onChange={(v) => handleSetAnswer(activeQuestion.id, v)}
                        disabled={currentQuestionSettled}
                        gameMode
                      />
                    )}
                  </div>
                )}
              </div>

              <div className="flex shrink-0 items-center justify-between gap-3 border-t border-white/10 bg-[#080e1d] px-3 py-3 sm:px-6">
                <button
                  type="button"
                  onClick={() => setActiveQuestionIndex((index) => Math.max(0, index - 1))}
                  disabled={activeQuestionIndex === 0}
                  className="flex items-center gap-1.5 rounded-lg px-3 py-2.5 text-sm font-bold text-white/75 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-35 sm:px-4"
                >
                  <ChevronLeft className="h-4 w-4" />{' '}
                  <span className="hidden sm:inline">{t('quiz.previousQuestion')}</span>
                </button>
                <div className="flex min-w-0 flex-1 items-center justify-center gap-1.5 overflow-x-auto px-1 sm:gap-2">
                  {questions.map((question, index) => {
                    const settled =
                      results.some((result) => result.questionId === question.id) ||
                      (question.type === 'short_answer' && hasQuizAnswer(answers[question.id])) ||
                      !!timedOutQuestions[question.id];
                    return (
                      <button
                        key={question.id}
                        type="button"
                        onClick={() => setActiveQuestionIndex(index)}
                        aria-label={`${index + 1} / ${questions.length}`}
                        aria-current={index === activeQuestionIndex ? 'step' : undefined}
                        className={cn(
                          'h-2.5 w-2.5 shrink-0 rounded-full transition-all',
                          index === activeQuestionIndex
                            ? 'h-3.5 w-3.5 bg-violet-400 ring-2 ring-violet-300/30'
                            : settled
                              ? 'bg-violet-400/70'
                              : 'bg-white/25 hover:bg-white/50',
                        )}
                      />
                    );
                  })}
                </div>
                {activeQuestion &&
                activeQuestion.type !== 'short_answer' &&
                !currentQuestionResult &&
                !currentQuestionTimedOut ? (
                  <button
                    type="button"
                    onClick={handleCheckCurrentChoice}
                    disabled={!currentQuestionAnswered}
                    className="flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-[#151b2a] shadow-md transition hover:bg-violet-100 disabled:cursor-not-allowed disabled:opacity-40 sm:px-6"
                  >
                    {t('quiz.checkAnswer')} <Check className="h-4 w-4" />
                  </button>
                ) : activeQuestionIndex === questions.length - 1 ? (
                  <button
                    type="button"
                    onClick={() => void handleSubmit()}
                    disabled={!allQuestionsSettled}
                    className="flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-[#151b2a] shadow-md transition hover:bg-violet-100 disabled:cursor-not-allowed disabled:opacity-40 sm:px-6"
                  >
                    {t('quiz.submitAnswers')} <Check className="h-4 w-4" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() =>
                      setActiveQuestionIndex((index) => Math.min(questions.length - 1, index + 1))
                    }
                    disabled={
                      activeQuestion?.type === 'short_answer'
                        ? !currentQuestionAnswered && !currentQuestionTimedOut
                        : !currentQuestionResult && !currentQuestionTimedOut
                    }
                    className="flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-[#151b2a] shadow-md transition hover:bg-violet-100 disabled:cursor-not-allowed disabled:opacity-40 sm:px-6"
                  >
                    {t('quiz.nextQuestion')} <ChevronRight className="h-4 w-4" />
                  </button>
                )}
              </div>
              {celebrationNonce > 0 && <KahootFireworks key={celebrationNonce} />}
            </div>
          </motion.div>
        )}

        {(phase === 'submitting' || phase === 'grading') && (
          <motion.div
            key="grading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex-1 flex flex-col items-center justify-center gap-5 text-white"
          >
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 1.5, ease: 'linear' }}
            >
              <Loader2 className="w-10 h-10 text-violet-500" />
            </motion.div>
            <div className="text-center">
              <p className="text-base font-semibold text-white">{t('quiz.aiGrading')}</p>
              <p className="text-sm text-white/70 mt-1">{t('quiz.aiGradingWait')}</p>
            </div>
            <div className="flex gap-1 mt-2">
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  className="w-2 h-2 rounded-full bg-violet-400"
                  animate={{ opacity: [0.3, 1, 0.3] }}
                  transition={{
                    repeat: Infinity,
                    duration: 1.2,
                    delay: i * 0.2,
                  }}
                />
              ))}
            </div>
          </motion.div>
        )}

        {phase === 'reviewing' && (
          <motion.div
            key="reviewing"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex-1 flex flex-col min-h-0"
          >
            {/* Header bar */}
            <div className="flex items-center justify-between px-6 py-3 border-b border-gray-100 dark:border-gray-700 bg-white/80 dark:bg-gray-900/80 backdrop-blur shrink-0">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                  {t('quiz.quizReport')}
                </span>
              </div>
              <button
                type="button"
                onClick={() => void handleRetry()}
                disabled={retrying}
                className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 hover:text-violet-600 dark:hover:text-violet-400 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                {t('quiz.retry')}
              </button>
            </div>

            {/* Results */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              <ScoreBanner score={earnedScore} total={totalPoints} results={results} />

              {questions.map((q, i) => {
                const r = resultMap[q.id];
                if (q.type === 'single') {
                  return (
                    <SingleChoiceQuestion
                      key={q.id}
                      question={q}
                      index={i}
                      value={answers[q.id] as string | undefined}
                      onChange={() => {}}
                      disabled
                      result={r}
                    />
                  );
                }
                if (q.type === 'multiple') {
                  return (
                    <MultipleChoiceQuestion
                      key={q.id}
                      question={q}
                      index={i}
                      value={answers[q.id] as string[] | undefined}
                      onChange={() => {}}
                      disabled
                      result={r}
                    />
                  );
                }
                return (
                  <ShortAnswerQuestion
                    key={q.id}
                    question={q}
                    index={i}
                    value={answers[q.id] as string | undefined}
                    onChange={() => {}}
                    disabled
                    result={r}
                  />
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
