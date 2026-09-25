import { useEffect, useRef, useState } from 'react';

import HopeLogo from '../../components/HopeLogo.jsx';
import Copier from '../../components/paiement/Copier.jsx';
import Indisponible from '../../components/paiement/Indisponible.jsx';
import { REFERENCE_PAIEMENT, montantInitial, montantSaisi, usePromesseDon } from '../../hooks/usePromesseDon.js';
import * as fmt from '../../utils/format.js';
import { nomDuPays } from '../../utils/pays.js';

const DEVISES = [
  { code: 'EUR', rapides: [20, 50, 100, 250] },
  { code: 'USD', rapides: [20, 50, 100, 250] },
];

/** "MG4600000000..." -> "MG46 0000 0000 ..." */
function parQuatre(texte) {
  return String(texte ?? '').replace(/(.{4})/g, '$1 ').trim();
}

/**
 * Le virement international, depuis une banque hors de Madagascar.
 *
 * L'objet de reference : l'enveloppe "par avion", bordee de chevrons
 * rouges et bleus. Dedans, les coordonnees SWIFT de HOPE -- IBAN groupe
 * par quatre, BIC, banque, titulaire -- et le motif. Sous l'enveloppe,
 * le trajet de l'argent : la banque du donateur, une banque
 * correspondante, la banque de HOPE a Antananarivo. Le point voyage le
 * long du trajet a mesure que le don avance.
 */
