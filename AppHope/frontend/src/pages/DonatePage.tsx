import { zodResolver } from '@hookform/resolvers/zod';
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Calendar,
  CheckCircle2,
  CreditCard,
  Heart,
  Loader2,
  Repeat,
  Smartphone,
  Target,
  Wallet,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { z } from 'zod';
import {
  Alert,
  Card,
  Container,
  ErrorState,
  Loader,
  Section,
  Skeleton,
} from '@/components/ui';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Input, RadioCard, Select } from '@/components/ui/Field';
import { useCheckout, usePaymentMethods, useProject, useProjects } from '@/hooks/useApi';
import type {
  CheckoutRequest,
  DonationType,
  DonorType,
  PaymentMethod,
  Project,
} from '@/types/api';
import { DONOR_TYPE_LABELS } from '@/utils/format';
import { formatMoney } from '@/utils/money';
import { cn } from '@/utils/cn';

/**
 * PARCOURS DE DON.
 *
 * Cinq étapes, une seule décision par écran. Un formulaire unique de quinze
 * champs fait fuir ; découpé, chaque étape tient sur un écran de téléphone et
 * se remplit au pouce.
 *
 * CE QUE CE COMPOSANT NE FAIT PAS
 *   Il ne décide jamais qu'un paiement a réussi, ne calcule aucun montant, ne
 *   filtre pas les moyens de paiement selon le pays. Il collecte une intention
 *   et l'envoie au backend, qui exécute et tranche. Le statut affiché à la fin
 *   est celui que le serveur a écrit en base.
 */

// ---------------------------------------------------------------------------
// Configuration du parcours
// ---------------------------------------------------------------------------

const STEPS = [
  { id: 1, label: 'Don' },
  { id: 2, label: 'Affectation' },
  { id: 3, label: 'Coordonnées' },
  { id: 4, label: 'Paiement' },
] as const;

/** Montants suggérés, par devise. Le montant libre reste toujours possible. */
const SUGGESTED_AMOUNTS: Record<string, string[]> = {
  MGA: ['10000', '25000', '50000', '100000'],
  EUR: ['20', '50', '100', '250'],
};

/** Pays proposés. Le pays décide des moyens de paiement et de la devise. */
const COUNTRIES = [
  { code: 'MG', label: 'Madagascar', currency: 'MGA' },
  { code: 'FR', label: 'France', currency: 'EUR' },
  { code: 'BE', label: 'Belgique', currency: 'EUR' },
  { code: 'CH', label: 'Suisse', currency: 'CHF' },
  { code: 'CA', label: 'Canada', currency: 'CAD' },
  { code: 'US', label: 'États-Unis', currency: 'USD' },
  { code: 'GB', label: 'Royaume-Uni', currency: 'GBP' },
] as const;

/** Icône par famille de moyen de paiement, d'après son code backend. */
function paymentIcon(code: string) {
  if (code === 'MVOLA' || code === 'ORANGE_MONEY') return Smartphone;
  if (code === 'CARD') return CreditCard;
  if (code.includes('BANK')) return Building2;
  return Wallet;
}

// ---------------------------------------------------------------------------
// Validation du formulaire donateur
// ---------------------------------------------------------------------------

const donorSchema = z.object({
  firstName: z.string().trim().min(1, 'Indiquez votre prénom.').max(120),
  lastName: z.string().trim().min(1, 'Indiquez votre nom.').max(120),
  email: z.string().trim().min(1, 'Indiquez votre adresse email.').email('Cette adresse email n’est pas valide.'),
  phone: z
    .string()
    .trim()
    .min(6, 'Indiquez un numéro de téléphone joignable.')
    .max(40),
  donorType: z.enum(['INDIVIDUAL', 'COMPANY', 'FOUNDATION', 'ORGANIZATION', 'PARTNER']),
  country: z.string().length(2),
  organizationName: z.string().trim().max(180).optional(),
  city: z.string().trim().max(120).optional(),
});

