import { describe, expect, it } from 'vitest';

import { getEnglishIeltsScopeRefusal } from '@/lib/prompts/english-ielts-scope';

describe('English and IELTS product scope', () => {
  it('refuses Vietnamese and English math requests in the same language', () => {
    expect(getEnglishIeltsScopeRefusal('Bây giờ cho tôi bài tập toán đi')).toMatch(
      /xin lỗi.*tiếng Anh/i,
    );
    expect(
      getEnglishIeltsScopeRefusal('Bây giờ hãy cho tôi bài tập hàm logarit được không'),
    ).toMatch(/xin lỗi.*tiếng Anh/i);
    expect(getEnglishIeltsScopeRefusal('Teach me calculus')).toMatch(/sorry.*English/i);
    expect(
      getEnglishIeltsScopeRefusal('Cho tôi các từ vựng liên quan đến toán học'),
    ).toMatch(/xin lỗi.*tiếng Anh/i);
    expect(getEnglishIeltsScopeRefusal('Giải thích sự điện li trong môn hóa')).toMatch(
      /xin lỗi.*tiếng Anh/i,
    );
    expect(
      getEnglishIeltsScopeRefusal('Please answer in English and solve this probability problem'),
    ).toMatch(/sorry.*English/i);
  });

  it('allows English and IELTS requests, including English vocabulary about another subject', () => {
    expect(getEnglishIeltsScopeRefusal('Help me practise IELTS Academic reading')).toBeNull();
    expect(getEnglishIeltsScopeRefusal('Teach me English vocabulary about calculus')).toBeNull();
    expect(getEnglishIeltsScopeRefusal('Translate the word calculus into Vietnamese')).toBeNull();
    expect(
      getEnglishIeltsScopeRefusal('Cho tôi các từ vựng liên quan đến toán học bằng tiếng Anh được không'),
    ).toBeNull();
    expect(getEnglishIeltsScopeRefusal('Thế bình phương tiếng Anh là gì')).toBeNull();
    expect(getEnglishIeltsScopeRefusal('Teach me English vocabulary about electrolysis')).toBeNull();
    expect(
      getEnglishIeltsScopeRefusal(
        'Teach me English vocabulary about calculus and solve this equation',
      ),
    ).toMatch(/sorry.*English/i);
  });

  it('does not let incidental English words turn an unrelated request into an English lesson', () => {
    expect(
      getEnglishIeltsScopeRefusal('Please answer in English and give me calculus exercises'),
    ).toMatch(/sorry.*English/i);
  });
});
