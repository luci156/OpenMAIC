/** Product-wide teaching scope and language contract for the English/IELTS web. */
export const ENGLISH_IELTS_SCOPE_PROMPT = [
  '# Product Scope and Language Contract',
  'This product supports only English language learning and IELTS preparation. Keep all tutoring, course creation, classroom conversation, examples, and generated learning materials within that scope. Relevant topics include English grammar, vocabulary, pronunciation, reading, writing, listening, speaking, translation, and IELTS Academic practice across all four skills.',
  'For ordinary conversation in both standard chat and Pro chat, reply in the same language as the user’s latest message: Vietnamese input gets a Vietnamese reply; English input gets an English reply. Do not force English in conversational answers.',
  'Student-facing course lessons and generated learning materials must be written in English, including explanations, examples, exercises, and slides.',
  'If the user asks for help, an answer, or a course about a subject unrelated to English learning or IELTS (for example mathematics, science, or information technology), do not answer that subject, create its course, or use tools to act on it. Briefly explain in the user’s language that this web supports English and IELTS only, and invite an English/IELTS question. In classroom chat, the teacher may be called solely to deliver this scope reminder; do not call other tools for the unrelated request.',
  'Another subject may appear only as context for an English or IELTS learning goal, such as asking for the English vocabulary, translation, pronunciation, or an English reading passage about mathematics or chemistry. Answer the English-learning question without teaching, solving, or expanding the underlying subject. A request to solve a math problem or explain chemistry remains out of scope even if the user asks for the answer in English.',
].join('\n');

/**
 * Deterministic server-side guard for requests that clearly ask the product to
 * teach or create material in another subject. The prompt remains useful for
 * ambiguous cases, but the product boundary must not depend on model obedience.
 */
export function getEnglishIeltsScopeRefusal(text: string): string | null {
  const normalized = text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .toLowerCase();

  const isVietnamese =
    /[ăâđêôơưàáạảãèéẹẻẽìíịỉĩòóọỏõùúụủũỳýỵỷỹ]/i.test(text) ||
    /\b(cho toi|toi muon|hay giup|bai tap|hoc tieng|tieng anh)\b/i.test(normalized);
  const hasEnglishLearningTarget =
    /\b(ielts|english|tieng anh|hoc tieng anh)\b/i.test(normalized);
  const asksForEnglishLearningActivity =
    /\b(vocabulary|word(?:s)?|term(?:s)?|tu vung|ngu phap|grammar|pronunciation|phat am|reading|passage|doan doc|speaking|writing|listening|translate|translation|dich|how do you say|how to say|what is .{1,50} in english|what does .{1,50} mean|la gi|goi la gi)\b/i.test(
      normalized,
    );
  const explicitlyAsksToSolveOtherSubject =
    /\b(solve|calculate|compute|work out|giải (?:bài|phương trình|bất phương trình)|tính (?:giá trị|đáp án)|cho tôi bài tập)\b/i.test(
      normalized,
    );
  const asksForEnglishSubjectMatter =
    (hasEnglishLearningTarget && asksForEnglishLearningActivity) ||
    /\b(translate|translation|dich|what is|how do you say|how to say|la gi|goi la gi)\b.{0,70}\b(math(?:ematics)?|calculus|algebra|geometry|trigonometry|statistics|probability|derivatives?|integrals?|equations?|fractions?|logarithms?|logarit|physics|chemistry|biology|science|computer science|information technology|programming|coding|toan(?: hoc)?|giai tich|dai so|hinh hoc|xac suat|thong ke|dao ham|tich phan|phuong trinh|phan so|hoa hoc|sinh hoc|khoa hoc|tin hoc|cong nghe thong tin|lap trinh)\b.{0,70}\b(vietnamese|tieng viet|english|tieng anh|into vietnamese|sang tieng viet|in vietnamese|la gi|goi la gi)\b/i.test(
      normalized,
    );
  const outsideSubject =
    /\b(math(?:ematics)?|calculus|algebra|geometry|trigonometry|statistics|probability|derivatives?|integrals?|equations?|fractions?|logarithms?|logarithmic|logarit|exponents?|polynomials?|inequalities|matrices|vectors|arithmetic|physics|chemistry|biology|science|computer science|information technology|programming|coding|software|artificial intelligence|machine learning|economics|history|geography|toan(?: hoc)?|giai tich|dai so|hinh hoc|luong giac|xac suat|thong ke|dao ham|tich phan|phuong trinh|phan so|ham so|so mu|da thuc|bat dang thuc|ma tran|vat ly|hoa hoc|dien li|su dien li|mon hoa|sinh hoc|khoa hoc|tin hoc|cong nghe thong tin|lap trinh|lich su|dia ly)\b/i.test(
      normalized,
    );

  // English lessons may use another subject as vocabulary or reading context.
  // Explicit requests to teach/create that other subject remain out of scope.
  if (
    outsideSubject &&
    (!asksForEnglishSubjectMatter || explicitlyAsksToSolveOtherSubject)
  ) {
    return isVietnamese
      ? 'Xin lỗi bạn nhé, mình chỉ có thể hỗ trợ việc học tiếng Anh và luyện IELTS. Nếu muốn, mình có thể giúp bạn học từ vựng tiếng Anh liên quan đến chủ đề này.'
      : 'Sorry, I can only help with English learning and IELTS here. I’d be happy to help you learn English vocabulary related to this topic instead.';
  }
  return null;
}
