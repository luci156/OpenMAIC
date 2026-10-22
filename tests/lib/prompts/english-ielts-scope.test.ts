import { describe, expect, it } from 'vitest';

import { getEnglishIeltsScopeRefusal } from '@/lib/prompts/english-ielts-scope';

describe('English and IELTS product scope', () => {
  it('refuses Vietnamese and English math requests in the same language', () => {
    expect(getEnglishIeltsScopeRefusal('Bây giờ cho tôi bài tập toán đi')).toMatch(
      /chỉ hỗ trợ học tiếng Anh/i,
    );
    expect(
      getEnglishIeltsScopeRefusal('Bây giờ hãy cho tôi bài tập hàm logarit được không'),
    ).toMatch(/chỉ hỗ trợ học tiếng Anh/i);
    expect(getEnglishIeltsScopeRefusal('Teach me calculus')).toMatch(/only help with English/i);
  });

  it('allows English and IELTS requests, including English vocabulary about another subject', () => {
    expect(getEnglishIeltsScopeRefusal('Help me practise IELTS Academic reading')).toBeNull();
    expect(getEnglishIeltsScopeRefusal('Teach me English vocabulary about calculus')).toBeNull();
    expect(getEnglishIeltsScopeRefusal('Translate the word calculus into Vietnamese')).toBeNull();
  });

  it('does not let incidental English words turn an unrelated request into an English lesson', () => {
    expect(
      getEnglishIeltsScopeRefusal('Please answer in English and give me calculus exercises'),
    ).toMatch(/only help with English/i);
  });
});
