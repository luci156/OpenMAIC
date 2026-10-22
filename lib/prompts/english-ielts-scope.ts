/** Product-wide teaching scope and language contract for the English/IELTS web. */
export const ENGLISH_IELTS_SCOPE_PROMPT = [
  '# Product Scope and Language Contract',
  'This product supports only English language learning and IELTS preparation. Keep all tutoring, course creation, classroom conversation, examples, and generated learning materials within that scope. Relevant topics include English grammar, vocabulary, pronunciation, reading, writing, listening, speaking, translation, and IELTS Academic practice across all four skills.',
  'For ordinary conversation in both standard chat and Pro chat, reply in the same language as the user’s latest message: Vietnamese input gets a Vietnamese reply; English input gets an English reply. Do not force English in conversational answers.',
  'Student-facing course lessons and generated learning materials must be written in English, including explanations, examples, exercises, and slides.',
  'If the user asks for help, an answer, or a course about a subject unrelated to English learning or IELTS (for example mathematics, science, or information technology), do not answer that subject, create its course, or use tools to act on it. Briefly explain in the user’s language that this web supports English and IELTS only, and invite an English/IELTS question. In classroom chat, the teacher may be called solely to deliver this scope reminder; do not call other tools for the unrelated request.',
  'A request about another subject is still in scope only when the actual learning goal is English or IELTS (for example, learning English vocabulary about science). Do not treat incidental English words as sufficient; the learning goal itself must be English or IELTS.',
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
  const explicitlyAboutEnglish =
    /\b(ielts|english|tieng anh|hoc tieng anh|tu vung|ngu phap|phat am|luyen nghe|luyen noi|luyen doc|luyen viet|translate|translation|dich sang tieng anh)\b/i.test(
      normalized,
    );
  const asksForEnglishSubjectMatter =
    /\b(english|tieng anh|ielts)\b.{0,50}\b(about|vocabulary|words|passage|reading|listening|speaking|writing|ve|tu vung|doan doc)\b/i.test(
      normalized,
    ) ||
    /\b(about|ve)\b.{0,50}\b(english vocabulary|tu vung tieng anh|ielts passage|english passage)\b/i.test(
      normalized,
    );
  const asksForTranslationOfSubjectTerm =
    /\b(translate|translation|dich|meaning|definition|define|what does|nghia cua)\b.{0,70}\b(math(?:ematics)?|calculus|algebra|geometry|toan|giai tich|dai so|logarithms?|logarit)\b/i.test(
      normalized,
    ) &&
    /\b(vietnamese|tieng viet|into vietnamese|sang tieng viet|in vietnamese)\b/i.test(normalized);

  const outsideSubject =
    /\b(math(?:ematics)?|calculus|algebra|geometry|trigonometry|statistics|probability|derivatives?|integrals?|equations?|fractions?|logarithms?|logarithmic|logarit|exponents?|polynomials?|inequalities|matrices|vectors|arithmetic|physics|chemistry|biology|science|computer science|information technology|programming|coding|software|artificial intelligence|machine learning|economics|history|geography|toan(?: hoc)?|giai tich|dai so|hinh hoc|luong giac|xac suat|thong ke|dao ham|tich phan|phuong trinh|phan so|ham so|so mu|da thuc|bat dang thuc|ma tran|vat ly|hoa hoc|sinh hoc|khoa hoc|tin hoc|cong nghe thong tin|lap trinh|lich su|dia ly)\b/i.test(
      normalized,
    );

  // English lessons may use another subject as vocabulary or reading context.
  // Explicit requests to teach/create that other subject remain out of scope.
  if (
    outsideSubject &&
    !(explicitlyAboutEnglish && asksForEnglishSubjectMatter) &&
    !asksForTranslationOfSubjectTerm
  ) {
    return isVietnamese
      ? 'Mình chỉ hỗ trợ học tiếng Anh và luyện IELTS trên trang này. Bạn hãy hỏi về từ vựng, ngữ pháp, phát âm hoặc một kỹ năng IELTS nhé.'
      : 'I can only help with English learning and IELTS on this site. Please ask about English vocabulary, grammar, pronunciation, or an IELTS skill.';
  }
  return null;
}