export default function PaiementInternational() {
  const {
    profil,
    personne,
    coordonnees,
    erreurChargement,
    beneficiaire,
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
  } = usePromesseDon('virement_international');

  const [etape, setEtape] = useState(0);
  const [devise, setDevise] = useState('EUR');
  const [montant, setMontant] = useState('');
  const [reference, setReference] = useState('');
  const [soumis, setSoumis] = useState(false);
  const [signale, setSignale] = useState(false);
  const titre = useRef(null);

  useEffect(() => {
    if (!profil) return;
    // La devise du don prepare, sinon celle du profil ; l'euro par defaut.
    const choisie = ['EUR', 'USD'].includes(devisePrevue) ? devisePrevue : personne.devise === 'USD' ? 'USD' : 'EUR';
    setDevise(choisie);
    setMontant((m) => m || montantInitial(montantPrevu, devisePrevue, choisie));
  // Pre-remplissage a l'arrivee des donnees : volontairement pas a chaque saisie.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profil]);

  useEffect(() => {
    if (profil) titre.current?.focus();
  }, [etape, profil]);

  const banque = coordonnees?.banque;
  const reglage = DEVISES.find((d) => d.code === devise);
  const somme = montantSaisi(montant);
  const erreurMontant = somme === null ? 'Indiquez le montant.' : somme < 5 ? `Au moins ${fmt.montant(5, devise)}.` : '';
  const erreurReference =
    reference.trim() && !REFERENCE_PAIEMENT.test(reference.trim()) ? 'Lettres, chiffres, points et tirets.' : '';
  const paysDonateur = nomDuPays(personne.pays) || 'Votre pays';

  function aller(n) {
    setSoumis(false);
    setRefus('');
    setEtape(n);
    window.scrollTo({ top: 0 });
  }

  async function obtenir(evenement) {
    evenement.preventDefault();
    setSoumis(true);
    if (erreurMontant) return;
    if (don || (await promettre({ montant: somme, devise }))) aller(1);
  }

  async function confirmer(evenement) {
    evenement.preventDefault();
    setSoumis(true);
    if (erreurReference) return;
    if (!reference.trim()) {
      setSignale(false);
      aller(2);
      return;
    }
    if (await declarer(reference.trim())) {
      setSignale(true);
      aller(2);
    }
  }

  const pret = profil && banque?.internationalDisponible;
  // Ou en est le don sur le trajet : 0 depart, 1 envoye, 2 arrive.
  const avancee = etape === 2 && signale ? 1 : 0;

  return (
    <div className="int">
      <header className="int__tete">
        <button
          type="button"
          className="int__retour"
          onClick={() => (etape === 1 ? aller(0) : quitter(4))}
          disabled={envoi || etape === 2}
          aria-label={etape === 1 ? 'Revenir au montant' : 'Revenir au choix du paiement'}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M15 5l-7 7 7 7" />
          </svg>
        </button>
        <span className="int__tete-titre">Virement international</span>
        <span className="int__tete-hope">
          <HopeLogo compact />
        </span>
      </header>

      <main className="int__page">
        {erreurChargement && (
          <p className="int__alerte" role="alert">
            {erreurChargement}
          </p>
        )}
        {!profil && !erreurChargement && (
          <p className="int__attente" role="status">
            Préparation…
          </p>
        )}
        {profil && !banque?.internationalDisponible && (
          <Indisponible
            texte="Les coordonnées internationales de HOPE (IBAN et BIC) ne sont pas encore renseignées. Choisissez un autre moyen, ou continuez sans payer."
            quitter={quitter}
            prefixe="int"
          />
        )}

        {pret && (
          <div className="avion">
            <span className="avion__cachet" aria-hidden="true">
              Par avion
              <small>By air mail</small>
            </span>

            {/* ---------- 1. Le montant ---------- */}
            {etape === 0 && (
              <section className="int__temps" key="montant">
                <h1 className="int__titre" ref={titre} tabIndex={-1}>
                  Envoyer un don depuis l’étranger
                </h1>
                <form onSubmit={obtenir} noValidate aria-label="Montant du virement">
                  <div className="int__devises" role="radiogroup" aria-label="Devise">
                    {DEVISES.map((d) => (
                      <button
                        key={d.code}
                        type="button"
                        role="radio"
                        aria-checked={devise === d.code}
                        className={`int__devise${devise === d.code ? ' int__devise--choisie' : ''}`}
                        onClick={() => {
                          setDevise(d.code);
                          setMontant('');
                        }}
                        disabled={envoi || Boolean(don)}
                      >
                        {d.code}
                      </button>
                    ))}
                  </div>
                  <label className="int__champ" htmlFor="int-montant">
                    <span className="int__libelle">Montant</span>
                    <span className={`int__montant${soumis && erreurMontant ? ' int__montant--erreur' : ''}`}>
                      <input
                        id="int-montant"
                        inputMode="decimal"
                        autoComplete="off"
                        placeholder="0"
                        value={montant}
                        onChange={(e) => setMontant(e.target.value.replace(/[^\d\s,.]/g, ''))}
                        disabled={envoi || Boolean(don)}
                        aria-invalid={soumis && Boolean(erreurMontant)}
                      />
                      <span aria-hidden="true">{devise}</span>
                    </span>
                  </label>
                  <div className="int__rapides" role="group" aria-label="Montants proposés">
                    {reglage.rapides.map((v) => (
                      <button
                        key={v}
                        type="button"
                        className={`int__rapide${somme === v ? ' int__rapide--choisi' : ''}`}
                        aria-pressed={somme === v}
                        onClick={() => setMontant(String(v))}
                        disabled={envoi || Boolean(don)}
                      >
                        {v} {devise === 'EUR' ? '€' : '$'}
                      </button>
                    ))}
                  </div>
                  {soumis && erreurMontant && <p className="int__erreur">{erreurMontant}</p>}
                  <p className="int__pour">
                    Pour <strong>{beneficiaire}</strong>
                  </p>
                  <button type="submit" className="int__bouton" disabled={envoi} aria-busy={envoi}>
                    {envoi ? 'Enregistrement…' : 'Obtenir les coordonnées SWIFT'}
                  </button>
                  <button type="button" className="int__lien" onClick={() => quitter()} disabled={envoi}>
                    {libellePlusTard}
                  </button>
                  <p className="int__erreur int__erreur--centre" role="alert">
                    {refus}
                  </p>
                </form>
              </section>
            )}

            {/* ---------- 2. Les coordonnees ---------- */}
            {etape === 1 && don && (
              <section className="int__temps" key="coordonnees">
                <h1 className="int__titre" ref={titre} tabIndex={-1}>
                  Virez {fmt.montant(don.montant, don.devise)} à HOPE
                </h1>
                <dl className="int__coord">
                  <Coord libelle="Bénéficiaire" valeur={banque.titulaire} />
                  <Coord libelle="IBAN" valeur={parQuatre(banque.iban)} brut={banque.iban} chiffres />
                  <Coord libelle="BIC / SWIFT" valeur={banque.bic} chiffres />
                  <Coord libelle="Banque" valeur={[banque.nom, banque.adresse].filter(Boolean).join(', ')} />
                  <Coord libelle="Motif" valeur={don.reference} chiffres fort />
                </dl>
                <p className="int__frais">
                  Si votre banque le propose, choisissez les frais <strong>« OUR »</strong> (à votre charge) : HOPE
                  reçoit alors le montant entier. Avec « SHA », des frais intermédiaires sont retenus en chemin.
                </p>
                <form onSubmit={confirmer} noValidate aria-label="Confirmer le virement">
                  <label className="int__champ" htmlFor="int-reference">
                    <span className="int__libelle">
                      Référence du virement <em>facultatif</em>
                    </span>
                    <input
                      id="int-reference"
                      className={`int__saisie${erreurReference ? ' int__saisie--erreur' : ''}`}
                      autoComplete="off"
                      spellCheck={false}
                      placeholder="Donnée par votre banque"
                      value={reference}
                      maxLength={40}
                      onChange={(e) => setReference(e.target.value)}
                      disabled={envoi}
                      aria-invalid={Boolean(erreurReference)}
                    />
                    {erreurReference && <span className="int__erreur">{erreurReference}</span>}
                  </label>
                  <button type="submit" className="int__bouton" disabled={envoi} aria-busy={envoi}>
                    {envoi ? 'Enregistrement…' : reference.trim() ? 'J’ai envoyé le virement' : 'J’enverrai le virement plus tard'}
                  </button>
                  <p className="int__erreur int__erreur--centre" role="alert">
                    {refus}
                  </p>
                </form>
              </section>
            )}

            {/* ---------- 3. Le suivi ---------- */}
            {etape === 2 && don && (
              <section className="int__temps" key="suivi">
                <h1 className="int__titre" ref={titre} tabIndex={-1}>
                  {signale ? 'Votre don est en route' : 'Votre don vous attend'}
                </h1>
                <p className="int__texte">
                  {signale
                    ? 'Un virement international met en général 2 à 5 jours ouvrés. L’équipe HOPE confirme votre don dès son arrivée.'
                    : `Envoyez le virement quand vous le souhaitez, avec le motif ${don.reference}. Il se retrouve dans « Mes dons ».`}
                </p>
                <button type="button" className="int__bouton" onClick={() => quitter()}>
                  {libelleSuite}
                </button>
              </section>
            )}
          </div>
        )}

        {/* Le trajet de l'argent, sous l'enveloppe. */}
        {pret && (
          <figure className="trajet" aria-label="Le trajet d’un virement international">
            <svg viewBox="0 0 320 70" aria-hidden="true">
              <path className="trajet__fil" d="M20 50 C 90 -5, 230 -5, 300 50" />
              <circle className="trajet__point" r="6" style={{ '--avancee': avancee }} />
            </svg>
            <ol className="trajet__etapes">
              <li className={avancee >= 1 ? 'trajet__etape--fait' : ''}>
                <strong>{paysDonateur}</strong>
                <span>Votre banque</span>
              </li>
              <li className={avancee >= 1 ? 'trajet__etape--encours' : ''}>
                <strong>En chemin</strong>
                <span>Banque correspondante</span>
              </li>
              <li>
                <strong>Antananarivo</strong>
                <span>La banque de HOPE</span>
              </li>
            </ol>
          </figure>
        )}
      </main>
    </div>
  );
}

/** Une coordonnee bancaire, et son bouton "Copier". */
function Coord({ libelle, valeur, brut, chiffres = false, fort = false }) {
  return (
    <div className={`int__coord-ligne${fort ? ' int__coord-ligne--fort' : ''}`}>
      <dt>{libelle}</dt>
      <dd className={chiffres ? 'int__chiffres' : ''}>{valeur || '—'}</dd>
      {valeur && <Copier valeur={brut ?? valeur} libelle={libelle} className="int__copier" />}
    </div>
  );
}
