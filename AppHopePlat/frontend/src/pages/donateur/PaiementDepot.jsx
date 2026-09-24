import { useEffect, useRef, useState } from 'react';

import HopeLogo from '../../components/HopeLogo.jsx';
import Indisponible from '../../components/paiement/Indisponible.jsx';
import { REFERENCE_PAIEMENT, montantInitial, montantSaisi, usePromesseDon } from '../../hooks/usePromesseDon.js';
import { enLettres } from '../../utils/enLettres.js';
import * as fmt from '../../utils/format.js';

const RAPIDES = [25000, 50000, 100000, 250000];
const MINIMUM = 1000;

/** Le RIB en ses cases, pour la ligne "compte a crediter" du bordereau. */
function ribEnCases(rib) {
  return `${rib.slice(0, 5)} ${rib.slice(5, 10)} ${rib.slice(10, 21)} ${rib.slice(21, 23)}`;
}

/**
 * Le depot en especes a la banque, sur le compte de HOPE.
 *
 * L'objet de reference : le bordereau de versement, que l'on remplit au
 * guichet. La page le remplit pour le donateur -- a la main, a l'encre
 * bleue, champ apres champ, montant en chiffres ET en lettres -- et il
 * n'a plus qu'a l'imprimer ou le recopier. Une fois le depot fait, il
 * donne le numero du bordereau ; le tampon "Declare" vient s'y poser.
 *
 * La promesse s'enregistre au premier temps : sa reference est le motif
 * inscrit sur le bordereau.
 */
