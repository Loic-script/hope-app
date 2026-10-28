import { AlertCircle } from 'lucide-react';
import { forwardRef, useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from 'react';
import { cn } from '@/utils/cn';

/**
 * CHAMPS DE FORMULAIRE.
 *
 * TROIS EXIGENCES D'ACCESSIBILITE TENUES ICI
 *
 *  1. Chaque champ a un <label> RELIE par `htmlFor` / `id`. Un simple texte
 *     place au-dessus ne suffit pas : un lecteur d'ecran ne le rattacherait
 *     pas au champ, et cliquer dessus ne donnerait pas le focus.
 *
 *  2. L'erreur n'est pas signalee QUE par du rouge. Elle porte une icone, un
 *     texte, et `aria-invalid`. Une personne daltonienne voit la bordure
 *     changer sans distinguer la couleur : il lui faut le texte.
 *
 *  3. Le message d'erreur est relie au champ par `aria-describedby`, ce qui le
 *     fait lire au moment ou l'on entre dans le champ, et non seulement en
 *     parcourant la page.
 */

interface FieldShellProps {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: string;
  required?: boolean;
  children: ReactNode;
  errorId: string;
  hintId: string;
}

function FieldShell({
  label,
  htmlFor,
  error,
  hint,
  required,
  children,
  errorId,
  hintId,
}: FieldShellProps) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-semibold text-hope-ink">
        {label}
        {required && (
          <>
            <span aria-hidden="true" className="ml-1 text-hope-orange-deep">
              *
            </span>
            <span className="sr-only">(obligatoire)</span>
          </>
        )}
      </label>

      {hint && (
        <p id={hintId} className="mb-1.5 text-xs text-hope-ink-soft">
          {hint}
        </p>
      )}

      {children}

      {error && (
        <p id={errorId} className="mt-1.5 flex items-center gap-1.5 text-sm text-red-700">
          <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}
    </div>
  );
}

const CONTROL_BASE =
  'w-full min-h-12 rounded-hope border-2 bg-white px-4 text-base text-hope-ink ' +
  'transition-colors placeholder:text-hope-ink-soft/60 ' +
  'focus:border-hope-purple focus:outline-none focus-visible:outline-3 ' +
  'focus-visible:outline-offset-1 focus-visible:outline-hope-orange';

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'className'> {
  label: string;
  error?: string;
  hint?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, hint, required, id, ...rest },
  ref,
) {
  const generated = useId();
  const fieldId = id ?? generated;
  const errorId = `${fieldId}-error`;
  const hintId = `${fieldId}-hint`;

  return (
    <FieldShell
      label={label}
      htmlFor={fieldId}
      error={error}
      hint={hint}
      required={required}
      errorId={errorId}
      hintId={hintId}
    >
      <input
        ref={ref}
        id={fieldId}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={cn(error && errorId, hint && hintId) || undefined}
        className={cn(CONTROL_BASE, error ? 'border-red-500' : 'border-hope-blue-mist')}
        {...rest}
      />
    </FieldShell>
  );
});

export interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'className'> {
  label: string;
  error?: string;
  hint?: string;
  options: { value: string; label: string }[];
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, error, hint, required, id, options, ...rest },
  ref,
) {
  const generated = useId();
  const fieldId = id ?? generated;
  const errorId = `${fieldId}-error`;
  const hintId = `${fieldId}-hint`;

  return (
    <FieldShell
      label={label}
      htmlFor={fieldId}
      error={error}
      hint={hint}
      required={required}
      errorId={errorId}
      hintId={hintId}
    >
      <select
        ref={ref}
        id={fieldId}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={cn(error && errorId, hint && hintId) || undefined}
        className={cn(CONTROL_BASE, 'pr-10', error ? 'border-red-500' : 'border-hope-blue-mist')}
        {...rest}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </FieldShell>
  );
});

/**
 * Carte-radio : une option cliquable en entier.
 *
 * Le <input type="radio"> est bien present mais visuellement masque : la
 * navigation clavier, la lecture d'ecran et les groupes de radios fonctionnent
 * donc normalement. Un <div onClick> aurait tout casse.
 */
export function RadioCard({
  name,
  value,
  checked,
  onChange,
  title,
  description,
  icon,
  disabled = false,
}: {
  name: string;
  value: string;
  checked: boolean;
  onChange: (value: string) => void;
  title: string;
  description?: string;
  icon?: ReactNode;
  disabled?: boolean;
}) {
  return (
    <label
      className={cn(
        'group relative flex cursor-pointer items-start gap-3 rounded-hope border-2 p-4 transition-all',
        'has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-hope-orange',
        checked
          ? 'border-hope-purple bg-hope-lavender/40 shadow-hope-sm'
          : 'border-hope-blue-mist bg-white hover:border-hope-blue',
        disabled && 'cursor-not-allowed opacity-55',
      )}
    >
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        disabled={disabled}
        onChange={() => onChange(value)}
        className="sr-only"
      />

      <span
        aria-hidden="true"
        className={cn(
          'mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors',
          checked ? 'border-hope-purple bg-hope-purple' : 'border-hope-blue-mist bg-white',
        )}
      >
        {checked && <span className="size-2 rounded-full bg-white" />}
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2 font-semibold text-hope-ink">
          {icon}
          {title}
        </span>
        {description && (
          <span className="mt-0.5 block text-sm text-hope-ink-soft">{description}</span>
        )}
      </span>
    </label>
  );
}
