import { useEffect, useMemo, useRef, useState } from 'react';

import HopeLogo from '../../components/HopeLogo.jsx';
import Copier from '../../components/paiement/Copier.jsx';
import { montantSaisi, usePromesseDon } from '../../hooks/usePromesseDon.js';
import * as fmt from '../../utils/format.js';

/**
 * Les services de transfert qui versent vers Madagascar, et ou l'argent
 * y arrive : sur un portefeuille mobile (MVola, Orange Money), en
 * especes au guichet, ou sur un compte bancaire.
 *
 * Verifie sur les sites des services et la liste des partenaires
 * internationaux de MVola (septembre 2026). Ces offres changent : a
 * relire de temps en temps.
 */
const PLATEFORMES = [
  { cle: 'taptap_send', nom: 'Taptap Send', arrivees: ['mobile'], mobiles: ['mvola', 'orange'], depuis: 'Europe, Royaume-Uni, États-Unis, Canada', note: 'Envoi sans frais' },
  { cle: 'remitly', nom: 'Remitly', arrivees: ['mobile'], mobiles: ['mvola', 'orange'] },
  { cle: 'sendwave', nom: 'Sendwave', arrivees: ['mobile'], mobiles: ['mvola', 'orange'], depuis: 'France, Belgique, Espagne, Italie, Royaume-Uni, États-Unis, Canada' },
  { cle: 'worldremit', nom: 'WorldRemit', arrivees: ['mobile'], mobiles: ['mvola', 'orange'] },
  { cle: 'paysend', nom: 'Paysend', arrivees: ['mobile'], mobiles: ['mvola'] },
  { cle: 'orange_money_europe', nom: 'Orange Money Europe', arrivees: ['mobile'], mobiles: ['orange'], depuis: 'France' },
  { cle: 'western_union', nom: 'Western Union', arrivees: ['mobile', 'especes', 'banque'], mobiles: ['mvola', 'orange'] },
  { cle: 'moneygram', nom: 'MoneyGram', arrivees: ['mobile', 'especes', 'banque'], mobiles: ['mvola', 'orange'] },
  { cle: 'ria', nom: 'Ria', arrivees: ['especes', 'banque', 'mobile'], mobiles: ['mvola'], note: 'Retrait aussi dans les bureaux de Paositra Malagasy' },
  { cle: 'xoom', nom: 'Xoom (PayPal)', arrivees: ['banque', 'especes', 'mobile'], mobiles: ['orange'], note: 'Le service de transfert de PayPal' },
  { cle: 'global_transfert', nom: 'Global Transfert Océan Indien', arrivees: ['especes'], depuis: 'La Réunion, Maurice', note: 'Retrait dans les bureaux de Paositra Malagasy' },
  { cle: 'revolut', nom: 'Revolut', arrivees: ['banque'] },
];

const ARRIVEES = {
  mobile: 'Sur mobile money',
  especes: 'Retrait en espèces',
  banque: 'Sur compte bancaire',
};

const FILTRES = [['tous', 'Tous'], ...Object.entries(ARRIVEES)];

/** Le petit dessin de chaque arrivee. */
function IconeArrivee({ type }) {
  const traits = {
    mobile: <path d="M8 3h8a1 1 0 011 1v16a1 1 0 01-1 1H8a1 1 0 01-1-1V4a1 1 0 011-1zM11 18h2" />,
    especes: (
      <>
        <rect x="3" y="7" width="18" height="10" rx="1.5" />
        <circle cx="12" cy="12" r="2.5" />
      </>
    ),
    banque: <path d="M3 10l9-6 9 6M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 20h18" />,
  };
  return (
    <svg viewBox="0 0 24 24" className="plt__icone" aria-hidden="true">
      {traits[type]}
    </svg>
  );
}

/**
 * Les plateformes de transfert, pour donner depuis l'etranger.
 *
 * L'objet de reference : le guichet de change qui compare ses services.
 * On filtre par la facon dont l'argent arrive, on choisit un service ;
 * la page dit alors a qui l'envoyer -- le numero MVola ou Orange Money
 * de HOPE, la personne qui retire au guichet, ou le compte bancaire --
 * et le donateur note le numero de son transfert.
 */