export default function PaiementDepot() {
  const {
    profil,
    coordonnees,
    erreurChargement,
    beneficiaire,
    nom,
    don,
    envoi,
    refus,
    setRefus,
    promettre,
    declarer,
    quitter,
    montantPrevu,
    devisePrevue,
    libelleSuite,
    libellePlusTard,
  } = usePromesseDon('depot_bancaire');

  const [etape, setEtape] = useState(0);
  const [montant, setMontant] = useState('');
  const [numero, setNumero] = useState('');
  const [soumis, setSoumis] = useState(false);
  const [declare, setDeclare] = useState(false);
  const titre = useRef(null);

  // Le montant du don prepare dans l'espace, s'il est en ariary.
  useEffect(() => {
    if (profil) setMontant((m) => m || montantInitial(montantPrevu, devisePrevue));
    // Seulement au chargement.
  }, [profil]);

  useEffect(() => {
    if (profil) titre.current?.focus();
  }, [etape, profil]);

  const banque = coordonnees?.banque;
  const somme = montantSaisi(montant);
  const erreurMontant =
    somme === null ? 'Indiquez le montant du dépôt.' : somme < MINIMUM ? `Au moins ${fmt.montant(MINIMUM)}.` : '';
  const erreurNumero =
    numero.trim() && !REFERENCE_PAIEMENT.test(numero.trim()) ? 'Lettres, chiffres, points et tirets.' : '';

  function aller(n) {
    setSoumis(false);
    setRefus('');
    setEtape(n);
    window.scrollTo({ top: 0 });
  }

  async function preparer(evenement) {
    evenement.preventDefault();
    setSoumis(true);
    if (erreurMontant) return;
    if (don || (await promettre({ montant: somme }))) aller(1);
  }

  async function signaler(evenement) {
    evenement.preventDefault();
    setSoumis(true);
    if (erreurNumero) return;
    if (!numero.trim()) {
      setDeclare(false);
      aller(2);
      return;
    }
    if (await declarer(numero.trim())) {
      setDeclare(true);
      aller(2);
    }
  }

  const pret = profil && banque?.disponible;
  const valeur = don ? Number(don.montant) : somme;
  const aujourdhui = new Date().toLocaleDateString('fr-FR');

  return (
    <div className="dep">
      <header className="dep__tete">
        <button
          type="button"
          className="dep__retour"
          onClick={() => (etape === 1 ? aller(0) : quitter(4))}
          disabled={envoi || etape === 2}
          aria-label={etape === 1 ? 'Revenir au montant' : 'Revenir au choix du paiement'}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M15 5l-7 7 7 7" />
          </svg>
        </button>
        <div className="dep__tete-texte">
          <span className="dep__surtitre">Dépôt bancaire</span>
          <span className="dep__tete-etape">
            {['Le montant', 'Votre bordereau', 'C’est noté'][etape]} · {etape + 1}/3
          </span>
        </div>
        <span className="dep__tete-hope">
          <HopeLogo compact />
        </span>
      </header>

      <main className="dep__page">
        {erreurChargement && (
          <p className="dep__alerte" role="alert">
            {erreurChargement}
          </p>
        )}
        {!profil && !erreurChargement && (
          <p className="dep__attente" role="status">
            Préparation du bordereau…
          </p>
        )}
        {profil && !banque?.disponible && (
          <Indisponible
            texte="Le compte bancaire de HOPE n’est pas encore renseigné. Choisissez un autre moyen, ou continuez sans payer."
            quitter={quitter}
            prefixe="dep"
          />
        )}

        {/* ---------- 1. Le montant ---------- */}
        {pret && etape === 0 && (
          <section className="dep__temps" key="montant">
            <h1 className="dep__titre" ref={titre} tabIndex={-1}>
              Combien déposerez-vous au guichet ?
            </h1>
            <form onSubmit={preparer} noValidate aria-label="Montant du dépôt">
              <label className="dep__champ" htmlFor="dep-montant">
                <span className="dep__libelle">Montant en ariary</span>
                <input
                  id="dep-montant"
                  className={`dep__montant${soumis && erreurMontant ? ' dep__montant--erreur' : ''}`}
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder="0"
                  value={montant}
                  onChange={(e) => setMontant(e.target.value.replace(/[^\d\s]/g, ''))}
                  disabled={envoi || Boolean(don)}
                  aria-invalid={soumis && Boolean(erreurMontant)}
                  aria-describedby="dep-lettres"
                />
              </label>
              {/* Le montant en lettres se lit a mesure qu'on le tape. */}
              <p className="dep__lettres" id="dep-lettres" aria-live="polite">
                {soumis && erreurMontant ? (
                  <span className="dep__erreur">{erreurMontant}</span>
                ) : somme ? (
                  `${enLettres(somme)} ariary`
                ) : (
                  'Le montant s’écrira ici en toutes lettres.'
                )}
              </p>
              <div className="dep__rapides" role="group" aria-label="Montants proposés">
                {RAPIDES.map((v) => (
                  <button
                    key={v}
                    type="button"
                    className={`dep__rapide${somme === v ? ' dep__rapide--choisi' : ''}`}
                    aria-pressed={somme === v}
                    onClick={() => setMontant(fmt.nombre(v))}
                    disabled={envoi || Boolean(don)}
                  >
                    {fmt.nombre(v)}
                  </button>
                ))}
              </div>
              <button type="submit" className="dep__bouton" disabled={envoi} aria-busy={envoi}>
                {envoi ? 'Préparation…' : 'Remplir mon bordereau'}
              </button>
              <button type="button" className="dep__lien" onClick={() => quitter()} disabled={envoi}>
                {libellePlusTard}
              </button>
              <p className="dep__erreur dep__erreur--centre" role="alert">
                {refus}
              </p>
            </form>
          </section>
        )}

        {/* ---------- 2. Le bordereau ---------- */}
        {pret && etape >= 1 && don && (
          <section className={`dep__temps${etape === 2 ? ' dep__temps--fin' : ''}`} key="bordereau">
            {etape === 1 ? (
              <h1 className="dep__titre" ref={titre} tabIndex={-1}>
                Votre bordereau est prêt
              </h1>
            ) : (
              <h1 className="dep__titre" ref={titre} tabIndex={-1}>
                {declare ? 'Dépôt signalé, merci' : 'Votre bordereau vous attend'}
              </h1>
            )}

            <div className="bordereau-pile">
              {/* Le double carbone, rose, depasse sous l'original. */}
              <span className="bordereau-pile__double" aria-hidden="true" />
              <article className="bordereau" aria-label="Bordereau de versement prérempli">
                <header className="bordereau__tete">
                  <span className="bordereau__titre">Bordereau de versement</span>
                  <span className="bordereau__banque">{banque.nom}</span>
                </header>

                <Ligne libelle="Date" valeur={aujourdhui} rang={0} court />
                <Ligne libelle="Agence" valeur={banque.agence || '—'} rang={1} court />
                <Ligne libelle="Compte à créditer" valeur={ribEnCases(banque.rib)} rang={2} chiffres />
                <Ligne libelle="Au nom de" valeur={banque.titulaire} rang={3} />
                <Ligne libelle="Versé par" valeur={nom || '—'} rang={4} />
                <div className="bordereau__montants">
                  <Ligne libelle="Montant en chiffres" valeur={`${fmt.nombre(valeur)} Ar`} rang={5} chiffres />
                  <Ligne libelle="Montant en lettres" valeur={`${enLettres(valeur)} ariary`} rang={6} />
                </div>
                <Ligne libelle="Motif" valeur={don.reference} rang={7} chiffres />
                <div className="bordereau__signature">
                  <span>Signature du déposant</span>
                </div>

                {etape === 2 && (
                  <span className={`bordereau__tampon${declare ? '' : ' bordereau__tampon--attente'}`} aria-hidden="true">
                    {declare ? 'Déclaré' : 'À déposer'}
                    <small>HOPE</small>
                  </span>
                )}
              </article>
            </div>

            {etape === 1 && (
              <>
                <button type="button" className="dep__imprimer" onClick={() => window.print()}>
                  Imprimer le bordereau
                </button>
                <form onSubmit={signaler} noValidate aria-label="Signaler le dépôt">
                  <label className="dep__champ" htmlFor="dep-numero">
                    <span className="dep__libelle">
                      N° du bordereau tamponné par la banque <em>après le dépôt</em>
                    </span>
                    <input
                      id="dep-numero"
                      className={`dep__saisie${erreurNumero ? ' dep__saisie--erreur' : ''}`}
                      autoComplete="off"
                      spellCheck={false}
                      placeholder="Ex. 004512"
                      value={numero}
                      maxLength={40}
                      onChange={(e) => setNumero(e.target.value)}
                      disabled={envoi}
                      aria-invalid={Boolean(erreurNumero)}
                    />
                    {erreurNumero && <span className="dep__erreur">{erreurNumero}</span>}
                  </label>
                  <button type="submit" className="dep__bouton" disabled={envoi} aria-busy={envoi}>
                    {envoi ? 'Enregistrement…' : numero.trim() ? 'J’ai fait le dépôt' : 'Je déposerai plus tard'}
                  </button>
                  <p className="dep__erreur dep__erreur--centre" role="alert">
                    {refus}
                  </p>
                </form>
              </>
            )}

            {etape === 2 && (
              <>
                <p className="dep__texte">
                  {declare
                    ? `L’équipe HOPE rapproche votre dépôt de son relevé, puis confirme votre don de ${fmt.montant(don.montant)}.`
                    : `Présentez ce bordereau au guichet de ${banque.nom}. Votre don ${don.reference} se retrouve dans « Mes dons ».`}
                </p>
                <button type="button" className="dep__bouton" onClick={() => quitter()}>
                  {libelleSuite}
                </button>
              </>
            )}
          </section>
        )}
      </main>
    </div>
  );
}

/**
 * Une ligne du bordereau : le libelle imprime, la valeur ecrite a la
 * main -- elle apparait de gauche a droite, a son tour (rang).
 */
function Ligne({ libelle, valeur, rang, court = false, chiffres = false }) {
  return (
    <div className={`bordereau__ligne${court ? ' bordereau__ligne--court' : ''}`}>
      <span className="bordereau__libelle">{libelle}</span>
      <span
        className={`bordereau__main${chiffres ? ' bordereau__main--chiffres' : ''}`}
        style={{ '--rang': rang }}
      >
        {valeur}
      </span>
    </div>
  );
}
