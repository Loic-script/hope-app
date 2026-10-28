import { CheckCircle2, Clock, Loader2, RotateCcw, XCircle } from 'lucide-react';
import type { TransactionStatus } from '@/types/api';
import { TRANSACTION_STATUS_LABELS } from '@/utils/format';
import { cn } from '@/utils/cn';

/**
 * Statut d'une transaction.
 *
 * L'information n'est JAMAIS portée par la seule couleur : chaque statut a son
 * icône et son libellé écrit. Une personne daltonienne distingue un paiement
 * encaissé d'un paiement échoué sans avoir à percevoir le vert ou le rouge.
 *
 * Le statut vient du backend et n'est jamais recalculé ici.
 */

const STATUS_STYLES: Record<
  TransactionStatus,
  { classes: string; icon: typeof Clock; spin?: boolean }
> = {
  PENDING: { classes: 'bg-hope-blue-light text-hope-purple-deep', icon: Clock },
  PROCESSING: {
    classes: 'bg-hope-blue-light text-hope-purple-deep',
    icon: Loader2,
    spin: true,
  },
  SUCCESS: { classes: 'bg-emerald-100 text-emerald-900', icon: CheckCircle2 },
  FAILED: { classes: 'bg-red-100 text-red-900', icon: XCircle },
  CANCELLED: { classes: 'bg-hope-lavender text-hope-purple-deep', icon: XCircle },
  REFUNDED: { classes: 'bg-hope-orange/20 text-hope-orange-deep', icon: RotateCcw },
};

export function TransactionStatusBadge({
  status,
  size = 'md',
}: {
  status: TransactionStatus;
  size?: 'sm' | 'md';
}) {
  const style = STATUS_STYLES[status];
  const Icon = style.icon;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full font-semibold',
        style.classes,
        size === 'sm' ? 'px-2.5 py-0.5 text-xs' : 'px-3 py-1 text-sm',
      )}
    >
      <Icon
        className={cn(size === 'sm' ? 'size-3.5' : 'size-4', style.spin && 'animate-spin')}
        aria-hidden="true"
      />
      {TRANSACTION_STATUS_LABELS[status]}
    </span>
  );
}
