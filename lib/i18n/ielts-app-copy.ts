import type { Locale } from './types';

const copy = {
  en: {
    appName: 'IELTS Learning Studio',
    chooseBand: 'Choose your IELTS learning range',
    chooseBandDescription: 'Your selection will set the level for every lesson and slide you generate.',
    lessons: '16 lessons',
    skills: 'Listening · Reading · Speaking · Writing',
    selectBand: 'Open this level',
    backToBands: 'Change level',
    loginEyebrow: 'Teacher workspace',
    loginTitle: 'Sign in to continue',
    loginDescription: 'Use your teacher account to open the IELTS learning workspace.',
    email: 'Email',
    password: 'Password',
    login: 'Sign in',
    loggingIn: 'Signing in…',
    loginError: 'The email or password is incorrect. Please try again.',
    loginUnavailable: 'Local login is not configured for this server.',
    logout: 'Sign out',
    logoutError: 'Could not sign out. Please try again.',
    selectedBand: 'Selected IELTS range',
    bandConstraint: 'Generated lessons will stay within this band range.',
  },
  vi: {
    appName: 'Góc học IELTS',
    chooseBand: 'Chọn dải band IELTS bạn muốn học',
    chooseBandDescription: 'Lựa chọn này sẽ giới hạn trình độ cho mọi bài học và slide bạn tạo.',
    lessons: '16 bài học',
    skills: 'Listening · Reading · Speaking · Writing',
    selectBand: 'Vào cấp độ này',
    backToBands: 'Đổi cấp độ',
    loginEyebrow: 'Không gian giáo viên',
    loginTitle: 'Đăng nhập để tiếp tục',
    loginDescription: 'Dùng tài khoản giáo viên để vào không gian học IELTS.',
    email: 'Email',
    password: 'Mật khẩu',
    login: 'Đăng nhập',
    loggingIn: 'Đang đăng nhập…',
    loginError: 'Email hoặc mật khẩu chưa đúng. Vui lòng thử lại.',
    loginUnavailable: 'Máy chủ này chưa được cấu hình đăng nhập cục bộ.',
    logout: 'Đăng xuất',
    logoutError: 'Không thể đăng xuất. Vui lòng thử lại.',
    selectedBand: 'Dải IELTS đã chọn',
    bandConstraint: 'Bài học tạo ra sẽ nằm trong dải band này.',
  },
} as const;

export type IeltsAppCopyKey = keyof (typeof copy)['en'];

export function ieltsAppCopy(locale: Locale | string, key: IeltsAppCopyKey): string {
  const language = locale.toLowerCase().startsWith('vi') ? 'vi' : 'en';
  return copy[language][key];
}
