import {
  ArrowRight,
  CheckCircle2,
  Copy,
  Heart,
  Mail,
  RefreshCw,
  XCircle,
} from 'lucide-react';
import { useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { TransactionStatusBadge } from '@/components/donation/TransactionStatusBadge';
import { Alert, Card, Container, ErrorState, Loader, Section } from '@/components/ui';
import { Button, ButtonLink } from '@/components/ui/Button';
import { useTransaction } from '@/hooks/useApi';
import { DONATION_TYPE_LABELS, FREQUENCY_LABELS, formatDateTime } from '@/utils/format';
import { formatMoney } from '@/utils/money';

/**
 * PAGES DE RÉSULTAT.
 *
 * RÈGLE TENUE ICI : la référence affichée vient TOUJOURS du backend.
 * Le navigateur n'en fabrique jamais, même en cas d'échec de chargement — une
 * fausse référence donnée à un donateur serait pire que pas de référence du
 * tout, puisqu'il la citerait en croyant qu'elle existe.
 *
 * Le statut affiché est celui écrit en base, relu depuis l'API. La page de
 * confirmation ne se fie pas à ce que la page précédente croyait savoir.
 */

// ---------------------------------------------------------------------------
// Succès
// ---------------------------------------------------------------------------

export function DonationSuccessPage() {
  const { transactionId } = useParams<{ transactionId: string }>();
  const { data, isLoading, isError, refetch } = useTransaction(transactionId);

  if (isLoading) {
    return (
      <Section tone="mist">
        <Container size="narrow">
          <Loader label="Vérification de votre paiement" />
        </Container>
      </Section>
    );
  }

  if (isError || !data) {
    return (
      <Section tone="mist">
        <Container size="narrow">
          <ErrorState
            title="Nous n’avons pas pu retrouver ce don"
            message="Votre paiement a peut-être bien abouti. Conservez la référence affichée après votre don et écrivez-nous : nous vérifierons."
            onRetry={() => void refetch()}
          />
          <div className="mt-6 text-center">
            <ButtonLink to="/contact" variant="outline">
              <Mail className="size-4" aria-hidden="true" />
              Nous contacter
            </ButtonLink>
          </div>
        </Container>
      </Section>
    );
  }

  const { transaction, donation, outcome } = data;

  // Le backend fait foi : si le statut relu n'est pas un succès, on ne
  // félicite personne, quelle que soit l'URL sur laquelle il est arrivé.
  if (outcome !== 'SUCCESS') {
    return (
      <Section tone="mist">
        <Container size="narrow">
          <Alert tone="warning" title="Ce paiement n’est pas confirmé">
            <p>
              La transaction {transaction.internalReference} est actuellement au statut «{' '}
              {transaction.status} ». Aucun montant n’a été comptabilisé comme reçu.
            </p>
          </Alert>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <ButtonLink to="/donate">
              <RefreshCw className="size-4" aria-hidden="true" />
              Réessayer un don
            </ButtonLink>
            <ButtonLink to="/contact" variant="outline">
              Nous contacter
            </ButtonLink>
          </div>
        </Container>
      </Section>
    );
  }

  const isRecurring = donation.donationType === 'RECURRING';

  return (
    <Section tone="mist">
      <Container size="narrow">
        <Card className="overflow-hidden">
          {/* --- Bandeau de remerciement --- */}
          <div className="bg-hope-purple px-6 py-10 text-center text-white sm:px-10">
            <div
              aria-hidden="true"
              className="mx-auto flex size-16 items-center justify-center rounded-full bg-white/12"
            >
              <CheckCircle2 className="size-9 text-hope-yellow" />
            </div>

            <h1 className="mt-5 text-3xl text-white sm:text-4xl">Merci pour votre soutien.</h1>

            <p className="mx-auto mt-3 max-w-md text-white/85">
              Votre don a bien été encaissé. Il rejoint dès maintenant les fonds disponibles pour
              les enfants et les mères que HOPE accompagne.
            </p>

            <p className="tabular mt-6 font-mono text-4xl font-bold text-hope-yellow">
              {formatMoney(transaction.amount, transaction.currency)}
              {isRecurring && donation.frequency && (
                <span className="ml-2 font-sans text-lg font-medium text-white/85">
                  {FREQUENCY_LABELS[donation.frequency]}
                </span>
              )}
            </p>
          </div>

          {/* --- Détail --- */}
          <div className="p-6 sm:p-10">
            <h2 className="font-display text-xl font-semibold text-hope-purple">
              Détail de votre don
            </h2>

            <dl className="mt-5 divide-y divide-hope-blue-mist/70">
              <DetailRow label="Statut du paiement">
                <TransactionStatusBadge status={transaction.status} size="sm" />
              </DetailRow>

              <DetailRow label="Montant">
                <span className="tabular font-mono font-semibold">
                  {formatMoney(transaction.amount, transaction.currency)}
                </span>
              </DetailRow>

              <DetailRow label="Devise">{transaction.currency}</DetailRow>

              <DetailRow label="Type de don">
                {DONATION_TYPE_LABELS[donation.donationType]}
                {isRecurring && donation.frequency && ` · ${FREQUENCY_LABELS[donation.frequency]}`}
              </DetailRow>

              <DetailRow label="Date">{formatDateTime(transaction.transactionDate)}</DetailRow>

              <DetailRow label="Référence du don">
                <span className="font-mono text-sm">{donation.reference}</span>
              </DetailRow>

              <DetailRow label="Référence de transaction">
                <CopyableReference value={transaction.internalReference} />
              </DetailRow>
            </dl>

            <Alert tone="info" className="mt-6">
              <p>
                <strong>Conservez cette référence.</strong> Elle identifie votre paiement de façon
                unique et nous permettra de retrouver votre don en cas de question. Elle est
                composée sans caractères ambigus : elle peut se dicter au téléphone.
              </p>
            </Alert>

            {isRecurring && (
              <Alert tone="success" className="mt-4" title="Votre engagement mensuel est actif">
                <p>
                  Vous venez de créer <strong>un engagement</strong>, dont cette première échéance
                  a été prélevée. Chaque mois, une nouvelle échéance viendra s’y rattacher — un
                  seul don, plusieurs versements.
                </p>
              </Alert>
            )}

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <ButtonLink to="/projects" className="flex-1">
                Découvrir nos projets
                <ArrowRight className="size-4" aria-hidden="true" />
              </ButtonLink>
              <ButtonLink to="/transparency" variant="outline" className="flex-1">
                Suivre l’usage des dons
              </ButtonLink>
            </div>
          </div>
        </Card>

        <p className="mt-6 text-center text-sm text-hope-ink-soft">
          Un reçu vous sera envoyé par email. Une question ?{' '}
          <Link to="/contact" className="font-semibold text-hope-purple underline-offset-4 hover:underline">
            Écrivez-nous
          </Link>
          .
        </p>
      </Container>
    </Section>
  );
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 py-3">
      <dt className="text-sm text-hope-ink-soft">{label}</dt>
      <dd className="text-sm font-medium text-hope-ink">{children}</dd>
    </div>
  );
}

