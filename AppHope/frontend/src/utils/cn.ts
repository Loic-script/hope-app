/**
 * Concatene des classes CSS conditionnelles.
 *
 * Volontairement minimal : pas de dependance pour trois lignes. Les conflits
 * de classes Tailwind sont evites en composant les variantes plutot qu'en les
 * superposant.
 */
export function cn(...values: (string | false | null | undefined)[]): string {
  return values.filter(Boolean).join(' ');
}
