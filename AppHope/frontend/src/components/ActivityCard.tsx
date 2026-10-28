import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { TONE_STYLES, type Activity } from '@/constants/activities';
import { cn } from '@/utils/cn';

/**
 * Carte d'activité.
 *
 * Chaque activité porte la couleur imposée par la charte HOPE : bleu pour la
 * scolarité, violet pour l'employabilité, orange pour les soins, jaune pour
 * l'alimentation. La couleur n'est pas le seul repère — l'icône et le titre
 * disent la même chose.
 *
 * Le lien mène vers les projets RÉELS de cette catégorie, filtrés côté
 * backend : la carte n'est pas une simple illustration, c'est une entrée.
 */

export function ActivityCard({
  activity,
  categoryId,
  projectCount,
}: {
  activity: Activity;
  /** Identifiant de la catégorie en base, pour filtrer les projets. */
  categoryId?: string;
  projectCount?: number;
}) {
  const tone = TONE_STYLES[activity.tone];
  const Icon = activity.icon;

  const href = categoryId ? `/projects?categoryId=${categoryId}` : '/projects';

  return (
    <article
      className={cn(
        'group relative flex h-full flex-col rounded-hope-lg border-2 p-6 transition-all duration-300',
        'hover:-translate-y-1 hover:shadow-hope-lg',
        tone.surface,
        tone.border,
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          'mb-5 inline-flex size-14 items-center justify-center rounded-hope',
          tone.icon,
        )}
      >
        <Icon className="size-7" />
      </span>

      <h3 className="text-xl text-hope-purple">
        <Link to={href} className="rounded-hope-sm after:absolute after:inset-0 after:content-['']">
          {activity.title}
        </Link>
      </h3>

      <p className={cn('mt-1 text-sm font-semibold', tone.accent)}>{activity.tagline}</p>

      <p className="mt-3 flex-1 text-sm leading-relaxed text-hope-ink-soft">
        {activity.description}
      </p>

      <p className="mt-5 flex items-center gap-1.5 text-sm font-semibold text-hope-purple">
        {typeof projectCount === 'number' && projectCount > 0
          ? `${projectCount} projet${projectCount > 1 ? 's' : ''} en cours`
          : 'Voir les projets'}
        <ArrowRight
          className="size-4 transition-transform duration-300 group-hover:translate-x-1"
          aria-hidden="true"
        />
      </p>
    </article>
  );
}