/**
 * Référence copiable.
 *
 * Le retour visuel est doublé d'une annonce vocale (`role="status"`) : sans
 * elle, une personne utilisant un lecteur d'écran ne saurait pas que la copie
 * a fonctionné.
 */
function CopyableReference({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      // Le presse-papiers peut être refusé (contexte non sécurisé, permission
      // navigateur). La référence reste sélectionnable à la main : on
      // n'affiche pas d'erreur pour une commodité.
    }
  }

  return (
    <span className="inline-flex items-center gap-2">
      <span className="tabular rounded-hope-sm bg-hope-blue-light px-2.5 py-1 font-mono text-sm font-semibold text-hope-purple-deep">
        {value}
      </span>
      <button
        type="button"
        onClick={() => void copy()}
        className="rounded-hope-sm p-1.5 text-hope-ink-soft transition-colors hover:bg-hope-lavender/60 hover:text-hope-purple"
        aria-label={`Copier la référence ${value}`}
      >
        <Copy className="size-4" aria-hidden="true" />
      </button>
      <span role="status" className="sr-only">
        {copied ? 'Référence copiée dans le presse-papiers' : ''}
      </span>
      {copied && (
        <span aria-hidden="true" className="text-xs font-medium text-emerald-700">
          Copié
        </span>
      )}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Échec
// ---------------------------------------------------------------------------

interface FailureState {
  reference?: string;
  reason?: string | null;
  amount?: string;
  currency?: string;
}

/**
 * Page d'échec.
 *
 * Elle explique ce qui s'est passé, rassure sur l'absence de débit, et propose
 * une action. Aucune formule d'excuse creuse : la personne veut savoir si son
 * argent est parti et quoi faire ensuite.
 */
export function DonationFailedPage() {
  const location = useLocation();
  const state = (location.state ?? {}) as FailureState;

  return (
    <Section tone="mist">
      <Container size="narrow">
        <Card className="overflow-hidden">
          <div className="border-b-4 border-red-200 bg-red-50 px-6 py-10 text-center sm:px-10">
            <div
              aria-hidden="true"
              className="mx-auto flex size-16 items-center justify-center rounded-full bg-white"
            >
              <XCircle className="size-9 text-red-700" />
            </div>

            <h1 className="mt-5 text-3xl text-red-950 sm:text-4xl">Le paiement n’a pas abouti</h1>

            <p className="mx-auto mt-3 max-w-md text-red-900/85">
              Aucun montant n’a été débité. Votre don n’a pas été enregistré comme reçu.
            </p>
          </div>

          <div className="p-6 sm:p-10">
            {state.reason && (
              <Alert tone="error" title="Motif communiqué par l’établissement de paiement">
                <p>{state.reason}</p>
              </Alert>
            )}

            {(state.amount || state.reference) && (
              <dl className="mt-6 divide-y divide-hope-blue-mist/70">
                {state.amount && state.currency && (
                  <DetailRow label="Montant tenté">
                    <span className="tabular font-mono font-semibold">
                      {formatMoney(state.amount, state.currency)}
                    </span>
                  </DetailRow>
                )}
                {state.reference && (
                  <DetailRow label="Référence de la tentative">
                    <span className="font-mono text-sm">{state.reference}</span>
                  </DetailRow>
                )}
              </dl>
            )}

            <div className="mt-8 rounded-hope border-2 border-hope-blue bg-hope-blue-light/60 p-5">
              <h2 className="font-display text-base font-semibold text-hope-purple">
                Que faire maintenant ?
              </h2>
              <ul className="mt-3 space-y-2 text-sm text-hope-ink">
                {[
                  'Vérifiez le solde ou le plafond du moyen de paiement utilisé.',
                  'Réessayez avec un autre moyen de paiement.',
                  'Si le problème persiste, écrivez-nous : nous trouverons une autre solution.',
                ].map((line) => (
                  <li key={line} className="flex gap-2.5">
                    <span
                      aria-hidden="true"
                      className="mt-2 size-1.5 shrink-0 rounded-full bg-hope-orange"
                    />
                    {line}
                  </li>
                ))}
              </ul>
            </div>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <ButtonLink to="/donate" className="flex-1">
                <Heart className="size-4" aria-hidden="true" />
                Réessayer
              </ButtonLink>
              <ButtonLink to="/contact" variant="outline" className="flex-1">
                <Mail className="size-4" aria-hidden="true" />
                Nous contacter
              </ButtonLink>
            </div>
          </div>
        </Card>
      </Container>
    </Section>
  );
}

// ---------------------------------------------------------------------------
// 404
// ---------------------------------------------------------------------------

export function NotFoundPage() {
  return (
    <Section tone="mist" spacing="loose">
      <Container size="narrow" className="text-center">
        <p className="font-mono text-6xl font-bold text-hope-blue">404</p>

        <h1 className="mt-4 text-3xl text-hope-purple sm:text-4xl">Cette page n’existe pas</h1>

        <p className="mx-auto mt-4 max-w-md text-hope-ink-soft">
          Le lien est peut-être incomplet, ou la page a été déplacée. Voici par où reprendre.
        </p>

        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <ButtonLink to="/" variant="secondary">
            Retour à l’accueil
          </ButtonLink>
          <ButtonLink to="/projects" variant="outline">
            Voir nos projets
          </ButtonLink>
        </div>

        <div className="mt-10">
          <Button variant="ghost" onClick={() => window.history.back()}>
            <ArrowRight className="size-4 rotate-180" aria-hidden="true" />
            Revenir à la page précédente
          </Button>
        </div>
      </Container>
    </Section>
  );
}
