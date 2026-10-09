import { useEffect, useRef, useState } from 'react';

import HopeLogo from '../../components/HopeLogo.jsx';
import Copier from '../../components/paiement/Copier.jsx';
import Indisponible from '../../components/paiement/Indisponible.jsx';
import { REFERENCE_PAIEMENT, montantInitial, montantSaisi, usePromesseDon } from '../../hooks/usePromesseDon.js';
import * as fmt from '../../utils/format.js';

const RAPIDES = [25000, 50000, 100000, 250000];
const MINIMUM = 1000;

const ETAPES = ['Montant', 'Coordonnées', 'Confirmation'];

const GUILLOCHE = Array.from({ length: 14 }, (_, k) => {
  const points = [];
  for (let x = 0; x <= 420; x += 6) {
    const y = 110 + Math.sin(x / 38 + k * 0.45) * (34 + k * 2.2) * Math.cos(x / 170 + k * 0.2);
    points.push(`${x},${y.toFixed(1)}`);
  }
  return `M${points.join(' L')}`;
});

function casesDuRib(rib) {
  return [
    { nom: 'Banque', valeur: rib.slice(0, 5) },
    { nom: 'Guichet', valeur: rib.slice(5, 10) },
    { nom: 'N° de compte', valeur: rib.slice(10, 21) },
    { nom: 'Clé', valeur: rib.slice(21, 23) },
  ];
}

function ibanLisible(iban) {
  return String(iban ?? '').replace(/(.{4})/g, '$1 ').trim();
}

