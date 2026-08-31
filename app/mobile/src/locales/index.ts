import { en } from './en';
import { zh } from './zh';

// Change only this value, then rebuild the APK.
export const APP_LANGUAGE: 'en' | 'zh' = 'en';

export const t = APP_LANGUAGE === 'en' ? en : zh;
