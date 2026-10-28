import { ArrowRight, Heart, ShieldCheck, Sprout, Users } from 'lucide-react';
import { ActivityCard } from '@/components/ActivityCard';
import { DonationThreadCompact } from '@/components/impact/DonationThread';
import { ImpactStat } from '@/components/impact/ImpactStat';
import { ProjectCard } from '@/components/projects/ProjectCard';
import {
  Container,
  EmptyState,
  ErrorState,
  ProjectCardSkeleton,
  Section,
  SectionTitle,
} from '@/components/ui';
import { ButtonLink } from '@/components/ui/Button';
import { FEATURED_ACTIVITIES } from '@/constants/activities';
import { useCategories, useProjects, useStats } from '@/hooks/useApi';
import type { PublicStats } from '@/types/api';
import { BENEFICIARY_TYPE_LABELS, formatIndicatorName } from '@/utils/format';
import { formatIndicatorValue } from '@/utils/money';

/**
 * PAGE D'ACCUEIL.
 *
 * Elle raconte HOPE dans l'ordre où une question se pose :
 *   qui êtes-vous → que faites-vous → sur quoi → avec quel résultat →
 *   comment savoir que l'argent sert vraiment → comment aider.
 *
 * Tous les chiffres et tous les projets viennent du backend.
 */
export function HomePage() {
  return (
    <>
      <Hero />
      <Activities />
      <Mission />
      <PriorityProjects />
      <Impacts />
      <Transparency />
      <FinalCta />
    </>
  );
}

// ---------------------------------------------------------------------------
// 1. Hero
// ---------------------------------------------------------------------------

