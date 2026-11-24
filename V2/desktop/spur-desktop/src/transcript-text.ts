/** Join speech segments without doubling whitespace or separating Chinese and Japanese characters. */
export function textGap(previous: string, next: string): string {
  if (/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]$/u.test(previous) &&
      /^[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u.test(next)) return '';
  return /[\p{L}\p{N}.!?]$/u.test(previous) && /^[\p{L}\p{N}]/u.test(next) ? ' ' : '';
}
