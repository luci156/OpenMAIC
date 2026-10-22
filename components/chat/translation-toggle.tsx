'use client';

import { useState } from 'react';
import { Languages, LoaderCircle } from 'lucide-react';
import { useI18n } from '@/lib/hooks/use-i18n';

function sourceLanguage(text: string): 'en' | 'vi' {
  return /[ăâđêôơưáàảãạấầẩẫậắằẳẵặếềểễệốồổỗộớờởỡợứừửữự]/i.test(text) ? 'vi' : 'en';
}

export function TranslationToggle({ text, className }: { text: string; className?: string }) {
  const { locale } = useI18n();
  const [translation, setTranslation] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const source = sourceLanguage(text);
  const target = source === 'vi' ? 'en' : 'vi';
  const ui =
    locale === 'vi-VN'
      ? {
          translateToVietnamese: 'Dịch sang tiếng Việt',
          translateToEnglish: 'Dịch sang tiếng Anh',
          hideTranslation: 'Ẩn bản dịch',
          translationFailed: 'Không dịch được câu trả lời này. Vui lòng thử lại.',
        }
      : {
          translateToVietnamese: 'Translate to Vietnamese',
          translateToEnglish: 'Translate to English',
          hideTranslation: 'Hide translation',
          translationFailed: 'Could not translate this reply. Please try again.',
        };

  const toggle = async () => {
    if (translation) {
      setVisible((current) => !current);
      return;
    }
    if (loading) return;
    setLoading(true);
    setError(false);
    try {
      const response = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, targetLanguage: target }),
      });
      const result = (await response.json()) as { translation?: unknown };
      if (!response.ok || typeof result.translation !== 'string' || !result.translation.trim()) {
        throw new Error('Translation failed');
      }
      setTranslation(result.translation.trim());
      setVisible(true);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={className}>
      <button
        type="button"
        onClick={toggle}
        disabled={loading}
        className="inline-flex items-center gap-1 text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline disabled:opacity-60"
        aria-expanded={visible}
      >
        {loading ? (
          <LoaderCircle size={13} className="animate-spin" aria-hidden="true" />
        ) : (
          <Languages size={13} aria-hidden="true" />
        )}
        {visible
          ? ui.hideTranslation
          : target === 'vi'
            ? ui.translateToVietnamese
            : ui.translateToEnglish}
      </button>
      {error ? (
        <p role="status" className="mt-1 text-xs text-destructive">
          {ui.translationFailed}
        </p>
      ) : null}
      {visible && translation ? (
        <div className="mt-2 whitespace-pre-wrap border-l-2 border-primary/30 pl-3 text-sm text-muted-foreground">
          {translation}
        </div>
      ) : null}
    </div>
  );
}
