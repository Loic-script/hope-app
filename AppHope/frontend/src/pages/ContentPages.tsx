import {
  ArrowRight,
  Building2,
  Handshake,
  Heart,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
  Sprout,
  Target,
  Users,
} from 'lucide-react';
import { ActivityCard } from '@/components/ActivityCard';
import { DonationThread } from '@/components/impact/DonationThread';
import { IndicatorCard, ImpactStat } from '@/components/impact/ImpactStat';
import {
  Alert,
  Card,
  Container,
  EmptyState,
  ErrorState,
  Section,
  SectionTitle,
  Skeleton,
} from '@/components/ui';
import { ButtonLink } from '@/components/ui/Button';
import { ACTIVITIES } from '@/constants/activities';
import { useCategories, useStats } from '@/hooks/useApi';
import { BENEFICIARY_TYPE_LABELS } from '@/utils/format';
import { formatMoney } from '@/utils/money';

/* ===========================================================================
   NOS ACTIVITÉS
   =========================================================================== */

export function ActivitiesPage() {
  const { data: categories } = useCategories();

  return (
    <>
      <Section tone="mist" spacing="tight">
        <Container size="wide">
          <SectionTitle
            eyebrow="Nos activités"
            title="Sept façons d’accompagner une famille vers l’autonomie"
            description="Aider sur un seul front ne suffit pas. Un enfant nourri mais déscolarisé, ou scolarisé mais malade, reste vulnérable. Nos activités se répondent."
            as="h1"
          />
        </Container>
      </Section>

      <Section tone="white">
        <Container size="wide">
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {ACTIVITIES.map((activity) => (
              <ActivityCard
                key={activity.categoryName}
                activity={activity}
                categoryId={categories?.find((c) => c.name === activity.categoryName)?.id}
              />
            ))}
          </div>
        </Container>
      </Section>

      <Section tone="lavender" spacing="tight">
        <Container size="narrow" className="text-center">
          <h2 className="text-3xl text-hope-purple">Soutenir une activité en particulier</h2>
          <p className="mx-auto mt-4 max-w-xl leading-relaxed text-hope-ink-soft">
            Chaque activité se traduit en projets concrets, avec un budget et des bénéficiaires
            identifiés. Choisissez celui que vous souhaitez financer.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <ButtonLink to="/projects" variant="secondary">
              Voir les projets
              <ArrowRight className="size-4" aria-hidden="true" />
            </ButtonLink>
            <ButtonLink to="/donate">
              <Heart className="size-4" aria-hidden="true" />
              Faire un don
            </ButtonLink>
          </div>
        </Container>
      </Section>
    </>
  );
}

/* ===========================================================================
   NOS IMPACTS
   =========================================================================== */

