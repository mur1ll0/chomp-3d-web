import { useAppStore } from '../store/useAppStore';
import { translate, type Language } from './translations';

export function useT(): (key: string, params?: Record<string, string | number>) => string {
  const language = useAppStore(s => s.language);
  return (key: string, params?: Record<string, string | number>) => translate(language, key, params);
}

export function tStandalone(key: string, params?: Record<string, string | number>): string {
  const lang: Language = useAppStore.getState().language;
  return translate(lang, key, params);
}
