import {
  AlertTriangle,
  CheckCircle2,
  Info,
  Loader2,
  SearchX,
  ServerCrash,
  XCircle,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/utils/cn';
import { Button } from './Button';

/**
 * PRIMITIVES DU DESIGN SYSTEM HOPE.
 *
 * Regroupees dans un seul fichier parce qu'elles sont courtes et toujours
 * utilisees ensemble : les eclater en douze fichiers de vingt lignes
 * rendrait la lecture plus penible, pas plus claire.
 */

// ---------------------------------------------------------------------------
// Structure
// ---------------------------------------------------------------------------

export function Container({
  children,
  className,
  size = 'default',
}: {
  children: ReactNode;
  className?: string;
  size?: 'default' | 'narrow' | 'wide';
}) {
  const widths = {
    narrow: 'max-w-3xl',
    default: 'max-w-6xl',
    wide: 'max-w-7xl',
  };
  return (
    <div className={cn('mx-auto w-full px-5 sm:px-6 lg:px-8', widths[size], className)}>
      {children}
    </div>
  );
}

export type SectionTone = 'white' | 'mist' | 'blue' | 'purple' | 'lavender';

const SECTION_TONES: Record<SectionTone, string> = {
  white: 'bg-white text-hope-ink',
  mist: 'bg-hope-blue-light/45 text-hope-ink',
  blue: 'bg-hope-blue-light text-hope-ink',
  purple: 'bg-hope-purple text-white',
  lavender: 'bg-hope-lavender/45 text-hope-ink',
};

export function Section({
  children,
  tone = 'white',
  className,
  id,
  spacing = 'default',
}: {
  children: ReactNode;
  tone?: SectionTone;
  className?: string;
  id?: string;
  spacing?: 'default' | 'tight' | 'loose';
}) {
  const paddings = {
    tight: 'py-12 sm:py-16',
    default: 'py-16 sm:py-20 lg:py-24',
    loose: 'py-20 sm:py-28 lg:py-32',
  };
  return (
    <section id={id} className={cn(SECTION_TONES[tone], paddings[spacing], className)}>
      {children}
    </section>
  );
}

/**
 * Titre de section.
 *
 * L'eyebrow n'est pas decoratif : il situe la section dans le parcours du
 * visiteur. On ne l'utilise pas quand il ne dirait rien de plus que le titre.
 */
export function SectionTitle({
  eyebrow,
  title,
  description,
  align = 'left',
  inverted = false,
  as: Heading = 'h2',
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  align?: 'left' | 'center';
  inverted?: boolean;
  as?: 'h1' | 'h2' | 'h3';
}) {
  return (
    <div className={cn('max-w-3xl', align === 'center' && 'mx-auto text-center')}>
      {eyebrow && (
        <p
          className={cn(
            'mb-3 text-sm font-semibold tracking-[0.16em] uppercase',
            inverted ? 'text-hope-yellow' : 'text-hope-orange-deep',
          )}
        >
          {eyebrow}
        </p>
      )}
      <Heading
        className={cn(
          'text-3xl leading-[1.15] sm:text-4xl lg:text-[2.75rem]',
          inverted ? 'text-white' : 'text-hope-purple',
        )}
      >
        {title}
      </Heading>
      {description && (
        <p
          className={cn(
            'mt-4 text-lg leading-relaxed',
            inverted ? 'text-white/85' : 'text-hope-ink-soft',
          )}
        >
          {description}
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Surfaces
// ---------------------------------------------------------------------------

export function Card({
  children,
  className,
  as: Tag = 'div',
  interactive = false,
}: {
  children: ReactNode;
  className?: string;
  as?: 'div' | 'article' | 'li';
  interactive?: boolean;
}) {
  return (
    <Tag
      className={cn(
        'rounded-hope-lg border border-hope-blue-mist/70 bg-white shadow-hope-sm',
        interactive &&
          'transition-all duration-300 hover:-translate-y-1 hover:border-hope-blue hover:shadow-hope-lg',
        className,
      )}
    >
      {children}
    </Tag>
  );
}

export type BadgeTone = 'neutral' | 'purple' | 'blue' | 'orange' | 'yellow' | 'success' | 'danger';

const BADGE_TONES: Record<BadgeTone, string> = {
  neutral: 'bg-hope-blue-light text-hope-purple-deep',
  purple: 'bg-hope-purple text-white',
  blue: 'bg-hope-blue text-hope-purple-deep',
  orange: 'bg-hope-orange/20 text-hope-orange-deep',
  yellow: 'bg-hope-yellow text-hope-ink',
  success: 'bg-emerald-100 text-emerald-900',
  danger: 'bg-red-100 text-red-900',
};

export function Badge({
  children,
  tone = 'neutral',
  className,
  icon: Icon,
}: {
  children: ReactNode;
  tone?: BadgeTone;
  className?: string;
  icon?: typeof Info;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold',
        BADGE_TONES[tone],
        className,
      )}
    >
      {Icon && <Icon className="size-3.5" aria-hidden="true" />}
      {children}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Progression
// ---------------------------------------------------------------------------

/**
 * Barre de progression du financement.
 *
 * Le pourcentage est calcule par le BACKEND et transmis tel quel : le
 * navigateur ne divise jamais deux montants entre eux.
 *
 * La valeur est repetee en texte a cote de la barre : une information portee
 * uniquement par une longueur de couleur serait invisible pour une personne
 * qui n'y voit pas, ou sur un ecran monochrome.
 */
export function ProgressBar({
  value,
  label,
  tone = 'orange',
  size = 'md',
}: {
  value: number | null;
  label?: string;
  tone?: 'orange' | 'purple' | 'blue';
  size?: 'sm' | 'md';
}) {
  const safe = value === null ? 0 : Math.max(0, Math.min(100, value));
  const tones = {
    orange: 'bg-hope-orange',
    purple: 'bg-hope-purple',
    blue: 'bg-hope-blue',
  };

  return (
    <div>
      <div
        className={cn(
          'w-full overflow-hidden rounded-full bg-hope-blue-mist/60',
          size === 'sm' ? 'h-1.5' : 'h-2.5',
        )}
        role="progressbar"
        aria-valuenow={safe}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label ?? `Progression : ${safe}%`}
      >
        <div
          className={cn('h-full rounded-full transition-[width] duration-700', tones[tone])}
          style={{ width: `${safe}%` }}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Messages
// ---------------------------------------------------------------------------

export type AlertTone = 'info' | 'success' | 'warning' | 'error';

const ALERT_STYLES: Record<AlertTone, { box: string; icon: typeof Info; iconColor: string }> = {
  info: {
    box: 'border-hope-blue bg-hope-blue-light text-hope-ink',
    icon: Info,
    iconColor: 'text-hope-purple',
  },
  success: {
    box: 'border-emerald-300 bg-emerald-50 text-emerald-950',
    icon: CheckCircle2,
    iconColor: 'text-emerald-700',
  },
  warning: {
    box: 'border-hope-orange-light bg-hope-orange/10 text-hope-ink',
    icon: AlertTriangle,
    iconColor: 'text-hope-orange-deep',
  },
  error: {
    box: 'border-red-300 bg-red-50 text-red-950',
    icon: XCircle,
    iconColor: 'text-red-700',
  },
};

export function Alert({
  tone = 'info',
  title,
  children,
  className,
}: {
  tone?: AlertTone;
  title?: string;
  children?: ReactNode;
  className?: string;
}) {
  const { box, icon: Icon, iconColor } = ALERT_STYLES[tone];

  return (
    <div
      // Une erreur est annoncee immediatement, une information attend une pause.
      role={tone === 'error' ? 'alert' : 'status'}
      className={cn('flex gap-3 rounded-hope border-2 p-4', box, className)}
    >
      <Icon className={cn('mt-0.5 size-5 shrink-0', iconColor)} aria-hidden="true" />
      <div className="min-w-0 flex-1 text-sm leading-relaxed">
        {title && <p className="font-semibold">{title}</p>}
        {children}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Etats de chargement et d'absence
// ---------------------------------------------------------------------------

/**
 * Squelette de chargement.
 *
 * Il reprend la FORME du contenu attendu plutot que d'afficher le mot
 * "Chargement" : la page ne saute pas au moment ou les donnees arrivent, et
 * l'attente parait plus courte.
 */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn('animate-pulse rounded-hope-sm bg-hope-blue-mist/50', className)}
      aria-hidden="true"
    />
  );
}

export function ProjectCardSkeleton() {
  return (
    <Card className="overflow-hidden">
      <Skeleton className="h-44 w-full rounded-none" />
      <div className="space-y-3 p-5">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-6 w-4/5" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="mt-4 h-2.5 w-full rounded-full" />
        <Skeleton className="h-11 w-full" />
      </div>
    </Card>
  );
}

export function Loader({ label = 'Chargement en cours' }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16" role="status">
      <Loader2 className="size-8 animate-spin text-hope-purple" aria-hidden="true" />
      <p className="text-sm text-hope-ink-soft">{label}</p>
    </div>
  );
}

/**
 * Ecran vide.
 *
 * Un vide n'est pas une impasse : il propose toujours une action. Le titre dit
 * ce qui manque, le texte pourquoi, le bouton ou aller ensuite.
 */
export function EmptyState({
  title,
  description,
  action,
  icon: Icon = SearchX,
}: {
  title: string;
  description: string;
  action?: ReactNode;
  icon?: typeof SearchX;
}) {
  return (
    <div className="flex flex-col items-center rounded-hope-lg border-2 border-dashed border-hope-blue-mist bg-hope-blue-light/30 px-6 py-16 text-center">
      <div className="mb-4 flex size-14 items-center justify-center rounded-full bg-white">
        <Icon className="size-7 text-hope-purple" aria-hidden="true" />
      </div>
      <h3 className="text-xl text-hope-purple">{title}</h3>
      <p className="mt-2 max-w-md text-hope-ink-soft">{description}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

/**
 * Ecran d'erreur.
 *
 * Il dit ce qui s'est passe et ce que la personne peut faire — jamais un code
 * technique brut, jamais une excuse sans issue.
 */
export function ErrorState({
  title = 'Le contenu n’a pas pu être chargé',
  message,
  onRetry,
}: {
  title?: string;
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center rounded-hope-lg border-2 border-red-200 bg-red-50 px-6 py-16 text-center"
    >
      <div className="mb-4 flex size-14 items-center justify-center rounded-full bg-white">
        <ServerCrash className="size-7 text-red-700" aria-hidden="true" />
      </div>
      <h3 className="text-xl text-red-950">{title}</h3>
      <p className="mt-2 max-w-md text-red-900/80">
        {message ?? 'Une erreur est survenue. Réessayez dans un instant.'}
      </p>
      {onRetry && (
        <Button variant="outline" className="mt-6" onClick={onRetry}>
          Réessayer
        </Button>
      )}
    </div>
  );
}