export default function PaiementPlateforme() {
  const { profil, coordonnees, erreurChargement, beneficiaire, don, envoi, refus, setRefus, promettre, quitter } =
    usePromesseDon('plateforme');

  const [filtre, setFiltre] = useState('tous');
  const [choix, setChoix] = useState(null);
  const [devise, setDevise] = useState('EUR');
  const [montant, setMontant] = useState('');
  const [reference, setReference] = useState('');
  const [soumis, setSoumis] = useState(false);
  const titre = useRef(null);

  useEffect(() => {
    const preferee = profil?.profil?.devise;
    if (['EUR', 'USD', 'MGA'].includes(preferee)) setDevise(preferee);
  }, [profil]);

  useEffect(() => {
    if (profil) titre.current?.focus();
  }, [choix, don, profil]);

  // Ce que HOPE sait recevoir : chaque arrivee n'est ouverte que si ses
  // coordonnees sont renseignees.
  const ouvertes = useMemo(() => {
    const p = coordonnees?.plateformes;
    return {
      mvola: Boolean(p?.mvola?.disponible),
      orange: Boolean(p?.orangeMoney?.disponible),
      especes: Boolean(p?.retrait),
      banque: Boolean(coordonnees?.banque?.internationalDisponible),
    };
  }, [coordonnees]);

  function arriveesOuvertes(plateforme) {
    return plateforme.arrivees.filter((a) =>
      a === 'mobile' ? (plateforme.mobiles ?? []).some((m) => ouvertes[m]) : ouvertes[a]
    );
  }

  const visibles = PLATEFORMES.filter((p) => filtre === 'tous' || p.arrivees.includes(filtre));
  const somme = montantSaisi(montant);
  const refPropre = reference.replace(/\s+/g, '');
  const erreurs = {
    montant: somme === null ? 'Indiquez le montant envoyé.' : '',
    reference: refPropre && !/^[A-Za-z0-9][A-Za-z0-9.-]{3,39}$/.test(refPropre) ? 'Lettres, chiffres, points et tirets.' : '',
  };

  function choisir(plateforme) {
    setChoix(plateforme);
    setSoumis(false);
    setRefus('');
    window.scrollTo({ top: 0 });
  }

  async function envoyer(evenement) {
    evenement.preventDefault();
    setSoumis(true);
    if (erreurs.montant || erreurs.reference) return;
    await promettre({
      montant: somme,
      devise,
      plateforme: choix.cle,
      referencePaiement: refPropre || undefined,
    });
  }

  const p = coordonnees?.plateformes;

  return (
    <div className="plt">
      <header className="plt__tete">
        <button
          type="button"
          className="plt__retour"
          onClick={() => (choix && !don ? choisir(null) : quitter(4))}
          disabled={envoi || Boolean(don)}
          aria-label={choix ? 'Revenir à la liste des plateformes' : 'Revenir au choix du paiement'}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M15 5l-7 7 7 7" />
          </svg>
        </button>
        <span className="plt__tete-titre">Plateformes de transfert</span>
        <span className="plt__tete-hope">
          <HopeLogo compact />
        </span>
      </header>

      <main className="plt__page">
        {erreurChargement && (
          <p className="plt__alerte" role="alert">
            {erreurChargement}
          </p>
        )}
        {!profil && !erreurChargement && (
          <p className="plt__attente" role="status">
            Préparation…
          </p>
        )}

        {/* ---------- 1. Le choix ---------- */}
        {profil && !choix && (
          <section className="plt__temps" key="choix">
            <h1 className="plt__titre" ref={titre} tabIndex={-1}>
              Par quel service envoyez-vous ?
            </h1>
            <div className="plt__filtres" role="group" aria-label="Où l’argent arrive">
              {FILTRES.map(([cle, texte]) => (
                <button
                  key={cle}
                  type="button"
                  className={`plt__filtre${filtre === cle ? ' plt__filtre--actif' : ''}`}
                  aria-pressed={filtre === cle}
                  onClick={() => setFiltre(cle)}
                >
                  {cle !== 'tous' && <IconeArrivee type={cle} />}
                  {texte}
                </button>
              ))}
            </div>

            <ul className="plt__liste" key={filtre}>
              {visibles.map((plateforme, i) => {
                const possibles = arriveesOuvertes(plateforme);
                return (
                  <li key={plateforme.cle} style={{ '--rang': i }}>
                    <button
                      type="button"
                      className="plt__carte"
                      onClick={() => choisir(plateforme)}
                      disabled={possibles.length === 0}
                    >
                      <span className="plt__nom">{plateforme.nom}</span>
                      <span className="plt__arrivees">
                        {plateforme.arrivees.map((a) => (
                          <span key={a} className="plt__arrivee" title={ARRIVEES[a]}>
                            <IconeArrivee type={a} />
                            <span className="sr-only">{ARRIVEES[a]}</span>
                          </span>
                        ))}
                      </span>
                      {(plateforme.note || plateforme.depuis) && (
                        <span className="plt__note">{plateforme.note || `Depuis : ${plateforme.depuis}`}</span>
                      )}
                      {possibles.length === 0 && <span className="plt__note">Pas encore ouvert chez HOPE</span>}
                    </button>
                  </li>
                );
              })}
            </ul>

            {/* La remarque : ce qu'on cherche souvent, et qui ne marche pas. */}
            <aside className="plt__remarque">
              <strong>Bon à savoir</strong>
              <p>
                PayPal ne verse pas vers Madagascar : passez par <em>Xoom</em>, son service de transfert. Wise, Skrill
                et LemFi n’envoient pas encore vers Madagascar. Les montants et les frais varient selon le service et
                le pays d’envoi : comparez-les avant d’envoyer.
              </p>
            </aside>

            <button type="button" className="plt__lien" onClick={() => quitter()}>
              Payer plus tard
            </button>
          </section>
        )}

        {/* ---------- 2. L'envoi ---------- */}
        {profil && choix && !don && (
          <section className="plt__temps" key="envoi">
            <h1 className="plt__titre" ref={titre} tabIndex={-1}>
              Envoyer avec {choix.nom}
            </h1>
            <p className="plt__sous-titre">Dans l’application {choix.nom}, choisissez l’une de ces destinations :</p>

            <div className="plt__destinations">
              {arriveesOuvertes(choix).includes('mobile') &&
                (choix.mobiles ?? [])
                  .filter((m) => ouvertes[m])
                  .map((m) => {
                    const compte = m === 'mvola' ? p.mvola : p.orangeMoney;
                    return (
                      <Destination
                        key={m}
                        type="mobile"
                        titre={m === 'mvola' ? 'Portefeuille MVola' : 'Portefeuille Orange Money'}
                        lignes={[
                          ['Bénéficiaire', compte.titulaire],
                          ['Numéro', `+261 ${compte.numero.slice(1)}`, `+261${compte.numero.slice(1)}`],
                        ]}
                      />
                    );
                  })}
              {arriveesOuvertes(choix).includes('especes') && (
                <Destination
                  type="especes"
                  titre="Retrait au guichet"
                  lignes={[
                    ['Bénéficiaire', p.retrait.nom, p.retrait.nom],
                    ['Ville', `${p.retrait.ville}, Madagascar`],
                  ]}
                />
              )}
              {arriveesOuvertes(choix).includes('banque') && (
                <Destination
                  type="banque"
                  titre="Compte bancaire de HOPE"
                  lignes={[
                    ['Bénéficiaire', coordonnees.banque.titulaire],
                    ['IBAN', coordonnees.banque.iban, coordonnees.banque.iban],
                    ['BIC', coordonnees.banque.bic, coordonnees.banque.bic],
                  ]}
                />
              )}
            </div>

            <form onSubmit={envoyer} noValidate aria-label="Votre envoi">
              <div className="plt__montant-rang">
                <label className="plt__champ" htmlFor="plt-montant">
                  <span className="plt__libelle">Montant envoyé</span>
                  <input
                    id="plt-montant"
                    className={`plt__saisie${soumis && erreurs.montant ? ' plt__saisie--erreur' : ''}`}
                    inputMode="decimal"
                    autoComplete="off"
                    placeholder="0"
                    value={montant}
                    onChange={(e) => setMontant(e.target.value.replace(/[^\d\s,.]/g, ''))}
                    disabled={envoi}
                    aria-invalid={soumis && Boolean(erreurs.montant)}
                  />
                </label>
                <label className="plt__champ plt__champ--devise" htmlFor="plt-devise">
                  <span className="plt__libelle">Devise</span>
                  <select
                    id="plt-devise"
                    className="plt__saisie"
                    value={devise}
                    onChange={(e) => setDevise(e.target.value)}
                    disabled={envoi}
                  >
                    <option value="EUR">EUR</option>
                    <option value="USD">USD</option>
                    <option value="MGA">MGA</option>
                  </select>
                </label>
              </div>
              {soumis && erreurs.montant && <p className="plt__erreur">{erreurs.montant}</p>}

              <label className="plt__champ" htmlFor="plt-reference">
                <span className="plt__libelle">
                  Numéro du transfert <em>si vous avez déjà envoyé</em>
                </span>
                <input
                  id="plt-reference"
                  className={`plt__saisie${erreurs.reference ? ' plt__saisie--erreur' : ''}`}
                  autoComplete="off"
                  spellCheck={false}
                  placeholder={choix.cle === 'western_union' ? 'MTCN, 10 chiffres' : 'Référence du transfert'}
                  value={reference}
                  maxLength={44}
                  onChange={(e) => setReference(e.target.value)}
                  disabled={envoi}
                  aria-invalid={Boolean(erreurs.reference)}
                />
                {erreurs.reference && <span className="plt__erreur">{erreurs.reference}</span>}
              </label>

              <button type="submit" className="plt__bouton" disabled={envoi} aria-busy={envoi}>
                {envoi ? 'Enregistrement…' : refPropre ? 'J’ai envoyé mon don' : 'Enregistrer, j’enverrai plus tard'}
              </button>
              <p className="plt__erreur plt__erreur--centre" role="alert">
                {refus}
              </p>
            </form>
          </section>
        )}

        {/* ---------- 3. Merci ---------- */}
        {profil && don && (
          <section className="plt__temps plt__temps--fin" key="merci">
            <div className="plt__coche" aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <path d="M6 12.5l4 4 8-9" />
              </svg>
            </div>
            <h1 className="plt__titre plt__titre--centre" ref={titre} tabIndex={-1}>
              Merci, c’est noté
            </h1>
            <p className="plt__texte">
              Votre don de <strong>{fmt.montant(don.montant, don.devise)}</strong> via {choix.nom} pour{' '}
              {beneficiaire} est enregistré ({don.reference}). L’équipe HOPE le confirme dès réception.
            </p>
            <button type="button" className="plt__bouton" onClick={() => quitter()}>
              Continuer mon inscription
            </button>
          </section>
        )}
      </main>
    </div>
  );
}

/** Une destination possible : ce qu'il faut saisir dans le service. */
function Destination({ type, titre, lignes }) {
  return (
    <section className="plt__destination">
      <h2 className="plt__destination-titre">
        <IconeArrivee type={type} />
        {titre}
      </h2>
      {lignes.map(([libelle, valeur, aCopier]) => (
        <div key={libelle} className="plt__destination-ligne">
          <span className="plt__destination-libelle">{libelle}</span>
          <span className="plt__destination-valeur">{valeur}</span>
          {aCopier && <Copier valeur={aCopier} libelle={libelle} className="plt__copier" />}
        </div>
      ))}
    </section>
  );
}
