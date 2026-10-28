import {
  ArrowDown,
  Banknote,
  FileCheck2,
  HeartHandshake,
  Receipt,
  Sprout,
  Target,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/utils/cn';

/**
 * LE FIL DU DON — élément signature du site.
 *
 * POURQUOI CE COMPOSANT EXISTE
 *   La plupart des sites d'ONG résument l'usage des dons par un camembert et
 *   une promesse ("95 % vont au terrain"). HOPE peut faire mieux : sa base de
 *   données conserve réellement chaque maillon, du paiement jusqu'à l'impact
 *   mesuré. Ce fil rend cette chaîne visible.
 *
 * POURQUOI LES ÉTAPES SONT NUMÉROTÉES
 *   Une numérotation décorative est un tic de mise en page. Ici l'ordre porte
 *   une information vraie : l'argent passe réellement par ces étapes, dans cet
 *   ordre, et aucune ne peut être sautée. On ne peut pas dépenser avant
 *   d'avoir encaissé, ni justifier avant d'avoir dépensé.
 *
 * ACCESSIBILITÉ
 *   Le fil dessiné est purement visuel (`aria-hidden`). La structure réelle
 *   est une liste ordonnée : un lecteur d'écran annonce « étape 3 sur 7 »
 *   sans avoir besoin de percevoir la ligne.
 */

export interface ThreadStep {
  label: string;
  description: string;
  /** Donnée réelle rattachée à l'étape, quand elle est disponible. */
  value?: string | null;
  icon: LucideIcon;
}

const DONATION_CHAIN: ThreadStep[] = [
  {
    label: 'Votre don',
    description: 'Vous choisissez un montant et un moyen de paiement.',
    icon: HeartHandshake,
  },
  {
    label: 'La transaction',
    description:
      'Le paiement est traité. Tant qu’il n’est pas encaissé, il ne compte pas comme reçu.',
    icon: Banknote,
  },
  {
    label: 'L’affectation',
    description: 'Le montant encaissé est fléché vers un projet précis.',
    icon: Target,
  },
  {
    label: 'Le budget',
    description: 'Le projet répartit ses fonds en lignes budgétaires.',
    icon: Wallet,
  },
  {
    label: 'La dépense',
    description: 'Chaque sortie d’argent est validée, puis payée.',
    icon: Receipt,
  },
  {
    label: 'Le justificatif',
    description: 'Facture ou reçu archivé en regard de la dépense.',
    icon: FileCheck2,
  },
  {
    label: 'L’impact',
    description: 'Un résultat mesuré : enfants scolarisés, femmes formées.',
    icon: Sprout,
  },
];

interface DonationThreadProps {
  steps?: ThreadStep[];
  /** Sur fond violet, le fil et les textes s'éclaircissent. */
  inverted?: boolean;
  className?: string;
}

export function DonationThread({
  steps = DONATION_CHAIN,
  inverted = false,
  className,
}: DonationThreadProps) {
  return (
    <ol className={cn('relative', className)}>
      {/* Le fil continu : un simple trait vertical qui relie tous les nœuds.
          Il est décoratif, la liste ordonnée porte déjà la séquence. */}
      <span
        aria-hidden="true"
        className={cn(
          'absolute top-6 bottom-6 left-6 w-px',
          inverted ? 'bg-white/25' : 'bg-hope-blue-mist',
        )}
      />

      {steps.map((step, index) => {
        const Icon = step.icon;
        const isLast = index === steps.length - 1;

        return (
          <li key={step.label} className={cn('relative flex gap-5', !isLast && 'pb-8')}>
            <span
              aria-hidden="true"
              className={cn(
                'relative z-10 flex size-12 shrink-0 items-center justify-center rounded-full border-2',
                inverted
                  ? 'border-white/25 bg-hope-purple text-hope-yellow'
                  : 'border-hope-blue-mist bg-white text-hope-purple',
                // Le dernier maillon — l'impact — est mis en valeur : c'est le
                // point d'arrivée, et la raison d'être de toute la chaîne.
                isLast &&
                  (inverted
                    ? 'border-hope-yellow bg-hope-yellow text-hope-purple'
                    : 'border-hope-orange bg-hope-orange text-hope-ink'),
              )}
            >
              <Icon className="size-5" />
            </span>

            <div className="min-w-0 flex-1 pt-1">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span
                  className={cn(
                    'font-mono text-xs font-semibold tabular',
                    inverted ? 'text-white/50' : 'text-hope-ink-soft/70',
                  )}
                >
                  {String(index + 1).padStart(2, '0')}
                </span>
                <h3
                  className={cn(
                    'font-display text-lg font-semibold',
                    inverted ? 'text-white' : 'text-hope-purple',
                  )}
                >
                  {step.label}
                </h3>
                {step.value && (
                  <span
                    className={cn(
                      'tabular rounded-full px-2.5 py-0.5 font-mono text-xs font-semibold',
                      inverted ? 'bg-white/12 text-hope-yellow' : 'bg-hope-blue-light text-hope-purple',
                    )}
                  >
                    {step.value}
                  </span>
                )}
              </div>

              <p
                className={cn(
                  'mt-1 text-sm leading-relaxed',
                  inverted ? 'text-white/80' : 'text-hope-ink-soft',
                )}
              >
                {step.description}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/**
 * Version compacte et horizontale, pour la page d'accueil.
 *
 * Sur mobile, la liste repasse en colonne : sept étapes côte à côte sur
 * 320 pixels seraient illisibles.
 */
export function DonationThreadCompact({ className }: { className?: string }) {
  const steps = [DONATION_CHAIN[0], DONATION_CHAIN[2], DONATION_CHAIN[4], DONATION_CHAIN[6]].filter(
    (step): step is ThreadStep => Boolean(step),
  );

  return (
    <ol
      className={cn(
        'grid gap-4 sm:grid-cols-2 lg:grid-cols-[repeat(4,1fr)] lg:gap-0',
        className,
      )}
    >
      {steps.map((step, index) => {
        const Icon = step.icon;
        const isLast = index === steps.length - 1;

        return (
          <li key={step.label} className="relative flex gap-4 lg:flex-col lg:gap-3 lg:pr-6">
            {/* Segment de fil horizontal entre deux nœuds, sur grand écran. */}
            {!isLast && (
              <span
                aria-hidden="true"
                className="absolute top-6 left-12 hidden h-px w-[calc(100%-3.5rem)] bg-hope-blue-mist lg:block"
              />
            )}

            <span
              aria-hidden="true"
              className={cn(
                'relative z-10 flex size-12 shrink-0 items-center justify-center rounded-full border-2 bg-white',
                isLast
                  ? 'border-hope-orange bg-hope-orange text-hope-ink'
                  : 'border-hope-blue-mist text-hope-purple',
              )}
            >
              <Icon className="size-5" />
            </span>

            <div>
              <h3 className="font-display text-base font-semibold text-hope-purple">
                {step.label}
              </h3>
              <p className="mt-1 text-sm leading-relaxed text-hope-ink-soft">{step.description}</p>
            </div>

            {/* Sur mobile, le fil devient une flèche entre les blocs. */}
            {!isLast && (
              <ArrowDown
                aria-hidden="true"
                className="absolute -bottom-3 left-5 size-4 text-hope-blue sm:hidden"
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}
