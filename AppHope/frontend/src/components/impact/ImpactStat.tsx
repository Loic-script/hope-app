import type { LucideIcon } from 'lucide-react';
import { Badge } from '@/components/ui';
import type { IndicatorTotal } from '@/types/api';
import { formatIndicatorName, formatUnit } from '@/utils/format';
import { formatIndicatorValue } from '@/utils/money';
import { cn } from '@/utils/cn';

/**
 * Chiffre clé.
 *
 * Toutes les valeurs viennent de PostgreSQL. Aucun nombre n'est écrit en dur :
 * si HOPE accompagne 312 orphelins, le site affiche 312, et non un « 300 »
 * arrondi laissé dans le code il y a deux ans.
 */

export function ImpactStat({
  value,
  label,
  hint,
  icon: Icon,
  inverted = false,
}: {
  value: string;
  label: string;
  hint?: string;
  icon?: LucideIcon;
  inverted?: boolean;
}) {
  return (
    <div className={cn('text-center', inverted ? 'text-white' : 'text-hope-ink')}>
      {Icon && (
        <span
          aria-hidden="true"
          className={cn(
            'mb-4 inline-flex size-14 items-center justify-center rounded-full',
            inverted ? 'bg-white/12 text-hope-yellow' : 'bg-hope-lavender/60 text-hope-purple',
          )}
        >
          <Icon className="size-7" />
        </span>
      )}

      {/* Le chiffre en chasse fixe : les statistiques d'une même rangée
          s'alignent alors parfaitement, quel que soit leur nombre de chiffres. */}
      <p
        className={cn(
          'tabular font-mono text-4xl font-bold sm:text-5xl',
          inverted ? 'text-hope-yellow' : 'text-hope-purple',
        )}
      >
        {value}
      </p>

      <p className={cn('mt-2 text-sm font-semibold tracking-wide uppercase', inverted && 'text-white')}>
        {label}
      </p>

      {hint && (
        <p className={cn('mt-1 text-xs', inverted ? 'text-white/70' : 'text-hope-ink-soft')}>
          {hint}
        </p>
      )}
    </div>
  );
}

/** Carte d'indicateur mesuré, telle que la renvoie le backend. */
export function IndicatorCard({
  indicator,
  inverted = false,
}: {
  indicator: IndicatorTotal;
  inverted?: boolean;
}) {
  const unit = formatUnit(indicator.unit);

  return (
    <div
      className={cn(
        'rounded-hope-lg border p-6',
        inverted ? 'border-white/15 bg-white/8' : 'border-hope-blue-mist bg-white shadow-hope-sm',
      )}
    >
      <p
        className={cn(
          'tabular font-mono text-3xl font-bold',
          inverted ? 'text-hope-yellow' : 'text-hope-purple',
        )}
      >
        {formatIndicatorValue(indicator.total)}
        {unit === '%' && <span className="text-2xl">%</span>}
      </p>

      <p className={cn('mt-1.5 font-semibold', inverted ? 'text-white' : 'text-hope-ink')}>
        {formatIndicatorName(indicator.indicator)}
      </p>

      <div className="mt-3">
        <Badge tone={inverted ? 'yellow' : 'neutral'}>
          {indicator.measurementCount} mesure{indicator.measurementCount > 1 ? 's' : ''}
          {unit && unit !== '%' ? ` · ${unit}` : ''}
        </Badge>
      </div>
    </div>
  );
}