export function ImpactPage() {
  const { data: stats, isLoading, isError, refetch } = useStats();

  return (
    <>
      <Section tone="purple" spacing="tight">
        <Container size="wide">
          <SectionTitle
            eyebrow="Nos impacts"
            title="Ce que vos dons ont permis"
            description="Ces chiffres sont lus dans notre base de données au moment où vous ouvrez cette page. Ils ne sont pas arrondis pour faire joli : ils bougent quand le terrain bouge."
            as="h1"
            inverted
          />
        </Container>
      </Section>

      <Section tone="white">
        <Container size="wide">
          {isLoading && (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {[0, 1, 2, 3].map((index) => (
                <Skeleton key={index} className="h-36 w-full" />
              ))}
            </div>
          )}

          {isError && (
            <ErrorState
              title="Les chiffres n’ont pas pu être chargés"
              onRetry={() => void refetch()}
            />
          )}

          {stats && (
            <>
              {/* --- Personnes accompagnées --- */}
              <div>
                <h2 className="font-display text-2xl font-semibold text-hope-purple">
                  Les personnes que nous accompagnons
                </h2>

                {stats.beneficiaries.total === 0 ? (
                  <EmptyState
                    icon={Users}
                    title="Aucun bénéficiaire enregistré pour l’instant"
                    description="Les personnes accompagnées apparaîtront ici dès que nos équipes de terrain les auront enregistrées."
                  />
                ) : (
                  <dl className="mt-8 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
                    {stats.beneficiaries.byType.map((entry) => (
                      <div key={entry.type}>
                        <dt className="sr-only">
                          {BENEFICIARY_TYPE_LABELS[entry.type] ?? entry.type}
                        </dt>
                        <dd>
                          <ImpactStat
                            value={String(entry.count)}
                            label={BENEFICIARY_TYPE_LABELS[entry.type] ?? entry.type}
                            icon={Users}
                          />
                        </dd>
                      </div>
                    ))}
                    <div>
                      <dt className="sr-only">Projets en cours</dt>
                      <dd>
                        <ImpactStat
                          value={String(stats.projects.active)}
                          label="Projets en cours"
                          hint={`${stats.projects.completed} projet${stats.projects.completed > 1 ? 's' : ''} terminé${stats.projects.completed > 1 ? 's' : ''}`}
                          icon={Target}
                        />
                      </dd>
                    </div>
                  </dl>
                )}
              </div>

              {/* --- Indicateurs mesurés --- */}
              <div className="mt-20">
                <h2 className="font-display text-2xl font-semibold text-hope-purple">
                  Nos résultats mesurés
                </h2>
                <p className="mt-3 max-w-2xl leading-relaxed text-hope-ink-soft">
                  Chaque indicateur est la somme des mesures relevées sur le terrain, projet par
                  projet.
                </p>

                {stats.indicators.length === 0 ? (
                  <EmptyState
                    icon={Sprout}
                    title="Pas encore de mesure publiée"
                    description="Nos équipes enregistrent les résultats au fil des projets. Les premiers indicateurs apparaîtront ici prochainement."
                  />
                ) : (
                  <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                    {stats.indicators.map((indicator) => (
                      <IndicatorCard key={indicator.indicator} indicator={indicator} />
                    ))}
                  </div>
                )}
              </div>

              {/* --- Fonds affectés --- */}
              {stats.funding.length > 0 && (
                <div className="mt-20">
                  <h2 className="font-display text-2xl font-semibold text-hope-purple">
                    Fonds affectés à des projets
                  </h2>
                  <p className="mt-3 max-w-2xl leading-relaxed text-hope-ink-soft">
                    Ces montants proviennent uniquement de paiements encaissés. Les devises ne
                    sont jamais additionnées entre elles : HOPE n’effectue aucune conversion.
                  </p>

                  <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                    {stats.funding.map((entry) => (
                      <Card key={entry.currency} className="p-6">
                        <p className="tabular font-mono text-3xl font-bold text-hope-purple">
                          {formatMoney(entry.totalAllocated, entry.currency)}
                        </p>
                        <p className="mt-1.5 text-sm text-hope-ink-soft">
                          affectés en {entry.currency} · {entry.allocationCount} affectation
                          {entry.allocationCount > 1 ? 's' : ''}
                        </p>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </Container>
      </Section>

      <Section tone="lavender" spacing="tight">
        <Container size="narrow" className="text-center">
          <h2 className="text-3xl text-hope-purple">Faire grandir ces chiffres</h2>
          <p className="mx-auto mt-4 max-w-xl leading-relaxed text-hope-ink-soft">
            Derrière chaque nombre, il y a une famille. Votre don en ajoute une.
          </p>
          <ButtonLink to="/donate" size="lg" className="mt-8">
            <Heart className="size-5" aria-hidden="true" />
            Faire un don
          </ButtonLink>
        </Container>
      </Section>
    </>
  );
}

/* ===========================================================================
   TRANSPARENCE
   =========================================================================== */

export function TransparencyPage() {
  return (
    <>
      <Section tone="mist" spacing="tight">
        <Container size="wide">
          <SectionTitle
            eyebrow="Transparence"
            title="Où va votre argent, exactement"
            description="La plupart des organisations promettent qu’un pourcentage va « au terrain ». Nous préférons montrer la chaîne complète, maillon par maillon."
            as="h1"
          />
        </Container>
      </Section>

      <Section tone="white">
        <Container size="wide">
          <div className="grid gap-14 lg:grid-cols-[1fr_1.1fr]">
            <div>
              <h2 className="font-display text-2xl font-semibold text-hope-purple">
                Les sept maillons
              </h2>
              <p className="mt-3 leading-relaxed text-hope-ink-soft">
                Chaque étape est enregistrée dans notre système. Aucune ne peut être sautée : on
                ne peut pas dépenser un argent qui n’a pas été encaissé, ni justifier une dépense
                qui n’existe pas.
              </p>

              <div className="mt-8">
                <DonationThread />
              </div>
            </div>

            <div className="space-y-6">
              <h2 className="font-display text-2xl font-semibold text-hope-purple">
                Les règles que notre système fait respecter
              </h2>
              <p className="leading-relaxed text-hope-ink-soft">
                Ce ne sont pas des engagements moraux : ce sont des contrôles techniques. Une
                opération qui les enfreint est refusée par le logiciel, pas simplement
                déconseillée.
              </p>

              <ul className="space-y-4">
                {[
                  {
                    title: 'Un don en attente n’est pas un don reçu',
                    text: 'Tant qu’un paiement n’est pas encaissé, il ne compte dans aucun total. Un paiement échoué non plus.',
                  },
                  {
                    title: 'On n’affecte jamais plus que ce qui est arrivé',
                    text: 'La somme affectée à des projets ne peut pas dépasser le montant net réellement encaissé.',
                  },
                  {
                    title: 'Une dépense ne peut pas dépasser les fonds du projet',
                    text: 'Ni son budget voté, ni la trésorerie réellement disponible. Les deux plafonds sont vérifiés.',
                  },
                  {
                    title: 'Une transaction encaissée n’est jamais supprimée',
                    text: 'Elle peut être remboursée — ce qui laisse une trace — mais jamais effacée de l’historique.',
                  },
                  {
                    title: 'Chaque opération financière est journalisée',
                    text: 'Création, confirmation, échec, remboursement, affectation : tout est horodaté et conservé.',
                  },
                ].map((rule) => (
                  <li key={rule.title}>
                    <Card className="p-5">
                      <div className="flex gap-3">
                        <ShieldCheck
                          className="mt-0.5 size-5 shrink-0 text-hope-orange"
                          aria-hidden="true"
                        />
                        <div>
                          <h3 className="font-semibold text-hope-ink">{rule.title}</h3>
                          <p className="mt-1 text-sm leading-relaxed text-hope-ink-soft">
                            {rule.text}
                          </p>
                        </div>
                      </div>
                    </Card>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <Alert tone="info" className="mt-14" title="Ce que nous ne stockons pas">
            <p>
              HOPE n’enregistre aucune donnée bancaire : ni numéro de carte, ni code de sécurité,
              ni coordonnées de compte. Nos prestataires de paiement ne nous transmettent qu’une
              référence anonyme, qui ne permet ni de débiter ni d’identifier un moyen de paiement.
            </p>
          </Alert>
        </Container>
      </Section>

      <Section tone="purple" spacing="tight">
        <Container size="narrow" className="text-center">
          <h2 className="text-3xl text-white">Vérifiez par vous-même</h2>
          <p className="mx-auto mt-4 max-w-xl leading-relaxed text-white/85">
            Ouvrez n’importe quel projet : vous y trouverez son budget, ses lignes budgétaires,
            ses dépenses engagées et le nombre de justificatifs archivés.
          </p>
          <ButtonLink to="/projects" className="mt-8">
            Explorer les projets
            <ArrowRight className="size-4" aria-hidden="true" />
          </ButtonLink>
        </Container>
      </Section>
    </>
  );
}

/* ===========================================================================
   À PROPOS
   =========================================================================== */

export function AboutPage() {
  const { data: stats } = useStats();

  return (
    <>
      <Section tone="mist" spacing="tight">
        <Container size="wide">
          <SectionTitle
            eyebrow="À propos"
            title="HOPE — Hope for a Better Life"
            description="Une organisation à but non lucratif malgache, qui accompagne les enfants orphelins et les mères célibataires vers une autonomie durable."
            as="h1"
          />
        </Container>
      </Section>

      <Section tone="white">
        <Container size="wide">
          <div className="grid gap-14 lg:grid-cols-2">
            <div className="space-y-5 text-hope-ink-soft">
              <h2 className="font-display text-2xl font-semibold text-hope-purple">
                Pourquoi HOPE existe
              </h2>
              <p className="leading-relaxed">
                À Madagascar, perdre ses parents ou élever seule ses enfants ne relève pas
                seulement du drame familial : c’est une trajectoire de précarité qui se referme
                vite. L’école devient impossible à payer, les soins passent après le repas, et un
                emploi stable reste hors d’atteinte sans qualification.
              </p>
              <p className="leading-relaxed">
                HOPE a été fondée sur un constat : l’aide ponctuelle soulage un mois, puis tout
                recommence. Ce qui change une trajectoire, c’est un accompagnement suivi, sur
                plusieurs années, qui traite ensemble l’école, la santé, l’alimentation et le
                revenu.
              </p>

              <h2 className="pt-4 font-display text-2xl font-semibold text-hope-purple">
                Notre méthode
              </h2>
              <p className="leading-relaxed">
                Nous commençons par stabiliser l’essentiel — manger, se soigner — parce qu’aucun
                projet ne tient sur une famille qui a faim. Puis nous construisons ce qui rendra
                cette famille autonome : la scolarité des enfants, une formation puis un métier
                pour la mère.
              </p>
              <p className="leading-relaxed">
                Chaque bénéficiaire est suivi individuellement, projet par projet, avec des
                résultats mesurés. C’est ce suivi qui nous permet de savoir ce qui fonctionne
                vraiment.
              </p>
            </div>

            <div>
              <Card className="p-7">
                <h2 className="font-display text-xl font-semibold text-hope-purple">
                  HOPE en chiffres
                </h2>
                <p className="mt-2 text-sm text-hope-ink-soft">
                  Lus dans notre base à l’instant.
                </p>

                <dl className="mt-6 space-y-5">
                  {[
                    {
                      label: 'Personnes accompagnées',
                      value: stats?.beneficiaries.total ?? 0,
                      icon: Users,
                    },
                    { label: 'Projets en cours', value: stats?.projects.active ?? 0, icon: Target },
                    {
                      label: 'Projets menés à terme',
                      value: stats?.projects.completed ?? 0,
                      icon: Sprout,
                    },
                  ].map((row) => (
                    <div key={row.label} className="flex items-center gap-4">
                      <span
                        aria-hidden="true"
                        className="flex size-11 shrink-0 items-center justify-center rounded-hope bg-hope-lavender/60 text-hope-purple"
                      >
                        <row.icon className="size-5" />
                      </span>
                      <div>
                        <dt className="text-sm text-hope-ink-soft">{row.label}</dt>
                        <dd className="tabular font-mono text-2xl font-bold text-hope-purple">
                          {row.value}
                        </dd>
                      </div>
                    </div>
                  ))}
                </dl>
              </Card>

              <Card className="mt-6 p-7">
                <h2 className="font-display text-xl font-semibold text-hope-purple">Nos valeurs</h2>
                <ul className="mt-5 space-y-4">
                  {[
                    {
                      title: 'Dignité',
                      text: 'Nous accompagnons des personnes, pas des dossiers. Rien n’est publié qui puisse les exposer.',
                    },
                    {
                      title: 'Transparence',
                      text: 'Chaque don est traçable, du paiement jusqu’à l’impact mesuré.',
                    },
                    {
                      title: 'Durée',
                      text: 'Nous nous engageons sur des années, parce qu’une trajectoire ne se change pas en un mois.',
                    },
                  ].map((value) => (
                    <li key={value.title}>
                      <h3 className="font-semibold text-hope-ink">{value.title}</h3>
                      <p className="mt-0.5 text-sm leading-relaxed text-hope-ink-soft">
                        {value.text}
                      </p>
                    </li>
                  ))}
                </ul>
              </Card>
            </div>
          </div>
        </Container>
      </Section>
    </>
  );
}

/* ===========================================================================
   CONTACT
   =========================================================================== */

export function ContactPage() {
  return (
    <Section tone="mist">
      <Container size="wide">
        <div className="grid gap-12 lg:grid-cols-2">
          <div>
            <SectionTitle
              eyebrow="Contact"
              title="Parlons-en"
              description="Une question sur un don, un projet, un partenariat ? Nous répondons sous 48 heures ouvrées."
              as="h1"
            />

            <div className="mt-10 space-y-5">
              {[
                {
                  icon: Mail,
                  label: 'Email',
                  value: 'contact@hope-madagascar.org',
                  href: 'mailto:contact@hope-madagascar.org',
                },
                {
                  icon: Phone,
                  label: 'Téléphone',
                  value: '+261 34 00 000 00',
                  href: 'tel:+261340000000',
                },
                {
                  icon: MapPin,
                  label: 'Adresse',
                  value: 'Antananarivo, Madagascar',
                },
              ].map((item) => (
                <Card key={item.label} className="p-5">
                  <div className="flex items-start gap-4">
                    <span
                      aria-hidden="true"
                      className="flex size-11 shrink-0 items-center justify-center rounded-hope bg-hope-lavender/60 text-hope-purple"
                    >
                      <item.icon className="size-5" />
                    </span>
                    <div>
                      <p className="text-sm text-hope-ink-soft">{item.label}</p>
                      {item.href ? (
                        <a
                          href={item.href}
                          className="font-semibold text-hope-purple underline-offset-4 hover:underline"
                        >
                          {item.value}
                        </a>
                      ) : (
                        <p className="font-semibold text-hope-ink">{item.value}</p>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>

          <Card className="p-7 sm:p-8">
            <h2 className="font-display text-xl font-semibold text-hope-purple">
              Questions fréquentes
            </h2>

            <dl className="mt-6 space-y-6">
              {[
                {
                  q: 'Mon don est-il déductible des impôts ?',
                  a: 'Un reçu vous est envoyé par email après chaque don encaissé. Sa déductibilité dépend de votre pays de résidence fiscale ; écrivez-nous pour votre situation.',
                },
                {
                  q: 'Puis-je arrêter un don mensuel ?',
                  a: 'À tout moment, sans justification. Écrivez-nous avec votre référence de transaction et l’engagement est clôturé — les échéances déjà encaissées restent acquises aux projets.',
                },
                {
                  q: 'Comment savoir ce qu’est devenu mon don ?',
                  a: 'Chaque projet publie son budget, ses dépenses engagées et ses impacts mesurés. Avec votre référence de transaction, nous pouvons vous indiquer précisément le projet financé.',
                },
                {
                  q: 'HOPE conserve-t-elle mes données bancaires ?',
                  a: 'Non. Aucun numéro de carte, aucun code de sécurité, aucune coordonnée bancaire n’est enregistré. Nous ne conservons qu’une référence anonyme du prestataire de paiement.',
                },
              ].map((item) => (
                <div key={item.q}>
                  <dt className="font-semibold text-hope-ink">{item.q}</dt>
                  <dd className="mt-1.5 text-sm leading-relaxed text-hope-ink-soft">{item.a}</dd>
                </div>
              ))}
            </dl>
          </Card>
        </div>
      </Container>
    </Section>
  );
}

/* ===========================================================================
   PARTENAIRES
   =========================================================================== */

export function PartnerPage() {
  return (
    <>
      <Section tone="purple" spacing="tight">
        <Container size="wide">
          <SectionTitle
            eyebrow="Partenariats"
            title="Engager votre organisation aux côtés de HOPE"
            description="Entreprises, fondations, associations : un partenariat permet de financer un projet entier, sur plusieurs années, avec un reporting dédié."
            as="h1"
            inverted
          />
        </Container>
      </Section>

      <Section tone="white">
        <Container size="wide">
          <div className="grid gap-6 md:grid-cols-3">
            {[
              {
                icon: Building2,
                title: 'Mécénat d’entreprise',
                text: 'Financez un projet complet et recevez un reporting trimestriel : budget consommé, dépenses justifiées, impacts mesurés.',
              },
              {
                icon: Handshake,
                title: 'Partenariat opérationnel',
                text: 'Mettez vos compétences au service du terrain : formation professionnelle, insertion, santé, logistique.',
              },
              {
                icon: Sprout,
                title: 'Fondation',
                text: 'Soutenez un programme pluriannuel avec des indicateurs d’impact définis ensemble dès le départ.',
              },
            ].map((item) => (
              <Card key={item.title} className="p-7">
                <span
                  aria-hidden="true"
                  className="flex size-12 items-center justify-center rounded-hope bg-hope-lavender/60 text-hope-purple"
                >
                  <item.icon className="size-6" />
                </span>
                <h2 className="mt-5 font-display text-lg font-semibold text-hope-purple">
                  {item.title}
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-hope-ink-soft">{item.text}</p>
              </Card>
            ))}
          </div>

          <div className="mt-14 rounded-hope-lg border-2 border-hope-blue bg-hope-blue-light/60 p-7 sm:p-10">
            <div className="grid gap-8 lg:grid-cols-[1.4fr_1fr] lg:items-center">
              <div>
                <h2 className="font-display text-2xl font-semibold text-hope-purple">
                  Ce que nous nous engageons à fournir
                </h2>
                <ul className="mt-5 space-y-3">
                  {[
                    'Un rapport financier détaillé, projet par projet.',
                    'Les indicateurs d’impact mesurés sur le terrain.',
                    'Un interlocuteur unique à Antananarivo.',
                    'Les justificatifs de dépenses, vérifiables par vos auditeurs.',
                  ].map((line) => (
                    <li key={line} className="flex gap-3 text-hope-ink">
                      <span
                        aria-hidden="true"
                        className="mt-2 size-1.5 shrink-0 rounded-full bg-hope-orange"
                      />
                      {line}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="flex flex-col gap-3">
                <ButtonLink to="/contact" size="lg">
                  <Mail className="size-5" aria-hidden="true" />
                  Discuter d’un partenariat
                </ButtonLink>
                <ButtonLink to="/transparency" variant="outline" size="lg">
                  Voir nos engagements
                </ButtonLink>
              </div>
            </div>
          </div>
        </Container>
      </Section>
    </>
  );
}