type DonorFormValues = z.infer<typeof donorSchema>;

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export function DonatePage() {
  const { id: projectIdFromRoute } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const preselectedProjectId = projectIdFromRoute ?? searchParams.get('projectId') ?? null;

  const [step, setStep] = useState(1);
  const [donationType, setDonationType] = useState<DonationType>('ONE_TIME');
  const [country, setCountry] = useState('MG');
  const [amount, setAmount] = useState('');
  const [customAmount, setCustomAmount] = useState('');
  const [projectId, setProjectId] = useState<string | null>(preselectedProjectId);
  const [paymentMethodCode, setPaymentMethodCode] = useState('');
  const [simulateFailure, setSimulateFailure] = useState(false);

  const currency = COUNTRIES.find((entry) => entry.code === country)?.currency ?? 'MGA';
  const suggestions = SUGGESTED_AMOUNTS[currency] ?? SUGGESTED_AMOUNTS['EUR']!;

  const { data: preselectedProject } = useProject(preselectedProjectId ?? undefined);
  const { data: paymentMethods, isLoading: methodsLoading } = usePaymentMethods(country);
  const checkout = useCheckout();

  const effectiveAmount = (customAmount || amount).trim();

  // Changer de pays change la devise : un montant saisi en ariary n'a plus de
  // sens en euros. On repart donc d'une ardoise propre plutôt que de convertir
  // — HOPE ne fait aucune conversion de devise.
  useEffect(() => {
    setAmount('');
    setCustomAmount('');
    setPaymentMethodCode('');
  }, [country]);

  // Le moyen de paiement retenu doit rester compatible avec la devise choisie.
  useEffect(() => {
    if (!paymentMethods || !paymentMethodCode) return;
    const stillValid = paymentMethods.some((method) => method.code === paymentMethodCode);
    if (!stillValid) setPaymentMethodCode('');
  }, [paymentMethods, paymentMethodCode]);

  const donorForm = useForm<DonorFormValues>({
    resolver: zodResolver(donorSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      donorType: 'INDIVIDUAL',
      country: 'MG',
      organizationName: '',
      city: '',
    },
  });

  // Le pays vit dans l'état du parcours (il pilote devise et moyens de
  // paiement) et doit rester synchronisé avec le formulaire.
  useEffect(() => {
    donorForm.setValue('country', country);
  }, [country, donorForm]);

  const donorType = donorForm.watch('donorType');
  const isOrganization = donorType !== 'INDIVIDUAL';

  const canContinueFromAmount = effectiveAmount !== '' && /^\d+([.,]\d{1,2})?$/.test(effectiveAmount);

  async function submitDonation() {
    const donor = donorForm.getValues();

    const request: CheckoutRequest = {
      donor: {
        firstName: donor.firstName,
        lastName: donor.lastName,
        email: donor.email,
        phone: donor.phone,
        donorType: donor.donorType as DonorType,
        country,
        organizationName: isOrganization ? donor.organizationName || null : null,
        city: donor.city || null,
      },
      donation: {
        donationType,
        currency,
        // La virgule décimale française devient un point : le backend attend
        // un format numérique, pas une convention d'affichage.
        amount: effectiveAmount.replace(',', '.'),
        frequency: donationType === 'RECURRING' ? 'MONTHLY' : null,
      },
      paymentMethodCode,
      projectId,
      ...(simulateFailure ? { simulate: 'FAILURE' as const } : {}),
    };

    const result = await checkout.mutateAsync(request);

    // C'est le BACKEND qui a décidé de l'issue : on ne fait que router.
    if (result.outcome === 'SUCCESS') {
      navigate(`/donation/success/${result.transaction.internalReference}`);
    } else {
      navigate('/donation/failed', {
        state: {
          reference: result.transaction.internalReference,
          reason: result.failureReason,
          amount: result.transaction.amount,
          currency: result.transaction.currency,
        },
      });
    }
  }

  // Pendant le traitement, on remplace tout l'écran : cliquer ailleurs
  // pendant qu'un paiement part n'a aucun sens.
  if (checkout.isPending) {
    return <ProcessingScreen amount={effectiveAmount} currency={currency} />;
  }

  return (
    <Section tone="mist" spacing="tight">
      <Container size="narrow">
        <header className="mb-8 text-center">
          <h1 className="text-3xl text-hope-purple sm:text-4xl">Faire un don</h1>
          <p className="mt-3 text-hope-ink-soft">
            Quatre étapes, deux minutes. Vous recevrez une référence de transaction à conserver.
          </p>
        </header>

        <Stepper current={step} />

        <Card className="mt-8 p-6 sm:p-8">
          {checkout.isError && (
            <Alert tone="error" title="Le don n’a pas pu être envoyé" className="mb-6">
              <p>{checkout.error.message}</p>
              {checkout.error.fieldErrors.length > 0 && (
                <ul className="mt-2 list-inside list-disc space-y-0.5">
                  {checkout.error.fieldErrors.map((detail) => (
                    <li key={detail.field}>{detail.message}</li>
                  ))}
                </ul>
              )}
            </Alert>
          )}

          {step === 1 && (
            <StepAmount
              donationType={donationType}
              onDonationTypeChange={setDonationType}
              country={country}
              onCountryChange={setCountry}
              currency={currency}
              suggestions={suggestions}
              amount={amount}
              onAmountChange={(value) => {
                setAmount(value);
                setCustomAmount('');
              }}
              customAmount={customAmount}
              onCustomAmountChange={(value) => {
                setCustomAmount(value);
                setAmount('');
              }}
            />
          )}

          {step === 2 && (
            <StepAllocation
              projectId={projectId}
              onProjectChange={setProjectId}
              preselectedProject={preselectedProject ?? null}
            />
          )}

          {step === 3 && <StepDonor form={donorForm} isOrganization={isOrganization} />}

          {step === 4 && (
            <StepPayment
              methods={paymentMethods ?? []}
              isLoading={methodsLoading}
              selected={paymentMethodCode}
              onSelect={setPaymentMethodCode}
              country={country}
              simulateFailure={simulateFailure}
              onSimulateFailureChange={setSimulateFailure}
              summary={{
                amount: effectiveAmount,
                currency,
                donationType,
                projectId,
              }}
            />
          )}

          {/* --- Navigation entre étapes --- */}
          <div className="mt-8 flex flex-col-reverse gap-3 border-t border-hope-blue-mist pt-6 sm:flex-row sm:justify-between">
            {step > 1 ? (
              <Button variant="ghost" onClick={() => setStep((current) => current - 1)}>
                <ArrowLeft className="size-4" aria-hidden="true" />
                Retour
              </Button>
            ) : (
              <span className="hidden sm:block" />
            )}

            {step < 4 && (
              <Button
                onClick={async () => {
                  // L'étape 3 valide le formulaire avant de laisser avancer :
                  // découvrir une erreur de saisie après le paiement serait
                  // inacceptable.
                  if (step === 3) {
                    const valid = await donorForm.trigger();
                    if (!valid) return;
                  }
                  setStep((current) => current + 1);
                }}
                disabled={step === 1 && !canContinueFromAmount}
                size="lg"
              >
                Continuer
                <ArrowRight className="size-5" aria-hidden="true" />
              </Button>
            )}

            {step === 4 && (
              <Button
                onClick={() => void submitDonation()}
                disabled={!paymentMethodCode}
                size="lg"
              >
                <Heart className="size-5" aria-hidden="true" />
                Donner {formatMoney(effectiveAmount.replace(',', '.'), currency)}
              </Button>
            )}
          </div>
        </Card>

        <p className="mt-6 text-center text-sm text-hope-ink-soft">
          HOPE n’enregistre aucune donnée bancaire : ni numéro de carte, ni code de sécurité.
        </p>
      </Container>
    </Section>
  );
}

