import { ArrowRight, Heart, MapPin, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Badge, Card, ProgressBar } from '@/components/ui';
import { ButtonLink } from '@/components/ui/Button';
import { findActivity, TONE_STYLES } from '@/constants/activities';
import type { Project } from '@/types/api';
import { PROJECT_STATUS_LABELS, truncate } from '@/utils/format';
import { formatMoney, isZeroAmount } from '@/utils/money';
import { cn } from '@/utils/cn';

/**
 * Carte projet.
 *
 * TOUT CE QU'ELLE AFFICHE VIENT DU BACKEND, y compris le pourcentage de
 * progression : le navigateur ne divise jamais un montant par un autre.
 *
 * Le cas du projet SANS OBJECTIF est traite explicitement. Le modele de
 * donnees n'impose pas de budget, donc `goalAmount` peut etre nul. Plutot
 * qu'une barre a 0% — qui laisserait croire que le projet n'a rien recu — on
 * affiche alors le montant deja collecte, sans barre.
 */

interface ProjectCardProps {
  project: Project;
  /** Illustration en tete de carte. Desactivable dans les listes denses. */
  showMedia?: boolean;
}

export function ProjectCard({ project, showMedia = true }: ProjectCardProps) {
  const activity = findActivity(project.category?.name);
  const tone = activity ? TONE_STYLES[activity.tone] : TONE_STYLES.blue;
  const { funding } = project;

  const hasGoal = funding.goalAmount !== null && !isZeroAmount(funding.goalAmount);
  const isFunded = funding.progressPercent !== null && funding.progressPercent >= 100;

  return (
    <Card as="article" interactive className="flex h-full flex-col overflow-hidden">
      {showMedia && (
        <div className={cn('relative overflow-hidden', project.photoUrl ? 'h-40' : 'h-24', tone.surface)}>
          {project.photoUrl ? (
            <img src={project.photoUrl} alt="" loading="lazy" className="size-full object-cover" />
          ) : (
            /* SANS PHOTO : un bandeau assume, pas une image manquante.
               Une grande zone vide avec une icone palotte au centre se lit
               comme un chargement rate. Un bandeau court, avec l'icone de
               l'activite en filigrane sur le cote, se lit comme un choix.
               HOPE n'utilise pas de photo d'illustration achetee : montrer
               des enfants qui ne sont pas les siens serait malhonnete. */
            <div aria-hidden="true" className="absolute inset-0 overflow-hidden">
              {activity && (
                <activity.icon
                  className="absolute -right-4 -bottom-6 size-32 text-hope-purple/12"
                  strokeWidth={1.25}
                />
              )}
            </div>
          )}

          <div className="absolute top-3 left-3 flex flex-wrap gap-2">
            {project.category && (
              <Badge tone="purple">{activity?.title ?? project.category.name}</Badge>
            )}
            {project.status === 'COMPLETED' && (
              <Badge tone="success">{PROJECT_STATUS_LABELS['COMPLETED']}</Badge>
            )}
          </div>
        </div>
      )}

      <div className="flex flex-1 flex-col p-5">
        {/* Le titre est un lien ORDINAIRE, volontairement.
            Rendre toute la carte cliquable (« stretched link ») est tentant,
            mais la carte porte déjà deux actions distinctes — consulter et
            donner. Une zone cliquable qui recouvre les deux boutons crée une
            ambiguïté pour l'utilisateur, et impose des rustines de z-index. */}
        <h3 className="text-lg leading-snug text-hope-purple">
          <Link
            to={`/projects/${project.id}`}
            className="rounded-hope-sm underline-offset-4 hover:underline"
          >
            {project.name}
          </Link>
        </h3>

        <p className="mt-2 text-sm leading-relaxed text-hope-ink-soft">
          {truncate(project.description, 130)}
        </p>

        <dl className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-hope-ink-soft">
          {project.location && (
            <div className="flex items-center gap-1.5">
              <dt className="sr-only">Localisation</dt>
              <MapPin className="size-3.5 shrink-0" aria-hidden="true" />
              <dd>{project.location}</dd>
            </div>
          )}
          {project.beneficiaryCount > 0 && (
            <div className="flex items-center gap-1.5">
              <dt className="sr-only">Bénéficiaires accompagnés</dt>
              <Users className="size-3.5 shrink-0" aria-hidden="true" />
              <dd>
                {project.beneficiaryCount} bénéficiaire
                {project.beneficiaryCount > 1 ? 's' : ''}
              </dd>
            </div>
          )}
        </dl>

        {/* --- Financement --- */}
        <div className="mt-5 border-t border-hope-blue-mist/70 pt-4">
          {hasGoal ? (
            <>
              <div className="mb-2 flex items-baseline justify-between gap-3">
                <p className="tabular font-mono text-sm font-semibold text-hope-purple">
                  {formatMoney(funding.fundedAmount, funding.currency)}
                </p>
                <p className="text-xs text-hope-ink-soft">
                  sur {formatMoney(funding.goalAmount, funding.currency)}
                </p>
              </div>

              <ProgressBar
                value={funding.progressPercent}
                label={`Financement du projet : ${funding.progressPercent ?? 0}% de l’objectif atteint`}
                tone={isFunded ? 'purple' : 'orange'}
              />

              {/* Le pourcentage est repete en toutes lettres : une barre seule
                  n'est pas lisible par un lecteur d'ecran ni en monochrome. */}
              <p className="mt-2 text-xs font-medium text-hope-ink-soft">
                {isFunded ? (
                  <span className="text-hope-purple">Objectif atteint — merci à tous</span>
                ) : (
                  <>{funding.progressPercent ?? 0}% de l’objectif atteint</>
                )}
              </p>
            </>
          ) : (
            <div>
              <p className="tabular font-mono text-sm font-semibold text-hope-purple">
                {formatMoney(funding.fundedAmount, funding.currency)}
              </p>
              <p className="mt-1 text-xs text-hope-ink-soft">
                {isZeroAmount(funding.fundedAmount)
                  ? 'Ce projet attend ses premiers dons.'
                  : 'déjà collectés pour ce projet'}
              </p>
            </div>
          )}
        </div>

        <div className="mt-5 flex gap-2">
          <ButtonLink to={`/projects/${project.id}`} variant="outline" size="sm" className="flex-1">
            Voir le projet
            <ArrowRight className="size-4" aria-hidden="true" />
          </ButtonLink>
          <ButtonLink
            to={`/projects/${project.id}/donate`}
            size="sm"
            className="flex-1"
            aria-label={`Faire un don pour le projet ${project.name}`}
          >
            <Heart className="size-4" aria-hidden="true" />
            Donner
          </ButtonLink>
        </div>
      </div>
    </Card>
  );
}
