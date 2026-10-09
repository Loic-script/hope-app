import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { loadStripe } from '@stripe/stripe-js';
import {
  CheckoutElementsProvider,
  PaymentElement,
  useCheckoutElements,
} from '@stripe/react-stripe-js/checkout';

import HopeLogo from '../../components/HopeLogo.jsx';
import Indisponible from '../../components/paiement/Indisponible.jsx';
import { useContextePaiement } from '../../components/paiement/ContextePaiement.jsx';
import { montantInitial, usePromesseDon } from '../../hooks/usePromesseDon.js';
import { messageErreur } from '../../services/api.js';
import * as fmt from '../../utils/format.js';

const DEVISES = [
  { code: 'MGA', symbole: 'Ar', rapides: [10000, 25000, 50000, 100000], minimum: 1000 },
  { code: 'EUR', symbole: '€', rapides: [10, 25, 50, 100], minimum: 1 },
  { code: 'USD', symbole: '$', rapides: [10, 25, 50, 100], minimum: 1 },
];

function montantSaisi(texte) {
  const propre = String(texte ?? '')
    .replace(/[\s  ]/g, '')
    .replace(',', '.');
  if (!/^\d+(\.\d{0,2})?$/.test(propre)) return null;
  const valeur = Number(propre);
  return valeur > 0 ? valeur : null;
}

const APPARENCE = {
  theme: 'stripe',
  variables: {
    colorPrimary: '#4a3f8c',
    colorText: '#2a2839',
    colorDanger: '#c0392b',
    fontFamily: "'Poppins', 'Segoe UI', system-ui, sans-serif",
    fontSizeBase: '15px',
    borderRadius: '10px',
    spacingUnit: '4px',
  },
};

