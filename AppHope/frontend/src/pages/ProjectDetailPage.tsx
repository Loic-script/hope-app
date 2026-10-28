import {
  ArrowLeft,
  CalendarDays,
  FileCheck2,
  Heart,
  MapPin,
  Receipt,
  Sprout,
  UserRound,
  Users,
  Wallet,
} from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { IndicatorCard } from '@/components/impact/ImpactStat';
import {
  Alert,
  Badge,
  Card,
  Container,
  EmptyState,
  ErrorState,
  Loader,
  ProgressBar,
  Section,
} from '@/components/ui';
import { ButtonLink } from '@/components/ui/Button';
import { findActivity, TONE_STYLES } from '@/constants/activities';
import { useProject } from '@/hooks/useApi';
import type { Budget, ProjectDetail, PublicExpense } from '@/types/api';
import {
  BENEFICIARY_TYPE_LABELS,
  EXPENSE_STATUS_LABELS,
  formatDate,
  PROJECT_STATUS_LABELS,
} from '@/utils/format';
import { formatMoney, isZeroAmount } from '@/utils/money';
import { cn } from '@/utils/cn';

/**
 * FICHE PROJET.
 *
 * C'est ici que la promesse de transparence se vérifie : budget voté,
 * dépenses engagées, justificatifs archivés, bénéficiaires accompagnés,
 * impacts mesurés. Tout est lu dans la base.
 */
export function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: project, isLoading, isError, refetch } = useProject(id);

  if (isLoading) {
    return (
      <Section tone="white">
        <Container>
          <Loader label="Chargement du projet" />
        </Container>
      </Section>
    );
  }

  if (isError || !project) {
    return (
      <Section tone="white">
        <Container size="narrow">
          <ErrorState
            title="Ce projet est introuvable"
            message="Il a peut-être été retiré, ou le lien est incomplet."
            onRetry={() => void refetch()}
          />
          <div className="mt-6 text-center">
            <ButtonLink to="/projects" variant="outline">
              <ArrowLeft className="size-4" aria-hidden="true" />
              Retour aux projets
            </ButtonLink>
          </div>
        </Container>
      </Section>
    );
  }

  return (
    <>
      <ProjectHero project={project} />
      <ProjectBody project={project} />
    </>
  );
}

// ---------------------------------------------------------------------------
// En-tête
// ---------------------------------------------------------------------------