function Hero() {
  const { data: stats } = useStats();

  return (
    <section className="relative overflow-hidden bg-hope-blue-light/50">
      {/* Aplat décoratif, très discret : il réchauffe le fond sans attirer
          l'œil ailleurs que sur le message. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-32 -right-32 size-[30rem] rounded-full bg-hope-lavender/40 blur-3xl"
      />

      <Container size="wide" className="relative py-20 lg:py-28">
        <div className="grid items-center gap-12 lg:grid-cols-[1.15fr_1fr]">
          <div className="animate-hope-rise">
            <p className="mb-5 inline-flex items-center gap-2 rounded-full bg-white px-4 py-1.5 text-sm font-semibold text-hope-purple shadow-hope-sm">
              <Sprout className="size-4 text-hope-orange" aria-hidden="true" />
              Organisation à but non lucratif · Madagascar
            </p>

            <h1 className="text-4xl leading-[1.08] text-hope-purple sm:text-5xl lg:text-6xl">
              Ensemble, construisons
              <br />
              un avenir meilleur.
            </h1>

            <p className="mt-6 max-w-xl text-lg leading-relaxed text-hope-ink-soft">
              HOPE accompagne les enfants orphelins et les mères célibataires de Madagascar vers
              une autonomie durable : école, santé, alimentation, métier. Pas seulement une aide —
              une trajectoire.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <ButtonLink to="/donate" size="lg">
                <Heart className="size-5" aria-hidden="true" />
                Faire un don
              </ButtonLink>
              <ButtonLink to="/projects" variant="outline" size="lg">
                Découvrir nos projets
                <ArrowRight className="size-5" aria-hidden="true" />
              </ButtonLink>
            </div>

            {stats && <HeroFigures stats={stats} />}
          </div>

          <HeroPledge />
        </div>
      </Container>
    </section>
  );
}

/** Trois chiffres réels, lus dans la base au chargement de la page. */
function HeroFigures({ stats }: { stats: PublicStats }) {
  const orphans = stats.beneficiaries.byType.find((entry) => entry.type === 'ORPHAN')?.count ?? 0;
  const mothers =
    stats.beneficiaries.byType.find((entry) => entry.type === 'SINGLE_MOTHER')?.count ?? 0;

  const figures = [
    { value: orphans, label: 'enfants orphelins' },
    { value: mothers, label: 'mères célibataires' },
    { value: stats.projects.active, label: 'projets en cours' },
  ].filter((figure) => figure.value > 0);

  if (figures.length === 0) return null;

  return (
    <dl className="mt-10 flex flex-wrap gap-x-10 gap-y-4 border-t border-hope-blue-mist pt-6">
      {figures.map((figure) => (
        <div key={figure.label}>
          <dt className="sr-only">{figure.label}</dt>
          <dd>
            <span className="tabular block font-mono text-3xl font-bold text-hope-purple">
              {figure.value}
            </span>
            <span className="mt-0.5 block text-sm text-hope-ink-soft">{figure.label}</span>
          </dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * L'engagement de traçabilité, posé dès le hero.
 *
 * C'est la promesse la plus distinctive de HOPE, et elle est tenue par le
 * modèle de données : autant l'annoncer immédiatement plutôt que de l'enfouir
 * dans une page « À propos ».
 */
function HeroPledge() {
  return (
    <div className="rounded-hope-xl border-2 border-white bg-white/70 p-7 shadow-hope backdrop-blur-sm lg:p-8">
      <span
        aria-hidden="true"
        className="inline-flex size-12 items-center justify-center rounded-hope bg-hope-purple text-white"
      >
        <ShieldCheck className="size-6" />
      </span>

      <h2 className="mt-5 font-display text-2xl font-semibold text-hope-purple">
        Vous saurez où va votre don
      </h2>

      <p className="mt-3 text-sm leading-relaxed text-hope-ink-soft">
        Chaque don reçu est rattaché à un projet, chaque dépense à une ligne de budget, chaque
        dépense à un justificatif. Ce n’est pas une intention : c’est la façon dont notre système
        est construit.
      </p>

      <ul className="mt-5 space-y-2.5 text-sm">
        {[
          'Seuls les paiements réellement encaissés alimentent les projets.',
          'Un don ne peut jamais être affecté au-delà de ce qui a été reçu.',
          'Une dépense ne peut pas dépasser les fonds disponibles.',
        ].map((line) => (
          <li key={line} className="flex gap-2.5 text-hope-ink">
            <span aria-hidden="true" className="mt-2 size-1.5 shrink-0 rounded-full bg-hope-orange" />
            {line}
          </li>
        ))}
      </ul>

      <ButtonLink to="/transparency" variant="ghost" size="sm" className="mt-5 -ml-3">
        Comprendre notre transparence
        <ArrowRight className="size-4" aria-hidden="true" />
      </ButtonLink>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 2. Activités
// ---------------------------------------------------------------------------

function Activities() {
  const { data: categories } = useCategories();
  const { data: projects } = useProjects({ take: 60 });

  const countByCategory = new Map<string, number>();
  for (const project of projects ?? []) {
    const name = project.category?.name;
    if (name) countByCategory.set(name, (countByCategory.get(name) ?? 0) + 1);
  }

  return (
    <Section tone="white">
      <Container size="wide">
        <SectionTitle
          eyebrow="Nos activités"
          title="Quatre leviers pour sortir durablement de la précarité"
          description="Aider une famille sur un seul front ne suffit pas : un enfant nourri mais déscolarisé, ou scolarisé mais malade, reste vulnérable. HOPE agit sur les quatre en même temps."
        />

        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURED_ACTIVITIES.map((activity) => (
            <ActivityCard
              key={activity.categoryName}
              activity={activity}
              categoryId={categories?.find((c) => c.name === activity.categoryName)?.id}
              projectCount={countByCategory.get(activity.categoryName)}
            />
          ))}
        </div>

        <div className="mt-10">
          <ButtonLink to="/activities" variant="outline">
            Voir toutes nos activités
            <ArrowRight className="size-4" aria-hidden="true" />
          </ButtonLink>
        </div>
      </Container>
    </Section>
  );
}

// ---------------------------------------------------------------------------
// 3. Mission
// ---------------------------------------------------------------------------

function Mission() {
  return (
    <Section tone="mist">
      <Container size="wide">
        <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
          <div>
            <SectionTitle
              eyebrow="Qui nous sommes"
              title="Accompagner, pas assister"
              description="HOPE est née d’un constat simple : à Madagascar, une aide ponctuelle soulage un mois, puis tout recommence. Nous construisons des parcours qui tiennent dans le temps."
            />

            <div className="mt-8 space-y-4 text-hope-ink-soft">
              <p className="leading-relaxed">
                Nous accompagnons deux publics dont les difficultés se ressemblent : les enfants
                orphelins, privés du soutien familial qui rend l’école possible, et les mères
                célibataires, qui doivent gagner leur vie sans pouvoir confier leurs enfants.
              </p>
              <p className="leading-relaxed">
                Pour chacun, nous suivons la même méthode : stabiliser l’essentiel — manger, se
                soigner —, puis construire ce qui rendra la famille autonome — l’école pour les
                enfants, un métier pour les mères.
              </p>
            </div>

            <ButtonLink to="/about" variant="outline" className="mt-8">
              En savoir plus sur HOPE
              <ArrowRight className="size-4" aria-hidden="true" />
            </ButtonLink>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            {[
              {
                icon: Users,
                title: 'Deux publics',
                text: 'Enfants orphelins et mères célibataires, accompagnés sur plusieurs années.',
              },
              {
                icon: Sprout,
                title: 'Un objectif',
                text: 'L’autonomie durable, pas la dépendance à l’aide.',
              },
              {
                icon: ShieldCheck,
                title: 'Une méthode',
                text: 'Chaque euro suivi, du paiement jusqu’à l’impact mesuré.',
              },
              {
                icon: Heart,
                title: 'Un ancrage',
                text: 'Des équipes sur place, à Antananarivo, Toamasina et Fianarantsoa.',
              },
            ].map((item) => (
              <div
                key={item.title}
                className="rounded-hope-lg border border-hope-blue-mist bg-white p-6 shadow-hope-sm"
              >
                <item.icon className="size-6 text-hope-orange" aria-hidden="true" />
                <h3 className="mt-4 font-display text-lg font-semibold text-hope-purple">
                  {item.title}
                </h3>
                <p className="mt-1.5 text-sm leading-relaxed text-hope-ink-soft">{item.text}</p>
              </div>
            ))}
          </div>
        </div>
      </Container>
    </Section>
  );
}

// ---------------------------------------------------------------------------
// 4. Projets prioritaires
// ---------------------------------------------------------------------------

function PriorityProjects() {
  const { data: projects, isLoading, isError, refetch } = useProjects({ status: 'ACTIVE', take: 3 });

  return (
    <Section tone="white">
      <Container size="wide">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <SectionTitle
            eyebrow="Nos projets"
            title="Ils attendent votre soutien"
            description="Chaque projet a un budget, des bénéficiaires identifiés et des dépenses justifiées."
          />
          <ButtonLink to="/projects" variant="outline">
            Tous les projets
            <ArrowRight className="size-4" aria-hidden="true" />
          </ButtonLink>
        </div>

        <div className="mt-12">
          {isLoading && (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {[0, 1, 2].map((index) => (
                <ProjectCardSkeleton key={index} />
              ))}
            </div>
          )}

          {isError && (
            <ErrorState
              title="Les projets n’ont pas pu être chargés"
              message="Le serveur HOPE est momentanément injoignable. Vos dons ne sont pas affectés."
              onRetry={() => void refetch()}
            />
          )}

          {!isLoading && !isError && projects?.length === 0 && (
            <EmptyState
              title="Aucun projet publié pour l’instant"
              description="Nos équipes préparent les prochains projets. Un don libre nous permet d’agir là où le besoin est le plus urgent."
              action={
                <ButtonLink to="/donate">
                  <Heart className="size-4" aria-hidden="true" />
                  Faire un don libre
                </ButtonLink>
              }
            />
          )}

          {!isLoading && !isError && projects && projects.length > 0 && (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {projects.map((project) => (
                <ProjectCard key={project.id} project={project} />
              ))}
            </div>
          )}
        </div>
      </Container>
    </Section>
  );
}

// ---------------------------------------------------------------------------
// 5. Impacts
// ---------------------------------------------------------------------------

function Impacts() {
  const { data: stats, isLoading } = useStats();

  const beneficiaryFigures = (stats?.beneficiaries.byType ?? []).map((entry) => ({
    value: String(entry.count),
    label: BENEFICIARY_TYPE_LABELS[entry.type] ?? entry.type,
  }));

  const indicatorFigures = (stats?.indicators ?? []).slice(0, 4).map((indicator) => ({
    value: formatIndicatorValue(indicator.total),
    label: formatIndicatorName(indicator.indicator),
  }));

  const figures = [...beneficiaryFigures, ...indicatorFigures].slice(0, 4);

  return (
    <Section tone="purple">
      <Container size="wide">
        <SectionTitle
          eyebrow="Nos impacts"
          title="Ce que votre soutien a déjà permis"
          description="Ces chiffres sont lus dans notre base au moment où vous ouvrez cette page. Ils bougent quand le terrain bouge."
          align="center"
          inverted
        />

        <div className="mt-14">
          {isLoading && (
            <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
              {[0, 1, 2, 3].map((index) => (
                <div key={index} className="animate-pulse text-center">
                  <div className="mx-auto h-12 w-24 rounded-hope-sm bg-white/15" />
                  <div className="mx-auto mt-3 h-4 w-32 rounded-hope-sm bg-white/10" />
                </div>
              ))}
            </div>
          )}

          {!isLoading && figures.length === 0 && (
            <p className="mx-auto max-w-lg text-center text-white/80">
              Les premiers résultats seront publiés dès que nos équipes auront enregistré leurs
              mesures de terrain.
            </p>
          )}

          {!isLoading && figures.length > 0 && (
            <dl className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
              {figures.map((figure) => (
                <div key={figure.label}>
                  <dt className="sr-only">{figure.label}</dt>
                  <dd>
                    <ImpactStat value={figure.value} label={figure.label} inverted />
                  </dd>
                </div>
              ))}
            </dl>
          )}
        </div>

        <div className="mt-14 text-center">
          <ButtonLink to="/impact" variant="primary">
            Voir le détail de nos impacts
            <ArrowRight className="size-4" aria-hidden="true" />
          </ButtonLink>
        </div>
      </Container>
    </Section>
  );
}

// ---------------------------------------------------------------------------
// 6. Transparence
// ---------------------------------------------------------------------------

function Transparency() {
  return (
    <Section tone="white">
      <Container size="wide">
        <SectionTitle
          eyebrow="Transparence"
          title="Le chemin de votre don"
          description="Un don ne disparaît pas dans un budget global. Il suit une chaîne dont chaque maillon est enregistré, et dont aucun ne peut être sauté."
        />

        <DonationThreadCompact className="mt-12" />

        <div className="mt-12 rounded-hope-lg border-2 border-hope-blue bg-hope-blue-light/60 p-6 sm:p-8">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <p className="max-w-2xl leading-relaxed text-hope-ink">
              <strong className="font-semibold text-hope-purple">
                Un don ne peut pas être affecté avant d’être encaissé.
              </strong>{' '}
              Tant qu’un paiement est en attente ou a échoué, il ne compte pas dans les fonds
              disponibles d’un projet. C’est une règle vérifiée par le système, pas une promesse.
            </p>
            <ButtonLink to="/transparency" variant="secondary" className="shrink-0">
              Voir la chaîne complète
              <ArrowRight className="size-4" aria-hidden="true" />
            </ButtonLink>
          </div>
        </div>
      </Container>
    </Section>
  );
}

// ---------------------------------------------------------------------------
// 7. Appel final
// ---------------------------------------------------------------------------

function FinalCta() {
  return (
    <Section tone="lavender" spacing="tight">
      <Container size="narrow" className="text-center">
        <h2 className="text-3xl text-hope-purple sm:text-4xl">
          Chaque contribution peut changer une vie.
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-lg leading-relaxed text-hope-ink-soft">
          Un don ponctuel, ou quelques milliers d’ariary chaque mois : ce qui compte, c’est la
          régularité avec laquelle un enfant peut retourner en classe.
        </p>

        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <ButtonLink to="/donate" size="lg">
            <Heart className="size-5" aria-hidden="true" />
            Faire un don
          </ButtonLink>
          <ButtonLink to="/partner" variant="outline" size="lg">
            Devenir partenaire
          </ButtonLink>
        </div>
      </Container>
    </Section>
  );
}