export default function PaiementVirement() {
  const {
    profil,
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
  } = usePromesseDon('virement_bancaire');

  const [etape, setEtape] = useState(0);
  const [montant, setMontant] = useState('');
  const [reference, setReference] = useState('');
  const [soumis, setSoumis] = useState(false);
  const [signale, setSignale] = useState(false);
  const titre = useRef(null);

  useEffect(() => {
    if (profil) setMontant((m) => m || montantInitial(montantPrevu, devisePrevue));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profil]);

  useEffect(() => {
    if (profil) titre.current?.focus();
  }, [etape, profil]);

  const banque = coordonnees?.banque;
  const somme = montantSaisi(montant);
  const erreurMontant =
    somme === null ? 'Indiquez le montant du virement.' : somme < MINIMUM ? `Au moins ${fmt.montant(MINIMUM)}.` : '';
  const erreurReference =
    reference.trim() && !REFERENCE_PAIEMENT.test(reference.trim()) ? 'Lettres, chiffres, points et tirets.' : '';

  function aller(numero) {
    setSoumis(false);
    setRefus('');
    setEtape(numero);
    window.scrollTo({ top: 0 });
  }

  async function obtenirCoordonnees(evenement) {
    evenement.preventDefault();
    setSoumis(true);
    if (erreurMontant) return;
    if (don || (await promettre({ montant: somme }))) aller(1);
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

  const pret = profil && banque?.disponible;

  return (
    <div className="vir">
      <header className="vir__tete">
        <div className="vir__tete-dedans">
          <button
            type="button"
            className="vir__retour"
            onClick={() => (etape === 1 ? aller(0) : quitter(4))}
            disabled={envoi || etape === 2}
            aria-label={etape === 1 ? 'Revenir au montant' : 'Revenir au choix du paiement'}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M15 5l-7 7 7 7" />
            </svg>
          </button>
          <span className="vir__tete-titre">Virement bancaire</span>
          <span className="vir__tete-hope">
            <HopeLogo compact />
          </span>
        </div>
      </header>

      <main className="vir__page">
        <ol className="vir__etapes" aria-label="Étapes du virement">
          {ETAPES.map((nom, i) => (
            <li
              key={nom}
              className={`vir__etape${i === etape ? ' vir__etape--active' : ''}${i < etape ? ' vir__etape--faite' : ''}`}
              aria-current={i === etape ? 'step' : undefined}
            >
              {nom}
            </li>
          ))}
        </ol>

        {erreurChargement && (
          <p className="vir__alerte" role="alert">
            {erreurChargement}
          </p>
        )}
        {!profil && !erreurChargement && (
          <p className="vir__attente" role="status">
            <span className="vir__rotation" aria-hidden="true" />
            Préparation du virement…
          </p>
        )}
        {profil && !banque?.disponible && (
          <Indisponible
            texte="Le compte bancaire de HOPE n’est pas encore renseigné. Choisissez un autre moyen, ou continuez sans payer : vous pourrez donner depuis votre espace."
            quitter={quitter}
            prefixe="vir"
          />
        )}

        {pret && etape === 0 && (
          <section className="vir__temps" key="montant">
            <h1 className="vir__titre" ref={titre} tabIndex={-1}>
              Quel montant virez-vous ?
            </h1>
            <form onSubmit={obtenirCoordonnees} noValidate aria-label="Montant du virement">
              <label className="vir__champ" htmlFor="vir-montant">
                <span className="vir__libelle">Montant</span>
                <span className={`vir__montant${soumis && erreurMontant ? ' vir__montant--erreur' : ''}`}>
                  <input
                    id="vir-montant"
                    inputMode="numeric"
                    autoComplete="off"
                    placeholder="0"
                    value={montant}
                    onChange={(e) => setMontant(e.target.value.replace(/[^\d\s]/g, ''))}
                    disabled={envoi || Boolean(don)}
                    aria-invalid={soumis && Boolean(erreurMontant)}
                    aria-describedby="vir-montant-erreur"
                  />
                  <span aria-hidden="true">Ar</span>
                </span>
              </label>
              <div className="vir__rapides" role="group" aria-label="Montants proposés">
                {RAPIDES.map((valeur) => (
                  <button
                    key={valeur}
                    type="button"
                    className={`vir__rapide${somme === valeur ? ' vir__rapide--choisi' : ''}`}
                    aria-pressed={somme === valeur}
                    onClick={() => setMontant(fmt.nombre(valeur))}
                    disabled={envoi || Boolean(don)}
                  >
                    {fmt.nombre(valeur)}
                  </button>
                ))}
              </div>
              <p className="vir__erreur" id="vir-montant-erreur" aria-live="polite">
                {soumis ? erreurMontant : ''}
              </p>

              <p className="vir__pour">
                Pour <strong>{beneficiaire}</strong>
              </p>

              <button type="submit" className="vir__bouton" disabled={envoi} aria-busy={envoi}>
                {envoi ? 'Enregistrement…' : 'Obtenir les coordonnées'}
              </button>
              <button type="button" className="vir__lien" onClick={() => quitter()} disabled={envoi}>
                {libellePlusTard}
              </button>
              <p className="vir__erreur vir__erreur--centre" role="alert">
                {refus}
              </p>
            </form>
          </section>
        )}

        {pret && etape === 1 && don && (
          <section className="vir__temps" key="coordonnees">
            <h1 className="vir__titre" ref={titre} tabIndex={-1}>
              Virez {fmt.montant(don.montant)} depuis votre banque
            </h1>

            <article className="rib" aria-label="Relevé d’identité bancaire de HOPE">
              <svg className="rib__guilloche" viewBox="0 0 420 220" preserveAspectRatio="none" aria-hidden="true">
                {GUILLOCHE.map((d, i) => (
                  <path key={i} d={d} style={{ '--i': i }} />
                ))}
              </svg>
              <header className="rib__tete">
                <span className="rib__banque">
                  {banque.nom || 'Banque'}
                  {banque.agence && <small>{banque.agence}</small>}
                </span>
                <span className="rib__sigle">RIB</span>
              </header>
              <p className="rib__titulaire">
                <span>Titulaire du compte</span>
                <strong>{banque.titulaire}</strong>
              </p>
              <div className="rib__cases">
                {casesDuRib(banque.rib).map((c) => (
                  <span key={c.nom} className="rib__case">
                    <small>{c.nom}</small>
                    <span>{c.valeur}</span>
                  </span>
                ))}
              </div>
              {banque.iban && <p className="rib__iban">IBAN {ibanLisible(banque.iban)}</p>}
              <div className="rib__pied">
                <Copier valeur={banque.rib} libelle="RIB de HOPE" className="rib__copier" texte="Copier le RIB" />
              </div>
            </article>

            <div className="vir__motif">
              <span className="vir__motif-libelle">Motif du virement, à recopier tel quel</span>
              <span className="vir__motif-valeur">{don.reference}</span>
              <Copier valeur={don.reference} libelle="Motif du virement" className="vir__copier" />
              <span className="vir__motif-aide">C’est lui qui permet à l’équipe de retrouver votre don.</span>
            </div>

            <form onSubmit={confirmer} noValidate aria-label="Confirmer le virement">
              <label className="vir__champ" htmlFor="vir-reference">
                <span className="vir__libelle">
                  Référence de l’opération <em>facultatif</em>
                </span>
                <input
                  id="vir-reference"
                  className={`vir__saisie${erreurReference ? ' vir__saisie--erreur' : ''}`}
                  autoComplete="off"
                  spellCheck={false}
                  placeholder="Donnée par votre banque après le virement"
                  value={reference}
                  maxLength={40}
                  onChange={(e) => setReference(e.target.value)}
                  disabled={envoi}
                  aria-invalid={Boolean(erreurReference)}
                />
                {erreurReference && <span className="vir__erreur">{erreurReference}</span>}
              </label>
              <button type="submit" className="vir__bouton" disabled={envoi} aria-busy={envoi}>
                {envoi ? 'Enregistrement…' : reference.trim() ? 'J’ai fait le virement' : 'Je ferai le virement plus tard'}
              </button>
              <p className="vir__erreur vir__erreur--centre" role="alert">
                {refus}
              </p>
            </form>
          </section>
        )}

        {pret && etape === 2 && don && (
          <section className="vir__temps vir__temps--fin" key="fin">
            <div className="vir__sceau" aria-hidden="true">
              <svg viewBox="0 0 52 52">
                <circle cx="26" cy="26" r="24" />
                <path d="M15 27l7 7 15-16" />
              </svg>
            </div>
            <h1 className="vir__titre vir__titre--centre" ref={titre} tabIndex={-1}>
              {signale ? 'Virement signalé, merci' : 'Votre don vous attend'}
            </h1>
            <p className="vir__texte">
              {signale
                ? `L’équipe HOPE rapproche votre virement de ${fmt.montant(don.montant)} de son relevé, puis confirme votre don.`
                : `Faites le virement de ${fmt.montant(don.montant)} quand vous le souhaitez, avec le motif ${don.reference}. Il se retrouve dans « Mes dons ».`}
            </p>
            <dl className="vir__recap">
              <div>
                <dt>Motif</dt>
                <dd>{don.reference}</dd>
              </div>
              <div>
                <dt>Pour</dt>
                <dd>{beneficiaire}</dd>
              </div>
              <div>
                <dt>Statut</dt>
                <dd>{signale ? 'À rapprocher du relevé' : 'En attente du virement'}</dd>
              </div>
            </dl>
            <button type="button" className="vir__bouton" onClick={() => quitter()}>
              {libelleSuite}
            </button>
          </section>
        )}
      </main>
    </div>
  );
}