export default function PaiementCarte() {
  const {
    profil,
    personne,
    beneficiaire,
    email,
    erreurChargement,
    quitter,
    montantPrevu,
    devisePrevue,
    libelleSuite,
    libellePlusTard,
  } = usePromesseDon('carte_bancaire');
  const contexte = useContextePaiement();
  const ref = useRef(contexte);
  ref.current = contexte;
  const emplacement = useLocation();

  const [devise, setDevise] = useState('MGA');
  const [montant, setMontant] = useState('');
  const [details, setDetails] = useState(false);
  const [soumis, setSoumis] = useState(false);
  const [reglages, setReglages] = useState(null);
  const [paiement, setPaiement] = useState(null);
  const [don, setDon] = useState(null);
  const [envoi, setEnvoi] = useState(false);
  const [refus, setRefus] = useState('');
  const titre = useRef(null);

  const sessionPayee = contexte.sessionPayee;

  useEffect(() => {
    if (!profil) return;
    const choisie = [devisePrevue, personne.devise].find((d) => DEVISES.some((x) => x.code === d)) ?? 'MGA';
    setDevise(choisie);
    setMontant(montantInitial(montantPrevu, devisePrevue, choisie));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profil]);

  useEffect(() => {
    let annule = false;
    ref.current.carte
      .reglages()
      .then((lus) => {
        if (!annule) setReglages(lus);
      })
      .catch(() => {
        if (!annule) setReglages({ disponible: false, clePublique: null });
      });
    return () => {
      annule = true;
    };
  }, []);

  useEffect(() => {
    if (!sessionPayee) return undefined;
    let annule = false;
    setEnvoi(true);
    ref.current.carte
      .etat(sessionPayee)
      .then((etat) => {
        if (annule) return;
        if (etat.paiement === 'paid') setDon(etat.don);
        else setRefus(etat.erreur || 'Le paiement n’a pas abouti. Vous pouvez réessayer.');
      })
      .catch((echec) => {
        if (!annule) setRefus(messageErreur(echec, 'L’état de votre paiement n’a pas pu être lu.'));
      })
      .finally(() => {
        if (!annule) setEnvoi(false);
      });
    return () => {
      annule = true;
    };
  }, [sessionPayee]);

  useEffect(() => {
    if (don) titre.current?.focus();
  }, [don]);

  const reglage = DEVISES.find((d) => d.code === devise) ?? DEVISES[0];
  const somme = montantSaisi(montant);
  const erreurMontant =
    somme === null
      ? 'Indiquez le montant de votre don.'
      : somme < reglage.minimum
        ? `Au moins ${fmt.montant(reglage.minimum, devise)}.`
        : '';

  const stripe = useMemo(
    () => (reglages?.clePublique ? loadStripe(reglages.clePublique) : null),
    [reglages?.clePublique]
  );

  function changerDevise(code) {
    setDevise(code);
    setMontant('');
  }

  async function ouvrirLePaiement(evenement) {
    evenement.preventDefault();
    setSoumis(true);
    setRefus('');
    if (erreurMontant) {
      requestAnimationFrame(() => document.querySelector('#carte-montant')?.focus());
      return;
    }
    if (paiement && paiement.montant === somme && paiement.devise === devise) return;

    setEnvoi(true);
    try {
      const ouverte = await ref.current.carte.ouvrir({
        affectation: profil.affectation,
        projetId: profil.projetId,
        montant: String(somme),
        devise,
        frequence: profil.frequence || 'ONE_TIME',
        message: profil.message || undefined,
        retour: emplacement.pathname,
      });
      setPaiement({ ...ouverte, montant: somme, devise });
    } catch (echec) {
      setRefus(messageErreur(echec, 'Le paiement n’a pas pu être préparé. Réessayez.'));
    } finally {
      setEnvoi(false);
    }
  }

  async function paiementAbouti() {
    setEnvoi(true);
    try {
      const etat = await ref.current.carte.etat(paiement.sessionId);
      setDon(etat.don ?? paiement.don);
      await ref.current.rafraichir?.();
    } catch {
      setDon(paiement.don);
    } finally {
      setEnvoi(false);
    }
  }

  const total = somme ? fmt.montant(somme, devise) : fmt.montant(0, devise);
  const carteIndisponible = reglages && !reglages.disponible;
  const enPaiement = Boolean(paiement) && !don;

  return (
    <div className="carte">
      <aside className="carte__resume" aria-label="Récapitulatif du don">
        <div className="carte__resume-dedans">
          <header className="carte__marque">
            <button
              type="button"
              className="carte__retour"
              onClick={() => quitter(4)}
              disabled={envoi || Boolean(don)}
              aria-label="Revenir au choix du paiement"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M19 12H5M11 6l-6 6 6 6" />
              </svg>
            </button>
            <span className="carte__pastille">
              <HopeLogo compact />
            </span>
            <span className="carte__marque-nom">HOPE Madagascar</span>
          </header>

          <p className="carte__objet">Faire un don à HOPE</p>
          <p className="carte__grand" aria-live="polite">
            <span key={`${devise}-${somme ?? 0}`} className="carte__grand-valeur">
              {somme ? fmt.nombre(somme, reglage.minimum < 1000 && somme % 1 ? 2 : 0) : '0'}
            </span>
            <span className="carte__grand-devise">{devise}</span>
            <span className="carte__grand-frequence">
              une
              <br />
              fois
            </span>
          </p>

          <div className="carte__devises" role="radiogroup" aria-label="Devise du don">
            <span
              className="carte__devises-curseur"
              style={{ '--rang': DEVISES.findIndex((d) => d.code === devise) }}
              aria-hidden="true"
            />
            {DEVISES.map((d) => (
              <button
                key={d.code}
                type="button"
                role="radio"
                aria-checked={devise === d.code}
                className={`carte__devise${devise === d.code ? ' carte__devise--choisie' : ''}`}
                onClick={() => changerDevise(d.code)}
                disabled={envoi || enPaiement || Boolean(don)}
              >
                <span className="carte__devise-symbole" aria-hidden="true">
                  {d.symbole}
                </span>
                {d.code}
              </button>
            ))}
          </div>
          <p className="carte__note">
            Le don est prélevé dans la devise choisie. Votre banque peut appliquer des frais de change.
          </p>

          <button
            type="button"
            className="carte__details-bouton"
            aria-expanded={details}
            aria-controls="carte-lignes"
            onClick={() => setDetails((ouvert) => !ouvert)}
          >
            {details ? 'Masquer le détail' : 'Voir le détail'}
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>

          <div className={`carte__lignes-cadre${details ? ' carte__lignes-cadre--ouvert' : ''}`} id="carte-lignes">
            <dl className="carte__lignes">
              <div className="carte__ligne carte__ligne--don">
                <dt>
                  Don
                  <small>{beneficiaire || '—'} · ponctuel</small>
                </dt>
                <dd>{total}</dd>
              </div>
              <div className="carte__ligne">
                <dt>Sous-total</dt>
                <dd>{total}</dd>
              </div>
              <div className="carte__ligne carte__ligne--doux">
                <dt>Frais prélevés par HOPE</dt>
                <dd>{fmt.montant(0, devise)}</dd>
              </div>
              <div className="carte__ligne carte__ligne--total">
                <dt>Total de votre don</dt>
                <dd>{total}</dd>
              </div>
            </dl>
          </div>
        </div>
      </aside>

      <main className="carte__paiement">
        <div className="carte__paiement-dedans">
          {erreurChargement && (
            <p className="carte__alerte" role="alert">
              {erreurChargement}
            </p>
          )}
          {!profil && !erreurChargement && (
            <p className="carte__attente" role="status">
              <span className="carte__rotation" aria-hidden="true" />
              Préparation du paiement…
            </p>
          )}

          {profil && carteIndisponible && !don && (
            <Indisponible
              prefixe="carte"
              quitter={quitter}
              texte="Le paiement par carte bancaire n’est pas encore ouvert sur cette plateforme. Vous pouvez donner par un autre moyen."
            />
          )}

          {profil && !don && !carteIndisponible && !enPaiement && (
            <form className="carte__formulaire" onSubmit={ouvrirLePaiement} noValidate aria-label="Montant du don">
              <h1 className="sr-only">Don par carte bancaire</h1>

              <label className="carte__champ" htmlFor="carte-montant">
                <span className="carte__rubrique">Montant du don</span>
                <span className={`carte__montant${soumis && erreurMontant ? ' carte__montant--erreur' : ''}`}>
                  <input
                    id="carte-montant"
                    inputMode="decimal"
                    autoComplete="off"
                    placeholder="0"
                    value={montant}
                    onChange={(e) => setMontant(e.target.value.replace(/[^\d\s,.]/g, ''))}
                    disabled={envoi}
                    aria-invalid={soumis && Boolean(erreurMontant)}
                    aria-describedby="carte-montant-erreur"
                  />
                  <span className="carte__montant-devise" aria-hidden="true">
                    {devise}
                  </span>
                </span>
              </label>
              <div className="carte__rapides" role="group" aria-label="Montants proposés">
                {reglage.rapides.map((valeur) => (
                  <button
                    key={valeur}
                    type="button"
                    className={`carte__rapide${somme === valeur ? ' carte__rapide--choisi' : ''}`}
                    aria-pressed={somme === valeur}
                    onClick={() => setMontant(fmt.nombre(valeur))}
                    disabled={envoi}
                  >
                    {fmt.nombre(valeur)}
                    <span className="carte__rapide-devise"> {reglage.symbole}</span>
                  </button>
                ))}
              </div>
              <p className="carte__erreur" id="carte-montant-erreur" aria-live="polite">
                {soumis ? erreurMontant : ''}
              </p>

              <h2 className="carte__rubrique carte__rubrique--section">Coordonnées</h2>
              <div className="carte__gris">
                <span className="carte__gris-libelle">E-mail</span>
                <span className="carte__gris-valeur">{email}</span>
              </div>

              <p className="carte__lien-securise">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <rect x="5" y="10.5" width="14" height="10" rx="2" />
                  <path d="M8.5 10.5V8a3.5 3.5 0 017 0v2.5" />
                </svg>
                <span>
                  Votre carte se règle à l’écran suivant, dans le cadre sécurisé de Stripe. Son numéro va
                  directement chez lui : ni HOPE ni cette page ne le voient.
                </span>
              </p>

              <button type="submit" className="carte__payer" disabled={envoi} aria-busy={envoi}>
                {envoi ? (
                  <>
                    <span className="carte__rotation carte__rotation--clair" aria-hidden="true" />
                    Préparation…
                  </>
                ) : (
                  <>
                    Continuer vers le paiement
                    <svg viewBox="0 0 24 24" aria-hidden="true" className="carte__fleche">
                      <path d="M5 12h14M13 6l6 6-6 6" />
                    </svg>
                  </>
                )}
              </button>
              <button type="button" className="carte__plus-tard" onClick={() => quitter()} disabled={envoi}>
                {libellePlusTard}
              </button>
              <p className="carte__erreur carte__erreur--centre" role="alert">
                {refus}
              </p>
            </form>
          )}

          {profil && enPaiement && stripe && (
            <CheckoutElementsProvider
              stripe={stripe}
              options={{
                clientSecret: paiement.clientSecret,
                elementsOptions: { appearance: APPARENCE },
                defaultValues: { email },
              }}
            >
              <FormulaireStripe
                somme={somme}
                devise={devise}
                reference={paiement.don?.reference}
                retour={`${window.location.origin}${emplacement.pathname}?session=${paiement.sessionId}`}
                onModifier={() => {
                  setPaiement(null);
                  setRefus('');
                }}
                onPaye={paiementAbouti}
                libellePlusTard={libellePlusTard}
                quitter={quitter}
              />
            </CheckoutElementsProvider>
          )}

          {profil && don && (
            <section className="carte__merci">
              <div className="carte__merci-sceau" aria-hidden="true">
                <svg viewBox="0 0 52 52">
                  <circle cx="26" cy="26" r="24" />
                  <path d="M15 27l7 7 15-16" />
                </svg>
              </div>
              <h1 className="carte__merci-titre" ref={titre} tabIndex={-1}>
                Merci pour votre don
              </h1>
              <p className="carte__merci-texte">
                Votre don de <strong>{fmt.montant(don.montant ?? somme, don.devise ?? devise)}</strong> est
                encaissé. Un reçu part à <strong>{email}</strong>.
              </p>
              <dl className="carte__merci-recu">
                <div>
                  <dt>Référence</dt>
                  <dd>{don.reference}</dd>
                </div>
                <div>
                  <dt>Pour</dt>
                  <dd>{beneficiaire}</dd>
                </div>
                <div>
                  <dt>Statut</dt>
                  <dd>
                    <span className="carte__statut">
                      <span className="carte__statut-point" aria-hidden="true" />
                      {don.statutLibelle ?? 'Reçu'}
                    </span>
                  </dd>
                </div>
              </dl>
              <button type="button" className="carte__payer" onClick={() => quitter()}>
                {libelleSuite}
                <svg viewBox="0 0 24 24" aria-hidden="true" className="carte__fleche">
                  <path d="M5 12h14M13 6l6 6-6 6" />
                </svg>
              </button>
            </section>
          )}

          {profil && sessionPayee && !don && !refus && (
            <p className="carte__attente" role="status">
              <span className="carte__rotation" aria-hidden="true" />
              Vérification de votre paiement…
            </p>
          )}
          {profil && sessionPayee && !don && refus && (
            <section className="carte__merci">
              <p className="carte__alerte" role="alert">
                {refus}
              </p>
              <button type="button" className="carte__payer" onClick={() => quitter(4)}>
                Choisir un autre moyen
              </button>
            </section>
          )}
        </div>
      </main>
    </div>
  );
}

