/** Product-wide teaching scope and language contract for the English/IELTS web. */
export const ENGLISH_IELTS_SCOPE_PROMPT = [
  '# Product Scope and Language Contract',
  'This product supports only English language learning and IELTS preparation. Keep all tutoring, course creation, classroom conversation, examples, and generated learning materials within that scope. Relevant topics include English grammar, vocabulary, pronunciation, reading, writing, listening, speaking, translation, and IELTS Academic practice across all four skills.',
  'For ordinary conversation in both standard chat and Pro chat, reply in the same language as the user’s latest message: Vietnamese input gets a Vietnamese reply; English input gets an English reply. Do not force English in conversational answers.',
  'Student-facing course lessons and generated learning materials must be written in English, including explanations, examples, exercises, and slides.',
  'Requests to edit or troubleshoot an existing English/IELTS slide are in scope, including its layout, formatting, visual design, text placement, and interactive controls. Treat quoted slide text and labels as material being discussed, not as a request to teach that subject. Keep any new educational content within English learning and IELTS.',
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
    .toLowerCase()
    .replace(/đ/g, 'd');

  // Editing a current classroom slide or fixing its controls is product use,
  // even when the user quotes wording that contains terms from another field.
  // Do not exempt requests to create a new lesson/course on an unrelated topic.
  const refersToSlideOrControl =
    /\b(slides?|slideshow|presentation|deck|quiz|widget|button|interactive|check my packing|check my answer|trang chieu|bai giang|slide)\b/i.test(
      normalized,
    );
  const asksToEditOrTroubleshoot =
    /\b(edit|revise|adjust|change|fix|format|restyle|redesign|align|move|resize|font|layout|spacing|color|style|broken|bug|error|issue|wrong|keeps?|always|every time|doesn.t work|not working|why|sao|tai sao|loi|sua|chinh sua|dieu chinh|dinh dang|can le|moi lan|bam|hien|khong chay|bi loi)\b/i.test(
      normalized,
    );
  if (refersToSlideOrControl && asksToEditOrTroubleshoot) return null;

  const hasEnglishLearningTarget =
    /\b(ielts|english|tieng anh|hoc tieng anh)\b/i.test(normalized);
  const asksForEnglishLearningActivity =
    /\b(vocabulary|vocab|word(?:s)?|term(?:s)?|tu vung|tu tieng anh|ngu phap|grammar|syntax|semantics|phonetics|phonology|pronunciation|phat am|reading|passage|doan doc|speaking|writing|listening|translate|translation|dich|how do you say|how to say|what is .{1,50} in english|what does .{1,50} mean|la gi|goi la gi)\b/i.test(
      normalized,
    );
  const asksForOtherLanguage =
    /\b(chinese|mandarin|cantonese|japanese|korean|french|german|spanish|russian|italian|thai|arabic|portuguese|dutch|hindi|vietnamese|tieng trung|tieng nhat|tieng han|tieng phap|tieng duc|tieng tay ban nha|tieng nga|tieng y|tieng thai|tieng viet|ngoai ngu|ngon ngu khac)\b/i.test(
      normalized,
    );
  const explicitlyAsksToSolveOtherSubject =
    /\b(solve|calculate|compute|work out|giai (?:bai|phuong trinh|bat phuong trinh)|tinh (?:gia tri|dap an)|cho toi bai tap|lam bai tap)\b/i.test(
      normalized,
    );
  const asksForEnglishVocabulary =
    /\b(vocabulary|vocab|word(?:s)?|term(?:s)?|tu vung|tu tieng anh|how do you say|how to say|what does .{1,50} mean|what is .{1,50} in english|english meaning)\b/i.test(
      normalized,
    );
  const asksForEnglishSubjectMatter =
    (hasEnglishLearningTarget && asksForEnglishLearningActivity) ||
    (asksForEnglishVocabulary && (!asksForOtherLanguage || hasEnglishLearningTarget)) ||
    /\b(translate|translation|dich|what is|how do you say|how to say|what does|la gi|goi la gi)\b.{0,100}\b(vietnamese|tieng viet|english|tieng anh|into vietnamese|sang tieng viet|in vietnamese|la gi|goi la gi)\b/i.test(
      normalized,
    );
  const outsideSubjectPatterns = [
    /\bc\+\+(?=$|[^a-z0-9_])/i,
    /\b(math(?:ematics)?|calculus|algebra|geometry|trigonometry|statistics|probability|derivatives?|integrals?|equations?|fractions?|logarithms?|exponents?|polynomials?|inequalities|matrices|vectors|arithmetic|physics|chemistry|biology|science|astronomy|earth science|geology|toan(?: hoc)?|giai tich|dai so|hinh hoc|luong giac|xac suat|thong ke|dao ham|tich phan|phuong trinh|phan so|ham so|so mu|da thuc|bat dang thuc|ma tran|vat ly|hoa hoc|dien li|su dien li|mon hoa|sinh hoc|thien van hoc|khoa hoc trai dat|dia chat)\b/i,
    /\b(literature|creative writing|vietnamese|philosophy|sociology|anthropology|cultural studies|religious studies|history|geography|ngu van|tieng viet|van hoc|viet sang tao|lich su|dia ly|triet hoc|xa hoi hoc|nhan hoc|van hoa hoc|ton giao hoc)\b/i,
    /\b(chinese|mandarin|cantonese|japanese|korean|french|german|spanish|russian|italian|thai|arabic|portuguese|dutch|hindi|tieng trung|tieng nhat|tieng han|tieng phap|tieng duc|tieng tay ban nha|tieng nga|tieng y|tieng thai|foreign languages?|other languages?|non-english languages?|ngoai ngu|ngon ngu khac)\b/i,
    /\b(computer science|information technology|data science|cybersecurity|computer networks?|web development|app development|programming|coding|software|python|javascript|typescript|java|c\+\+|artificial intelligence|machine learning|engineering|mechanical engineering|electrical engineering|electronics|automation|robotics|automotive|chemical engineering|materials science|tin hoc|cong nghe thong tin|lap trinh|phat trien web|phat trien ung dung|tri tue nhan tao|khoa hoc du lieu|an ninh mang|mang may tinh|co khi|dien dien tu|tu dong hoa|robot|cong nghe o to|ky thuat hoa hoc|vat lieu)\b/i,
    /\b(economics|business administration|entrepreneurship|sales|e-?commerce|project management|finance|banking|accounting|auditing|insurance|investment|marketing|advertising|public relations|journalism|content creation|digital media|law|public administration|public policy|kinh te hoc|quan tri kinh doanh|khoi nghiep|ban hang|thuong mai dien tu|quan ly du an|tai chinh|ngan hang|ke toan|kiem toan|bao hiem|dau tu|quang cao|quan he cong chung|bao chi|sang tao noi dung|truyen thong so|truyen thong|luat hoc|hanh chinh cong|chinh sach cong|quan ly nha nuoc)\b/i,
    /\b(education|pedagogy|teaching methods|special education|educational management|psychology|counseling|social work|community development|medicine|pharmacy|nursing|dentistry|public health|nutrition|rehabilitation|giao duc|su pham|phuong phap giang day|giao duc dac biet|quan ly giao duc|tam ly hoc|tham van tam ly|cong tac xa hoi|phat trien cong dong|y khoa|duoc hoc|dieu duong|nha khoa|y te cong cong|dinh duong|phuc hoi chuc nang)\b/i,
    /\b(painting|graphic design|fashion design|photography|music|film|cinema|theatre|dance|architecture|construction|urban planning|interior design|agriculture|farming|livestock|veterinary|forestry|fisheries|environmental science|food technology|tourism|hospitality|hotel management|restaurant management|event management|hoi hoa|thiet ke do hoa|thiet ke thoi trang|nhiep anh|am nhac|dien anh|san khau|mua|kien truc|xay dung|quy hoach do thi|thiet ke noi that|quan ly cong trinh|nong nghiep|trong trot|chan nuoi|thu y|lam nghiep|thuy san|khoa hoc moi truong|cong nghe thuc pham|du lich|huong dan du lich|quan tri khach san|quan tri nha hang|to chuc su kien)\b/i,
    /\b(logistics|supply chain|transport(?:ation)?|maritime|aviation|physical education|sports? coaching|football|soccer|swimming|martial arts|yoga|bodybuilding|communication skills|public speaking|critical thinking|time management|leadership|negotiation|cooking|baking|sewing|beauty|woodworking|electrical repair|device repair|handicrafts?|fourier(?: transform| transformation)?|board games?|avalon|chess|poker|logistics|quan ly chuoi cung ung|van tai|hang hai|hang khong|the thao|giao duc the chat|huan luyen the thao|bong da|boi loi|vo thuat|the hinh|giao tiep|thuyet trinh|tu duy phan bien|quan ly thoi gian|lanh dao|dam phan|nau an|lam banh|may mac|lam dep|moc|dien dan dung|sua chua thiet bi|thu cong my nghe)\b/i,
    /\b(opportunity cost|supply and demand|inflation|business model|competitive advantage|market share|value chain|assets?|liabilities|shareholders? equity|revenue|profit|cash flow|depreciation|interest rates?|liquidity|financial statements?|market segmentation|target audience|brand positioning|consumer behavior|conversion rate|brand awareness|legal norms?|legal relations?|legal liability|contracts?|litigation|jurisdiction|curriculum|learning objectives?|learning outcomes?|assessment|inclusive education|social stratification|cultural identity|institutions?|epistemology|ethics|discourse|source texts?|chronology|archaeology|civilization|landforms?|climate|cartography|urbanization|cohort studies|cell biology|inheritance|genetics|genes?|evolution|ecosystems?|microorganisms?|physiology|molecular biology|atoms?|molecules?|chemical reactions?|chemical bonds?|solutions|catalysts?|organic chemistry|inorganic chemistry|mechanics|dynamics|thermodynamics|electromagnetism|optics|quantum mechanics|electric fields?|technical drawings?|tolerances|machining|mechatronics|circuits?|sensors|control systems?|maintenance|algorithms?|data structures?|databases?|operating systems?|object-oriented programming|cloud computing|encryption|debt|equity|amortization|market positioning|consumer behavior|public policy|case management|epidemiology|immunology|anatomy|pathology|pharmacology|rehabilitation|perspective drawing|typography|harmony|rhythm|floor plans?|elevations?|cross.sections?|structural engineering|foundations|load-bearing|reinforced concrete|soil science|crop cultivation|plant breeding|pesticides?|biodiversity|emissions|wastewater treatment|circular economy|destinations?|tour routes?|travel itineraries?|hospitality|room occupancy|customer experience|multimodal transport|freight|warehousing|inventory|waybills?|customs clearance|delivery times?|stamina|strength training|agility|training load|heart rates?|active listening|conflict management|decision-making|food preparation|fermentation|pattern making|tailoring|skin care|installation|workplace safety)\b/i,
    /\b(co hoc|dong luc hoc|nhiet dong luc hoc|dien tu hoc|quang hoc|luong tu|dien truong|nguyen tu|phan tu|phan ung hoa hoc|lien ket hoa hoc|dung dich|chat xuc tac|hoa huu co|hoa vo co|te bao|di truyen|gen|tien hoa|he sinh thai|vi sinh vat|sinh ly hoc|sinh hoc phan tu|tu tu|tu su|nghi luan|thi phap|the loai|hinh tuong|phe binh van hoc|su lieu|nien dai|khao co hoc|van minh|dia hinh|khi hau|ban do hoc|dan so|do thi hoa|thiet che xa hoi|phan tang xa hoi|ban sac van hoa|dan toc hoc|nhan thuc luan|dao duc hoc|dien ngon|ngu am hoc|am vi|thanh dieu|chu viet|cu phap|ngu nghia|ngu dung|bien dich|phien dich|nang luc ngon ngu|thuat toan|cau truc du lieu|co so du lieu|he dieu hanh|lap trinh huong doi tuong|dien toan dam may|ma hoa|hoc may|ban ve ky thuat|dung sai|gia cong|co dien tu|mach dien|cam bien|he thong dieu khien|bao tri|cung cau|chi phi co hoi|lam phat|mo hinh kinh doanh|loi the canh tranh|thi phan|chien luoc|chuoi gia tri|tai san|no phai tra|von chu so huu|doanh thu|loi nhuan|dong tien|khau hao|lai suat|thanh khoan|bao cao tai chinh|phan khuc thi truong|khach hang muc tieu|dinh vi thuong hieu|hanh vi nguoi tieu dung|chien dich|ty le chuyen doi|nhan dien thuong hieu|quy pham phap luat|quan he phap luat|chu the phap luat|trach nhiem phap ly|hop dong|to tung|tham quyen|muc tieu hoc tap|chuan dau ra|kiem tra danh gia|phan hoa day hoc|giao duc hoa nhap|nhan thuc|cam xuc|hanh vi|nhan cach|dong co|tham van|can thiep|quan ly ca|an sinh xa hoi|ho tro cong dong|giai phau|sinh ly|benh ly|trieu chung|chan doan|dieu tri|duoc ly|dich te hoc|mien dich|mat bang|mat dung|mat cat|ket cau|nen mong|tai trong|be tong cot thep|mat do xay dung|du toan|tho nhuong|giong cay trong|canh tac|bao ve thuc vat|chon giong|phat thai|xu ly nuoc thai|diem den|tuyen du lich|lu hanh|luu tru|dat phong|cong suat phong|trai nghiem khach hang|chat luong dich vu|van tai da phuong thuc|giao nhan|kho bai|ton kho|van don|hai quan|phan phoi|thoi gian giao hang|suc ben|suc manh|toc do|do linh hoat|tai luong tap luyen|nhip tim|ky thuat van dong|hoi phuc|lang nghe chu dong|phan hoi|lam viec nhom|quan ly xung dot|dam phan|ra quyet dinh|so che|che bien|len men|tao mau|cat may|cham soc da|lap dat|sua chua|hoan thien san pham|an toan lao dong)\b/i,
    /\b(force|forces|energy|rhetoric|narrative|argumentative writing|poetics|literary genre|literary imagery|literary criticism|population|ethnography|phoneme|tones?|writing systems?|interpreting studies|language proficiency|strategy|campaign|legal subject|legal entity|freight forwarding|distribution|teamwork|feedback|visual identity|screenplay|building density|construction estimate|plant cultivars?|plant protection|service quality|tour operator|lodging|room booking|differentiated instruction|cognition|emotion|behavior|personality|motivation|symptoms?|diagnosis|treatment|immunity|composition|perspective|shading|contrast|materials?|active ingredient|clinical signs|medical diagnosis|immune response|training recovery|service capacity|inventory control|value proposition|brand recognition|market positioning|social institutions?|social class|ethnology|discourse analysis|curricular standards|learning assessment|case intervention|community support|visual composition|color value|materiality|building section|construction cost estimate|soil fertility|crop variety|food processing|tourism operations|freight forwarding|delivery lead time|exercise intensity|conflict resolution|problem solving|decision making|food processing|product finishing)\b/i,
    /\b(luc|nang luong|tu tu hoc|tu thuat|tu su hoc|the loai van hoc|hinh tuong van hoc|phe binh van hoc|dan so hoc|dan toc hoc|chuong trinh giao duc|phuong phap day hoc|trai nghiem khach hang|chat luong phuc vu|giao tiep lien ca nhan|phan hoi cong viec|nhan dien thi giac|an toan nghe nghiep|bo cuc|phoi canh|sac do|tuong phan|chat lieu|kieu chu|hoa am|tiet tau|kich ban|quy hoach|chat luong dich vu|giao duc hoa nhap|tieu chuan dau ra|quy trinh giao nhan|van chuyen da phuong thuc)\b/i,
  ];
  const outsideSubject = outsideSubjectPatterns.some((pattern) => pattern.test(normalized));

  // English lessons may use another subject as vocabulary or reading context.
  // Explicit requests to teach/create that other subject remain out of scope.
  if (
    outsideSubject &&
    (!asksForEnglishSubjectMatter ||
      explicitlyAsksToSolveOtherSubject ||
      (asksForOtherLanguage && !hasEnglishLearningTarget))
  ) {
    return 'Xin lỗi bạn nhé, mình chỉ có thể hỗ trợ việc học tiếng Anh và luyện IELTS. Nếu muốn, mình có thể giúp bạn học từ vựng tiếng Anh liên quan đến chủ đề này.';
  }
  return null;
}
