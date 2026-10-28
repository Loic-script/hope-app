import { Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '@/utils/cn';

/**
 * BOUTONS HOPE.
 *
 * UNE DECISION A EXPLIQUER : LE BOUTON PRIMAIRE PORTE DU TEXTE ENCRE.
 *   La charte impose l'orange #E09735 pour l'action principale. Or du blanc
 *   sur cet orange donne un contraste de 2.43:1, tres en dessous du seuil
 *   WCAG AA (4.5:1) : le libelle deviendrait penible a lire au soleil, sur un
 *   ecran de telephone, ou pour une personne malvoyante.
 *   Le meme orange avec du texte encre #353343 atteint 5.07:1. C'est donc
 *   celui-la, et il est de surcroit plus chaleureux.
 *
 * L'orange reste STRICTEMENT reserve a l'action principale. Un bouton orange
 * a chaque coin d'ecran ne signalerait plus rien.
 */

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

const BASE =
  'inline-flex items-center justify-center gap-2 font-semibold transition-all ' +
  'duration-200 disabled:cursor-not-allowed disabled:opacity-55 ' +
  'focus-visible:outline-3 focus-visible:outline-offset-2';

const VARIANTS: Record<ButtonVariant, string> = {
  // Texte encre sur orange : 5.07:1. Voir la note ci-dessus.
  primary:
    'bg-hope-orange text-hope-ink shadow-hope-sm hover:bg-hope-orange-light ' +
    'hover:shadow-hope active:translate-y-px focus-visible:outline-hope-purple',
  secondary:
    'bg-hope-purple text-white shadow-hope-sm hover:bg-hope-purple-light ' +
    'hover:shadow-hope active:translate-y-px focus-visible:outline-hope-orange',
  outline:
    'border-2 border-hope-purple text-hope-purple bg-white hover:bg-hope-lavender/50 ' +
    'active:translate-y-px focus-visible:outline-hope-orange',
  ghost:
    'text-hope-purple hover:bg-hope-lavender/60 active:translate-y-px ' +
    'focus-visible:outline-hope-orange',
  danger:
    'bg-red-700 text-white shadow-hope-sm hover:bg-red-800 active:translate-y-px ' +
    'focus-visible:outline-hope-orange',
};

const SIZES: Record<ButtonSize, string> = {
  // Hauteurs minimales pensees pour le pouce : 44px est la cible tactile
  // recommandee, on ne descend jamais en dessous sur les actions reelles.
  sm: 'min-h-11 px-4 text-sm rounded-hope-sm',
  md: 'min-h-12 px-6 text-base rounded-hope',
  lg: 'min-h-14 px-8 text-lg rounded-hope',
};

interface CommonProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  className?: string;
  children: ReactNode;
}

export interface ButtonProps
  extends CommonProps,
    Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className' | 'children'> {
  isLoading?: boolean;
  /** Annonce vocale pendant le chargement. */
  loadingLabel?: string;
}

export function Button({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  isLoading = false,
  loadingLabel = 'Chargement en cours',
  className,
  children,
  disabled,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || isLoading}
      // aria-busy previent les lecteurs d'ecran que l'action est en cours ;
      // sans lui, seule l'animation du logo signalerait l'attente.
      aria-busy={isLoading || undefined}
      className={cn(BASE, VARIANTS[variant], SIZES[size], fullWidth && 'w-full', className)}
      {...rest}
    >
      {isLoading && <Loader2 className="size-5 animate-spin" aria-hidden="true" />}
      {isLoading ? <span className="sr-only">{loadingLabel}</span> : null}
      {children}
    </button>
  );
}

export interface ButtonLinkProps extends CommonProps {
  to: string;
  /** Lien externe : ouvre un nouvel onglet et le signale. */
  external?: boolean;
  onClick?: () => void;
  'aria-label'?: string;
}

/** Meme apparence qu'un bouton, mais c'est un lien : il navigue. */
export function ButtonLink({
  to,
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  external = false,
  className,
  children,
  ...rest
}: ButtonLinkProps) {
  const classes = cn(BASE, VARIANTS[variant], SIZES[size], fullWidth && 'w-full', className);

  if (external) {
    return (
      <a href={to} target="_blank" rel="noreferrer noopener" className={classes} {...rest}>
        {children}
        <span className="sr-only">(ouvre un nouvel onglet)</span>
      </a>
    );
  }

  return (
    <Link to={to} className={classes} {...rest}>
      {children}
    </Link>
  );
}
