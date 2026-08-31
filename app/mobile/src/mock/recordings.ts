import { APP_LANGUAGE } from '@/locales';
import * as en from './recordings.en';
import * as zh from './recordings.zh';

const selected = APP_LANGUAGE === 'en' ? en : zh;

export const speakers = selected.speakers;
export const recordingGroups = selected.recordingGroups;
export const assistantPrompts = selected.assistantPrompts;
export const reminderCards = selected.reminderCards;
export const getRecordingById = selected.getRecordingById;