function ProjectHero({ project }: { project: ProjectDetail }) {
  const activity = findActivity(project.category?.name);
  const tone = activity ? TONE_STYLES[activity.tone] : TONE_STYLES.blue;
  const { funding } = project;
  const hasGoal = funding.goalAmount !== null && !isZeroAmount(funding.goalAmount);

  return (
    <section className={cn('border-b border-hope-blue-mist', tone.surface)}>
      <Container size="wide" className="py-10 lg:py-14">
        <Link
          to="/projects"
          className="mb-6 inline-flex items-center gap-1.5 rounded-hope-sm text-sm font-medium text-hope-purple underline-offset-4 hover:underline"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Tous les projets
        </Link>

        <div className="grid gap-10 lg:grid-cols-[1.5fr_1fr]">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              {project.category && (
                <Badge tone="purple">{activity?.title ?? project.category.name}</Badge>
              )}
              <Badge tone={project.status === 'ACTIVE' ? 'blue' : 'neutral'}>
                {PROJECT_STATUS_LABELS[project.status] ?? project.status}
              </Badge>
              <span className="font-mono text-xs text-hope-ink-soft">{project.code}</span>
            </div>

            <h1 className="mt-4 text-3xl leading-tight text-hope-purple sm:text-4xl lg:text-[2.75rem]">
              {project.name}
            </h1>

            <p className="mt-5 max-w-2xl text-lg leading-relaxed text-hope-ink-soft">
              {project.description}
            </p>

            <dl className="mt-7 flex flex-wrap gap-x-8 gap-y-3 text-sm">
              {project.location && (
                <div className="flex items-center gap-2">
                  <dt className="sr-only">Localisation</dt>
                  <MapPin className="size-4 text-hope-orange" aria-hidden="true" />
                  <dd className="font-medium text-hope-ink">{project.location}</dd>
                </div>
              )}
              {project.managerName && (
                <div className="flex items-center gap-2">
                  <dt className="sr-only">Responsable du projet</dt>
                  <UserRound className="size-4 text-hope-orange" aria-hidden="true" />
                  <dd className="font-medium text-hope-ink">{project.managerName}</dd>
                </div>
              )}
              {project.startDate && (
                <div className="flex items-center gap-2">
                  <dt className="sr-only">Période</dt>
                  <CalendarDays className="size-4 text-hope-orange" aria-hidden="true" />
                  <dd className="font-medium text-hope-ink">
                    {formatDate(project.startDate)}
                    {project.endDate && ` → ${formatDate(project.endDate)}`}
                  </dd>
                </div>
              )}
            </dl>
          </div>

          {/* --- Encart de financement et appel au don --- */}
          <Card className="h-fit p-6">
            <h2 className="font-display text-lg font-semibold text-hope-purple">
              Financement du projet
            </h2>

            <p className="tabular mt-4 font-mono text-3xl font-bold text-hope-purple">
              {formatMoney(funding.fundedAmount, funding.currency)}
            </p>

            {hasGoal ? (
              <>
                <p className="mt-1 text-sm text-hope-ink-soft">
                  collectés sur un objectif de{' '}
                  <span className="font-semibold">
                    {formatMoney(funding.goalAmount, funding.currency)}
                  </span>
                </p>

                <div className="mt-5">
                  <ProgressBar
                    value={funding.progressPercent}
                    label={`Financement : ${funding.progressPercent ?? 0}% de l’objectif`}
                  />
                  <p className="mt-2 text-sm font-semibold text-hope-ink">
                    {funding.progressPercent ?? 0}% de l’objectif atteint
                  </p>
                </div>
              </>
            ) : (
              <p className="mt-1 text-sm text-hope-ink-soft">
                déjà collectés. L’objectif de ce projet sera publié dès que son budget sera voté.
              </p>
            )}

            <dl className="mt-6 space-y-2.5 border-t border-hope-blue-mist pt-5 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-hope-ink-soft">Déjà dépensé</dt>
                <dd className="tabular font-mono font-semibold text-hope-ink">
                  {formatMoney(funding.spentAmount, funding.currency)}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-hope-ink-soft">Disponible</dt>
                <dd className="tabular font-mono font-semibold text-hope-ink">
                  {formatMoney(funding.availableAmount, funding.currency)}
                </dd>
              </div>
            </dl>

            <ButtonLink to={`/projects/${project.id}/donate`} size="lg" fullWidth className="mt-6">
              <Heart className="size-5" aria-hidden="true" />
              Soutenir ce projet
            </ButtonLink>

            {/* Plusieurs devises : on les liste séparément, sans jamais les
                additionner — HOPE ne convertit pas. */}
            {project.fundingByCurrency.length > 1 && (
              <div className="mt-5 border-t border-hope-blue-mist pt-4">
                <p className="text-xs font-semibold tracking-wide text-hope-ink-soft uppercase">
                  Autres devises reçues
                </p>
                <ul className="mt-2 space-y-1 text-sm">
                  {project.fundingByCurrency
                    .filter((entry) => entry.currency !== funding.currency)
                    .map((entry) => (
                      <li key={entry.currency} className="flex justify-between gap-3">
                        <span className="text-hope-ink-soft">{entry.currency}</span>
                        <span className="tabular font-mono font-semibold">
                          {formatMoney(entry.fundedAmount, entry.currency)}
                        </span>
                      </li>
                    ))}
                </ul>
              </div>
            )}
          </Card>
        </div>
      </Container>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Corps
// ---------------------------------------------------------------------------

function ProjectBody({ project }: { project: ProjectDetail }) {
  return (
    <Section tone="white">
      <Container size="wide">
        <div className="grid gap-12 lg:grid-cols-[1.6fr_1fr]">
          <div className="space-y-12">
            <BudgetSection project={project} />
            <ExpensesSection expenses={project.expenses} />
          </div>

          <aside className="space-y-8">
            <BeneficiariesPanel project={project} />
            <ImpactPanel project={project} />
          </aside>
        </div>
      </Container>
    </Section>
  );
}

/**
 * « Comment votre don est utilisé ».
 *
 * On montre le budget voté ET sa consommation réelle, ligne par ligne. Un
 * budget seul est une intention ; c'est la confrontation avec les dépenses qui
 * fait la transparence.
 */
function BudgetSection({ project }: { project: ProjectDetail }) {
  const budgets = project.budgets.filter((budget) => budget.status !== 'CANCELLED');

  return (
    <div>
      <div className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className="flex size-10 items-center justify-center rounded-hope bg-hope-lavender/60 text-hope-purple"
        >
          <Wallet className="size-5" />
        </span>
        <h2 className="font-display text-2xl font-semibold text-hope-purple">
          Comment votre don est utilisé
        </h2>
      </div>

      <p className="mt-3 max-w-2xl leading-relaxed text-hope-ink-soft">
        Le budget est ce que l’équipe prévoit de dépenser. Les montants dépensés en regard sont
        les sorties d’argent réellement validées et payées.
      </p>

      {budgets.length === 0 ? (
        <Alert tone="info" className="mt-6">
          Le budget détaillé de ce projet n’est pas encore publié. Il le sera dès que l’équipe
          financière l’aura voté.
        </Alert>
      ) : (
        <div className="mt-6 space-y-6">
          {budgets.map((budget) => (
            <BudgetCard key={budget.id} budget={budget} />
          ))}
        </div>
      )}
    </div>
  );
}

function BudgetCard({ budget }: { budget: Budget }) {
  return (
    <Card className="p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="font-display text-lg font-semibold text-hope-purple">{budget.name}</h3>
          <p className="tabular mt-1 font-mono text-sm text-hope-ink-soft">
            Enveloppe : {formatMoney(budget.totalAmount, budget.currency)}
          </p>
        </div>
        <Badge tone={budget.status === 'ACTIVE' ? 'blue' : 'neutral'}>
          {budget.status === 'ACTIVE' ? 'En cours' : budget.status === 'CLOSED' ? 'Clos' : 'Préparé'}
        </Badge>
      </div>

      <div className="mt-5">
        <ProgressBar
          value={budget.consumptionRate}
          label={`Consommation du budget : ${budget.consumptionRate}%`}
          tone="purple"
        />
        <div className="mt-2 flex flex-wrap justify-between gap-2 text-sm">
          <span className="text-hope-ink-soft">
            {formatMoney(budget.totalSpent, budget.currency)} dépensés (
            {budget.consumptionRate}%)
          </span>
          <span className="font-semibold text-hope-ink">
            {formatMoney(budget.remainingAmount, budget.currency)} restants
          </span>
        </div>
      </div>

      {budget.items.length > 0 && (
        <div className="mt-6 border-t border-hope-blue-mist/70 pt-5">
          <h4 className="text-sm font-semibold text-hope-ink">Répartition prévue</h4>
          <ul className="mt-4 space-y-4">
            {budget.items.map((item) => (
              <li key={item.id}>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-medium text-hope-ink">{item.name}</span>
                  <span className="tabular font-mono text-sm text-hope-ink-soft">
                    {formatMoney(item.spentAmount, budget.currency)} /{' '}
                    {formatMoney(item.plannedAmount, budget.currency)}
                  </span>
                </div>
                <div className="mt-2">
                  <ProgressBar
                    value={item.consumptionRate}
                    label={`${item.name} : ${item.consumptionRate}% consommés`}
                    tone="blue"
                    size="sm"
                  />
                </div>
                {item.description && (
                  <p className="mt-1.5 text-xs text-hope-ink-soft">{item.description}</p>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}

/** Dépenses publiées : uniquement celles validées ou payées. */
function ExpensesSection({ expenses }: { expenses: PublicExpense[] }) {
  return (
    <div>
      <div className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className="flex size-10 items-center justify-center rounded-hope bg-hope-orange/15 text-hope-orange-deep"
        >
          <Receipt className="size-5" />
        </span>
        <h2 className="font-display text-2xl font-semibold text-hope-purple">
          Dépenses engagées
        </h2>
      </div>

      {expenses.length === 0 ? (
        <Alert tone="info" className="mt-6">
          Aucune dépense n’a encore été engagée sur ce projet. Les fonds reçus sont disponibles et
          seront publiés ici dès la première sortie d’argent.
        </Alert>
      ) : (
        <ul className="mt-6 divide-y divide-hope-blue-mist/70 overflow-hidden rounded-hope-lg border border-hope-blue-mist">
          {expenses.map((expense) => (
            <li key={expense.id} className="flex flex-wrap gap-4 bg-white p-5">
              <div className="min-w-0 flex-1">
                <p className="font-medium text-hope-ink">{expense.description}</p>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-hope-ink-soft">
                  <span className="font-mono">{expense.reference}</span>
                  <span>{formatDate(expense.expenseDate)}</span>
                  <span>{EXPENSE_STATUS_LABELS[expense.status] ?? expense.status}</span>
                  {expense.documentCount > 0 && (
                    <span className="inline-flex items-center gap-1 font-medium text-hope-purple">
                      <FileCheck2 className="size-3.5" aria-hidden="true" />
                      {expense.documentCount} justificatif
                      {expense.documentCount > 1 ? 's' : ''}
                    </span>
                  )}
                </div>
              </div>
              <p className="tabular shrink-0 font-mono font-semibold text-hope-ink">
                {formatMoney(expense.amount, expense.currency)}
              </p>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-4 text-xs text-hope-ink-soft">
        Les justificatifs sont archivés et vérifiables par nos auditeurs. Ils ne sont pas publiés
        en ligne car ils comportent des données personnelles de tiers.
      </p>
    </div>
  );
}

function BeneficiariesPanel({ project }: { project: ProjectDetail }) {
  const groups = new Map<string, number>();
  for (const beneficiary of project.beneficiaries) {
    const label = BENEFICIARY_TYPE_LABELS[beneficiary.beneficiaryType] ?? beneficiary.beneficiaryType;
    groups.set(label, (groups.get(label) ?? 0) + 1);
  }

  return (
    <Card className="p-6">
      <div className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className="flex size-10 items-center justify-center rounded-hope bg-hope-blue-light text-hope-purple"
        >
          <Users className="size-5" />
        </span>
        <h2 className="font-display text-lg font-semibold text-hope-purple">Bénéficiaires</h2>
      </div>

      {project.beneficiaryCount === 0 ? (
        <p className="mt-4 text-sm text-hope-ink-soft">
          Les bénéficiaires de ce projet seront identifiés au démarrage des activités.
        </p>
      ) : (
        <>
          <p className="tabular mt-4 font-mono text-3xl font-bold text-hope-purple">
            {project.beneficiaryCount}
          </p>
          <p className="text-sm text-hope-ink-soft">
            personne{project.beneficiaryCount > 1 ? 's' : ''} accompagnée
            {project.beneficiaryCount > 1 ? 's' : ''}
          </p>

          {groups.size > 0 && (
            <ul className="mt-4 space-y-2 border-t border-hope-blue-mist pt-4 text-sm">
              {[...groups.entries()].map(([label, count]) => (
                <li key={label} className="flex justify-between gap-3">
                  <span className="text-hope-ink-soft">{label}</span>
                  <span className="tabular font-mono font-semibold">{count}</span>
                </li>
              ))}
            </ul>
          )}

          <p className="mt-4 text-xs text-hope-ink-soft">
            Les bénéficiaires sont identifiés par une référence anonyme. Ni leur nom ni leur date
            de naissance ne sont publiés : ce sont souvent des enfants.
          </p>
        </>
      )}
    </Card>
  );
}

function ImpactPanel({ project }: { project: ProjectDetail }) {
  return (
    <div>
      <div className="mb-4 flex items-center gap-3">
        <span
          aria-hidden="true"
          className="flex size-10 items-center justify-center rounded-hope bg-hope-yellow/50 text-hope-orange-deep"
        >
          <Sprout className="size-5" />
        </span>
        <h2 className="font-display text-lg font-semibold text-hope-purple">Impact mesuré</h2>
      </div>

      {project.indicators.length === 0 ? (
        <EmptyState
          icon={Sprout}
          title="Pas encore de mesure"
          description="Les résultats de ce projet seront publiés dès que l’équipe aura enregistré ses premières mesures de terrain."
        />
      ) : (
        <div className="space-y-4">
          {project.indicators.map((indicator) => (
            <IndicatorCard key={indicator.indicator} indicator={indicator} />
          ))}

          {project.impacts.length > 0 && (
            <ul className="space-y-3 pt-2">
              {project.impacts.slice(0, 4).map((impact) => (
                <li
                  key={impact.id}
                  className="rounded-hope border-l-4 border-hope-orange bg-hope-blue-light/40 p-4"
                >
                  <p className="font-semibold text-hope-ink">{impact.title}</p>
                  <p className="mt-1 text-sm leading-relaxed text-hope-ink-soft">
                    {impact.description}
                  </p>
                  <p className="mt-2 text-xs text-hope-ink-soft">
                    Mesuré le {formatDate(impact.measuredAt)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