// ---------------------------------------------------------------------------
// Fil d'étapes
// ---------------------------------------------------------------------------

function Stepper({ current }: { current: number }) {
  return (
    <nav aria-label="Progression du don">
      <ol className="flex items-center gap-2">
        {STEPS.map((step, index) => {
          const isDone = current > step.id;
          const isCurrent = current === step.id;

          return (
            <li key={step.id} className="flex flex-1 items-center gap-2">
              <div className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
                <span
                  className={cn(
                    'flex size-9 shrink-0 items-center justify-center rounded-full border-2 text-sm font-semibold transition-colors',
                    isDone && 'border-hope-purple bg-hope-purple text-white',
                    isCurrent && 'border-hope-orange bg-hope-orange text-hope-ink',
                    !isDone && !isCurrent && 'border-hope-blue-mist bg-white text-hope-ink-soft',
                  )}
                  aria-current={isCurrent ? 'step' : undefined}
                >
                  {isDone ? <CheckCircle2 className="size-5" aria-hidden="true" /> : step.id}
                </span>
                <span
                  className={cn(
                    'truncate text-center text-xs font-medium',
                    isCurrent ? 'text-hope-purple' : 'text-hope-ink-soft',
                  )}
                >
                  {step.label}
                </span>
                <span className="sr-only">
                  {isDone ? 'terminée' : isCurrent ? 'étape en cours' : 'à venir'}
                </span>
              </div>

              {index < STEPS.length - 1 && (
                <span
                  aria-hidden="true"
                  className={cn(
                    'mb-6 h-0.5 w-full flex-1 rounded-full transition-colors',
                    isDone ? 'bg-hope-purple' : 'bg-hope-blue-mist',
                  )}
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

// ---------------------------------------------------------------------------
// Étape 1 — type de don et montant
// ---------------------------------------------------------------------------

function StepAmount({
  donationType,
  onDonationTypeChange,
  country,
  onCountryChange,
  currency,
  suggestions,
  amount,
  onAmountChange,
  customAmount,
  onCustomAmountChange,
}: {
  donationType: DonationType;
  onDonationTypeChange: (value: DonationType) => void;
  country: string;
  onCountryChange: (value: string) => void;
  currency: string;
  suggestions: string[];
  amount: string;
  onAmountChange: (value: string) => void;
  customAmount: string;
  onCustomAmountChange: (value: string) => void;
}) {
  return (
    <div className="space-y-8">
      <fieldset>
        <legend className="mb-4 font-display text-xl font-semibold text-hope-purple">
          Quel type de don souhaitez-vous faire ?
        </legend>

        <div className="grid gap-3 sm:grid-cols-2">
          <RadioCard
            name="donationType"
            value="ONE_TIME"
            checked={donationType === 'ONE_TIME'}
            onChange={() => onDonationTypeChange('ONE_TIME')}
            title="Don ponctuel"
            description="Un versement unique, maintenant."
            icon={<Heart className="size-4 text-hope-orange" aria-hidden="true" />}
          />
          <RadioCard
            name="donationType"
            value="RECURRING"
            checked={donationType === 'RECURRING'}
            onChange={() => onDonationTypeChange('RECURRING')}
            title="Don mensuel"
            description="Un montant chaque mois, résiliable à tout moment."
            icon={<Repeat className="size-4 text-hope-purple" aria-hidden="true" />}
          />
        </div>

        {donationType === 'RECURRING' && (
          <Alert tone="info" className="mt-4">
            Un don mensuel crée <strong>un seul engagement</strong>. Chaque mois, une échéance
            distincte sera prélevée et apparaîtra dans votre suivi. Seule la première est
            débitée aujourd’hui.
          </Alert>
        )}
      </fieldset>

      <div>
        <Select
          label="Depuis quel pays donnez-vous ?"
          hint="Le pays détermine la devise et les moyens de paiement disponibles."
          value={country}
          onChange={(event) => onCountryChange(event.target.value)}
          options={COUNTRIES.map((entry) => ({
            value: entry.code,
            label: `${entry.label} (${entry.currency})`,
          }))}
          required
        />
      </div>

      <fieldset>
        <legend className="mb-4 font-display text-xl font-semibold text-hope-purple">
          Quel montant ?
          {donationType === 'RECURRING' && (
            <span className="ml-2 text-base font-normal text-hope-ink-soft">par mois</span>
          )}
        </legend>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {suggestions.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => onAmountChange(value)}
              aria-pressed={amount === value}
              className={cn(
                'tabular min-h-14 rounded-hope border-2 px-3 font-mono text-base font-semibold transition-all',
                'focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-hope-orange',
                amount === value
                  ? 'border-hope-purple bg-hope-lavender/50 text-hope-purple'
                  : 'border-hope-blue-mist bg-white text-hope-ink hover:border-hope-blue',
              )}
            >
              {formatMoney(value, currency)}
            </button>
          ))}
        </div>

        <div className="mt-4">
          <Input
            label="Ou saisissez un autre montant"
            type="text"
            inputMode="decimal"
            placeholder={`Montant en ${currency}`}
            value={customAmount}
            onChange={(event) => onCustomAmountChange(event.target.value.replace(/[^\d.,]/g, ''))}
          />
        </div>
      </fieldset>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Étape 2 — affectation
// ---------------------------------------------------------------------------

function StepAllocation({
  projectId,
  onProjectChange,
  preselectedProject,
}: {
  projectId: string | null;
  onProjectChange: (value: string | null) => void;
  preselectedProject: Project | null;
}) {
  const { data: projects, isLoading } = useProjects({ status: 'ACTIVE', take: 40 });
  const [mode, setMode] = useState<'FREE' | 'PROJECT'>(projectId ? 'PROJECT' : 'FREE');

  return (
    <div className="space-y-6">
      <fieldset>
        <legend className="mb-2 font-display text-xl font-semibold text-hope-purple">
          Où souhaitez-vous que votre don aille ?
        </legend>
        <p className="mb-4 text-sm text-hope-ink-soft">
          Un don libre nous permet d’agir vite là où le besoin est le plus urgent. Un don fléché
          finance un projet que vous choisissez.
        </p>

        <div className="grid gap-3">
          <RadioCard
            name="allocationMode"
            value="FREE"
            checked={mode === 'FREE'}
            onChange={() => {
              setMode('FREE');
              onProjectChange(null);
            }}
            title="Là où le besoin est le plus important"
            description="HOPE répartit votre don entre les projets qui en ont le plus besoin."
            icon={<Heart className="size-4 text-hope-orange" aria-hidden="true" />}
          />
          <RadioCard
            name="allocationMode"
            value="PROJECT"
            checked={mode === 'PROJECT'}
            onChange={() => setMode('PROJECT')}
            title="Un projet précis"
            description="Votre don sera affecté au projet que vous désignez."
            icon={<Target className="size-4 text-hope-purple" aria-hidden="true" />}
          />
        </div>
      </fieldset>

      {mode === 'PROJECT' && (
        <div>
          {isLoading && (
            <div className="space-y-3">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          )}

          {!isLoading && projects && projects.length === 0 && (
            <Alert tone="warning">
              Aucun projet n’accepte de dons pour le moment. Choisissez « là où le besoin est le
              plus important » : votre don servira dès qu’un projet ouvrira.
            </Alert>
          )}

          {!isLoading && projects && projects.length > 0 && (
            <fieldset className="max-h-96 space-y-3 overflow-y-auto pr-1">
              <legend className="sr-only">Choisir un projet</legend>
              {projects.map((project) => (
                <RadioCard
                  key={project.id}
                  name="projectId"
                  value={project.id}
                  checked={projectId === project.id}
                  onChange={() => onProjectChange(project.id)}
                  title={project.name}
                  description={`${project.category?.name ?? 'Projet'}${
                    project.location ? ` · ${project.location}` : ''
                  } · ${formatMoney(project.funding.fundedAmount, project.funding.currency)} déjà collectés`}
                />
              ))}
            </fieldset>
          )}

          {preselectedProject && projectId === preselectedProject.id && (
            <Alert tone="success" className="mt-4">
              Votre don sera affecté au projet <strong>{preselectedProject.name}</strong>.
            </Alert>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Étape 3 — coordonnées du donateur
// ---------------------------------------------------------------------------

function StepDonor({
  form,
  isOrganization,
}: {
  form: ReturnType<typeof useForm<DonorFormValues>>;
  isOrganization: boolean;
}) {
  const { register, formState } = form;
  const { errors } = formState;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-display text-xl font-semibold text-hope-purple">Vos coordonnées</h2>
        <p className="mt-1 text-sm text-hope-ink-soft">
          Elles nous servent à vous envoyer votre reçu et à vous tenir informé du projet soutenu.
        </p>
      </div>

      <Select
        label="Vous donnez en tant que"
        options={Object.entries(DONOR_TYPE_LABELS).map(([value, label]) => ({ value, label }))}
        error={errors.donorType?.message}
        required
        {...register('donorType')}
      />

      {isOrganization && (
        <Input
          label="Nom de l’organisation"
          hint="Raison sociale telle qu’elle doit figurer sur le reçu."
          error={errors.organizationName?.message}
          {...register('organizationName')}
        />
      )}

      <div className="grid gap-5 sm:grid-cols-2">
        <Input
          label="Prénom"
          autoComplete="given-name"
          error={errors.firstName?.message}
          required
          {...register('firstName')}
        />
        <Input
          label="Nom"
          autoComplete="family-name"
          error={errors.lastName?.message}
          required
          {...register('lastName')}
        />
      </div>

      <Input
        label="Adresse email"
        type="email"
        autoComplete="email"
        hint="Votre reçu et votre référence de transaction y seront envoyés."
        error={errors.email?.message}
        required
        {...register('email')}
      />

      <div className="grid gap-5 sm:grid-cols-2">
        <Input
          label="Téléphone"
          type="tel"
          autoComplete="tel"
          placeholder="+261 34 00 000 00"
          error={errors.phone?.message}
          required
          {...register('phone')}
        />
        <Input label="Ville" autoComplete="address-level2" error={errors.city?.message} {...register('city')} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Étape 4 — moyen de paiement
// ---------------------------------------------------------------------------

function StepPayment({
  methods,
  isLoading,
  selected,
  onSelect,
  country,
  simulateFailure,
  onSimulateFailureChange,
  summary,
}: {
  methods: PaymentMethod[];
  isLoading: boolean;
  selected: string;
  onSelect: (code: string) => void;
  country: string;
  simulateFailure: boolean;
  onSimulateFailureChange: (value: boolean) => void;
  summary: {
    amount: string;
    currency: string;
    donationType: DonationType;
    projectId: string | null;
  };
}) {
  const { data: selectedProject } = useProject(summary.projectId ?? undefined);

  const recap = useMemo(
    () => [
      {
        label: 'Type de don',
        value: summary.donationType === 'RECURRING' ? 'Don mensuel' : 'Don ponctuel',
      },
      {
        label: summary.donationType === 'RECURRING' ? 'Montant mensuel' : 'Montant',
        value: formatMoney(summary.amount.replace(',', '.'), summary.currency),
      },
      {
        label: 'Affectation',
        value: selectedProject ? selectedProject.name : 'Là où le besoin est le plus important',
      },
    ],
    [summary, selectedProject],
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-xl font-semibold text-hope-purple">
          Comment souhaitez-vous payer ?
        </h2>
        <p className="mt-1 text-sm text-hope-ink-soft">
          Ces moyens de paiement sont ceux disponibles depuis votre pays.
        </p>
      </div>

      {isLoading && (
        <div className="space-y-3">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      )}

      {!isLoading && methods.length === 0 && (
        <Alert tone="warning" title="Aucun moyen de paiement disponible">
          Nous ne proposons pas encore de moyen de paiement depuis ce pays. Écrivez-nous à
          contact@hope-madagascar.org, nous trouverons une solution.
        </Alert>
      )}

      {!isLoading && methods.length > 0 && (
        <fieldset className="grid gap-3">
          <legend className="sr-only">Moyen de paiement</legend>
          {methods.map((method) => {
            const Icon = paymentIcon(method.code);
            return (
              <RadioCard
                key={method.id}
                name="paymentMethod"
                value={method.code}
                checked={selected === method.code}
                onChange={onSelect}
                title={method.name}
                description={method.description ?? undefined}
                icon={<Icon className="size-4 text-hope-purple" aria-hidden="true" />}
              />
            );
          })}
        </fieldset>
      )}

      {/* --- Récapitulatif --- */}
      <div className="rounded-hope border-2 border-hope-blue bg-hope-blue-light/60 p-5">
        <h3 className="font-display text-base font-semibold text-hope-purple">
          Récapitulatif de votre don
        </h3>
        <dl className="mt-3 space-y-2 text-sm">
          {recap.map((row) => (
            <div key={row.label} className="flex flex-wrap justify-between gap-2">
              <dt className="text-hope-ink-soft">{row.label}</dt>
              <dd className="font-semibold text-hope-ink">{row.value}</dd>
            </div>
          ))}
          <div className="flex flex-wrap justify-between gap-2">
            <dt className="text-hope-ink-soft">Pays</dt>
            <dd className="font-semibold text-hope-ink">
              {COUNTRIES.find((entry) => entry.code === country)?.label ?? country}
            </dd>
          </div>
        </dl>
      </div>

      {/* --- Mode démonstration ---
          Le backend fonctionne avec un simulateur de paiement. Plutôt que de
          le cacher, on l'expose : un visiteur peut vérifier lui-même que
          l'échec est traité proprement, et un recruteur voit les deux
          parcours sans avoir à truquer quoi que ce soit. */}
      <div className="rounded-hope border border-dashed border-hope-lavender bg-hope-lavender/25 p-4">
        <label className="flex cursor-pointer items-start gap-3 text-sm">
          <input
            type="checkbox"
            checked={simulateFailure}
            onChange={(event) => onSimulateFailureChange(event.target.checked)}
            className="mt-0.5 size-4 shrink-0 accent-hope-purple"
          />
          <span>
            <span className="font-semibold text-hope-purple">
              Démonstration : simuler un paiement refusé
            </span>
            <span className="mt-0.5 block text-hope-ink-soft">
              Cette plateforme utilise un simulateur de paiement : aucun débit réel n’a lieu.
              Cochez cette case pour voir comment un refus est traité.
            </span>
          </span>
        </label>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Écran de traitement
// ---------------------------------------------------------------------------

/**
 * Écran d'attente pendant le paiement.
 *
 * Il occupe tout l'espace pour une raison précise : empêcher un second envoi.
 * Un donateur impatient qui reclique pourrait sinon créer deux transactions.
 */
function ProcessingScreen({ amount, currency }: { amount: string; currency: string }) {
  return (
    <Section tone="mist">
      <Container size="narrow">
        <Card className="p-10 text-center sm:p-14">
          <div
            aria-hidden="true"
            className="mx-auto flex size-16 items-center justify-center rounded-full bg-hope-lavender/60"
          >
            <Loader2 className="size-8 animate-spin text-hope-purple" />
          </div>

          <h1 className="mt-6 text-2xl text-hope-purple" role="status" aria-live="polite">
            Traitement de votre don en cours
          </h1>

          <p className="tabular mx-auto mt-3 max-w-md font-mono text-lg font-semibold text-hope-ink">
            {formatMoney(amount.replace(',', '.'), currency)}
          </p>

          <p className="mx-auto mt-4 max-w-md text-hope-ink-soft">
            Ne fermez pas cette page et ne rechargez pas : nous attendons la réponse de
            l’établissement de paiement.
          </p>
        </Card>
      </Container>
    </Section>
  );
}

// ---------------------------------------------------------------------------
// Page de don rattachée à un projet
// ---------------------------------------------------------------------------

/**
 * /projects/:id/donate — même parcours, avec le projet déjà choisi.
 *
 * On vérifie d'abord que le projet existe : proposer de donner à un projet
 * introuvable ferait échouer le paiement à la toute fin, après la saisie.
 */
export function ProjectDonatePage() {
  const { id } = useParams<{ id: string }>();
  const { data: project, isLoading, isError, refetch } = useProject(id);

  if (isLoading) {
    return (
      <Section tone="mist">
        <Container size="narrow">
          <Loader label="Chargement du projet" />
        </Container>
      </Section>
    );
  }

  if (isError || !project) {
    return (
      <Section tone="mist">
        <Container size="narrow">
          <ErrorState
            title="Ce projet est introuvable"
            message="Il a peut-être été clôturé. Vous pouvez faire un don libre : nous l’affecterons là où le besoin est le plus urgent."
            onRetry={() => void refetch()}
          />
          <div className="mt-6 text-center">
            <ButtonLink to="/donate">
              <Heart className="size-4" aria-hidden="true" />
              Faire un don libre
            </ButtonLink>
          </div>
        </Container>
      </Section>
    );
  }

  return (
    <>
      <div className="border-b border-hope-blue-mist bg-white py-6">
        <Container size="narrow">
          <p className="flex items-center gap-2 text-sm text-hope-ink-soft">
            <Calendar className="size-4 text-hope-orange" aria-hidden="true" />
            Vous soutenez
          </p>
          <h2 className="mt-1 font-display text-xl font-semibold text-hope-purple">
            {project.name}
          </h2>
        </Container>
      </div>
      <DonatePage />
    </>
  );
}