function FormulaireStripe({ somme, devise, reference, retour, onModifier, onPaye, libellePlusTard, quitter }) {
  const etat = useCheckoutElements();
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState('');

  if (etat.type === 'loading') {
    return (
      <p className="carte__attente" role="status">
        <span className="carte__rotation" aria-hidden="true" />
        Ouverture du paiement sécurisé…
      </p>
    );
  }
  if (etat.type === 'error') {
    return (
      <section className="carte__merci">
        <p className="carte__alerte" role="alert">
          {etat.error?.message ?? 'Le paiement sécurisé n’a pas pu s’ouvrir.'}
        </p>
        <button type="button" className="carte__payer" onClick={onModifier}>
          Reprendre
        </button>
      </section>
    );
  }

  const checkout = etat.checkout;

  async function payer(evenement) {
    evenement.preventDefault();
    setErreur('');
    setEnvoi(true);
    try {
      const resultat = await checkout.confirm({ returnUrl: retour, redirect: 'if_required' });
      if (resultat.type === 'error') {
        setErreur(resultat.error?.message ?? 'Votre paiement n’a pas abouti.');
        return;
      }
      await onPaye();
    } catch (echec) {
      setErreur(echec?.message ?? 'Votre paiement n’a pas abouti.');
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <form className="carte__formulaire" onSubmit={payer} aria-label="Paiement par carte">
      <h1 className="sr-only">Payer par carte</h1>

      <div className="carte__somme-fixe">
        <span>
          Vous donnez <strong>{fmt.montant(somme, devise)}</strong>
          {reference ? ` · réf. ${reference}` : ''}
        </span>
        <button type="button" className="carte__modifier" onClick={onModifier} disabled={envoi}>
          Modifier
        </button>
      </div>

      <h2 className="carte__rubrique carte__rubrique--section">Moyen de paiement</h2>
      <div className="carte__stripe">
        <PaymentElement options={{ layout: 'tabs' }} />
      </div>

      <p className="carte__lien-securise">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <rect x="5" y="10.5" width="14" height="10" rx="2" />
          <path d="M8.5 10.5V8a3.5 3.5 0 017 0v2.5" />
        </svg>
        <span>
          Paiement sécurisé par <strong>Stripe</strong>. Le numéro de votre carte ne passe ni par HOPE ni par
          cette page.
        </span>
      </p>

      <button type="submit" className="carte__payer" disabled={envoi} aria-busy={envoi}>
        {envoi ? (
          <>
            <span className="carte__rotation carte__rotation--clair" aria-hidden="true" />
            Paiement en cours…
          </>
        ) : (
          <>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <rect x="5" y="10.5" width="14" height="10" rx="2" />
              <path d="M8.5 10.5V8a3.5 3.5 0 017 0v2.5" />
            </svg>
            Donner {fmt.montant(somme, devise)}
          </>
        )}
      </button>
      <button type="button" className="carte__plus-tard" onClick={() => quitter()} disabled={envoi}>
        {libellePlusTard}
      </button>
      <p className="carte__erreur carte__erreur--centre" role="alert">
        {erreur}
      </p>
    </form>
  );
}
