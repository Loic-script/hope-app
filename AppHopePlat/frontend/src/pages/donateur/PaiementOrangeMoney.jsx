import { useEffect, useState } from 'react';

import HopeLogo from '../../components/HopeLogo.jsx';
import logoOrangeMoney from '../../assets/paiement/orange-money.webp';
import { MONTANTS_RAPIDES, numeroLisible, usePaiementMobile } from '../../hooks/usePaiementMobile.js';
import * as donateurService from '../../services/donateur.service.js';
import * as fmt from '../../utils/format.js';

/** Orange Money : un numero Orange, 032 ou 037. */
const ORANGE_MONEY = {
  mode: 'orange_money',
  numeroValide: /^3[27]\d{7}$/,
  messageNumero: 'Un numéro Orange Money commence par 032 ou 037.',
  chargerCompte: donateurService.compteOrangeMoney,
};

/** Les trois temps, tels que les chevrons les nomment. */
const CHEVRONS = ['Montant', 'Envoi', 'Reçu'];

/** "24 sept. 2026 10:12:03", comme sur un recu Orange Money. */
function horodatage(date) {
  const jour = date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
  const heure = date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  return `${jour} ${heure}`;
}

/**
 * Le paiement par Orange Money, ouvert depuis l'etape 4 du parcours.
 *
 * La grammaire des pages d'Orange Money : un bandeau noir, un titre
 * franc, des chevrons noir / orange / gris qui disent l'etape, des
 * champs sobres. Le troisieme temps est un recu de transaction, dans
 * la forme de celui qu'Orange Money delivre -- sections en gras, lignes
 * libelle / valeur --, et il s'imprime.
 *
 * La mecanique (usePaiementMobile) est celle de MVola : le donateur
 * envoie depuis #144#, recopie le numero de transaction, et l'equipe
 * rapproche avant de confirmer. Aucun code secret n'est demande.
 */
export default function PaiementOrangeMoney() {
  const {
    profil,
    compte,
    erreurChargement,
    temps,
    indice,
    allerA,
    setMontant,
    somme,
    numero,
    setNumero,
    reference,
    setReference,
    soumis,
    envoi,
    refus,
    don,
    titre,
    beneficiaire,
    erreurs,
    validerMontant,
    declarer,
    quitter,
  } = usePaiementMobile(ORANGE_MONEY);

  // L'heure du recu : celle ou le don a ete enregistre.
  const [edition, setEdition] = useState(null);
  useEffect(() => {
    if (don) setEdition(new Date());
  }, [don]);

  const pret = profil && compte?.disponible;
  const titres = {
    montant: 'Faire votre don par Orange Money',
    envoi: `Envoyer ${fmt.montant(somme)}`,
    merci: 'Votre reçu',
  };

  return (
    <div className="om">
      <header className="om__bandeau">
        <div className="om__bandeau-dedans">
          <button
            type="button"
            className="om__retour"
            onClick={() => (temps === 'envoi' ? allerA('montant') : quitter(4))}
            disabled={envoi || temps === 'merci'}
            aria-label={temps === 'envoi' ? 'Revenir au montant' : 'Revenir au choix du paiement'}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M15 5l-7 7 7 7" />
            </svg>
          </button>
          <span className="om__marque">
            <img src={logoOrangeMoney} alt="Orange Money" decoding="async" />
          </span>
          <span className="om__bandeau-titre">
            Paiement Orange Money <span className="om__bandeau-hope">· Don à HOPE</span>
          </span>
          <span className="om__hope" title="HOPE">
            <HopeLogo compact />
          </span>
        </div>
      </header>

      <main className="om__page">
        <h1 className="om__titre" ref={titre} tabIndex={-1}>
          {pret ? titres[temps] : 'Paiement Orange Money'}
        </h1>

        <ol className="om__chevrons" aria-label="Étapes du paiement">
          {CHEVRONS.map((nom, i) => (
            <li
              key={nom}
              className={`om__chevron${i === indice ? ' om__chevron--actif' : ''}${i < indice ? ' om__chevron--fait' : ''}`}
              aria-current={i === indice ? 'step' : undefined}
            >
              <span>
                {i + 1}.<span className="om__chevron-nom"> {nom}</span>
              </span>
            </li>
          ))}
        </ol>

        {erreurChargement && (
          <p className="om__alerte" role="alert">
            {erreurChargement}
          </p>
        )}
        {!profil && !erreurChargement && (
          <p className="om__attente" role="status">
            <span className="om__rotation" aria-hidden="true" />
            Préparation du paiement…
          </p>
        )}

        {profil && compte && !compte.disponible && (
          <section className="om__temps">
            <p className="om__texte">
              Le numéro Orange Money de HOPE n’est pas encore configuré. Vous pourrez donner depuis votre espace
              dès qu’il le sera, ou choisir un autre moyen de paiement.
            </p>
            <div className="om__actions">
              <button type="button" className="om__bouton" onClick={() => quitter(4)}>
                Choisir un autre moyen
              </button>
              <button type="button" className="om__lien" onClick={() => quitter()}>
                Continuer sans payer
              </button>
            </div>
          </section>
        )}

        {/* ---------- 1. Le montant ---------- */}
        {pret && temps === 'montant' && (
          <section className="om__temps" key="montant">
            <form className="om__formulaire" onSubmit={validerMontant} noValidate aria-label="Montant du don">
              <label className="om__champ" htmlFor="om-montant">
                <span className="om__libelle">Montant du don</span>
                <span className={`om__saisie-groupe${soumis && erreurs.montant ? ' om__saisie-groupe--erreur' : ''}`}>
                  <input
                    id="om-montant"
                    className="om__saisie om__saisie--montant"
                    inputMode="numeric"
                    autoComplete="off"
                    placeholder="0"
                    value={somme === null ? '' : fmt.nombre(somme)}
                    onChange={(e) => setMontant(e.target.value)}
                    aria-invalid={soumis && Boolean(erreurs.montant)}
                    aria-describedby="om-montant-erreur"
                  />
                  <span className="om__suffixe" aria-hidden="true">
                    Ar
                  </span>
                </span>
                <span className="om__erreur" id="om-montant-erreur" aria-live="polite">
                  {soumis ? erreurs.montant : ''}
                </span>
              </label>

              <div className="om__rapides" role="group" aria-label="Montants proposés">
                {MONTANTS_RAPIDES.map((valeur) => (
                  <button
                    key={valeur}
                    type="button"
                    className={`om__rapide${somme === valeur ? ' om__rapide--choisi' : ''}`}
                    aria-pressed={somme === valeur}
                    onClick={() => setMontant(String(valeur))}
                  >
                    {fmt.nombre(valeur)}
                  </button>
                ))}
              </div>

              <label className="om__champ" htmlFor="om-numero">
                <span className="om__libelle">Votre numéro Orange Money</span>
                <span className={`om__saisie-groupe${soumis && erreurs.numero ? ' om__saisie-groupe--erreur' : ''}`}>
                  <span className="om__prefixe" aria-hidden="true">
                    +261
                  </span>
                  <input
                    id="om-numero"
                    className="om__saisie"
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel-national"
                    placeholder="32 12 345 67"
                    value={numero}
                    maxLength={9}
                    onChange={(e) => setNumero(e.target.value.replace(/\D/g, '').replace(/^0/, '').slice(0, 9))}
                    aria-invalid={soumis && Boolean(erreurs.numero)}
                    aria-describedby="om-numero-erreur"
                  />
                </span>
                <span className="om__erreur" id="om-numero-erreur" aria-live="polite">
                  {soumis ? erreurs.numero : ''}
                </span>
              </label>

              <dl className="om__rappel">
                <div>
                  <dt>Pour</dt>
                  <dd>{beneficiaire}</dd>
                </div>
                <div>
                  <dt>Bénéficiaire</dt>
                  <dd>{compte.titulaire}</dd>
                </div>
              </dl>

              <div className="om__actions">
                <button type="submit" className="om__bouton">
                  Suivant
                </button>
                <button type="button" className="om__lien" onClick={() => quitter()}>
                  Payer plus tard
                </button>
              </div>
            </form>
          </section>
        )}

        {/* ---------- 2. L'envoi ---------- */}
        {pret && temps === 'envoi' && (
          <section className="om__temps" key="envoi">
            <div className="om__envoi">
              <ol className="om__consignes">
                {/* Le texte dans un seul span : la puce carree est l'autre
                    element du flex, et le gras reste dans la phrase. */}
                <li style={{ '--rang': 0 }}>
                  <span>
                    Composez <strong>#144#</strong>
                    <span className="om__consigne-detail"> ou ouvrez l’application Orange Money</span>
                  </span>
                </li>
                <li style={{ '--rang': 1 }}>
                  <span>
                    Transférez <strong>{fmt.montant(somme)}</strong> au numéro de HOPE
                  </span>
                </li>
                <li style={{ '--rang': 2 }}>
                  <span>
                    Validez avec votre code secret
                    <span className="om__consigne-detail">, puis gardez le SMS</span>
                  </span>
                </li>
              </ol>

              <section className="om__beneficiaire" aria-labelledby="om-beneficiaire-titre">
                <h2 className="om__section-titre" id="om-beneficiaire-titre">
                  Bénéficiaire
                  {/* Sur telephone, le nom rejoint le titre : une ligne de moins. */}
                  <span className="om__section-nom"> · {compte.titulaire}</span>
                </h2>
                <Ligne libelle="Nom" valeur={compte.titulaire} className="om__ligne--nom" />
                <Ligne
                  libelle="Numéro de téléphone"
                  valeur={numeroLisible(compte.numero)}
                  aCopier={compte.numero}
                />
                <Ligne libelle="Montant à envoyer" valeur={fmt.montant(somme)} aCopier={String(somme)} />
              </section>

              <a className="om__composer" href="tel:%23144%23">
                Composer #144# sur ce téléphone
              </a>

              <form className="om__formulaire" onSubmit={declarer} noValidate aria-label="Numéro de transaction">
                <label className="om__champ" htmlFor="om-reference">
                  <span className="om__libelle">N° de transaction reçu par SMS</span>
                  <span
                    className={`om__saisie-groupe${soumis && erreurs.reference ? ' om__saisie-groupe--erreur' : ''}`}
                  >
                    <input
                      id="om-reference"
                      className="om__saisie om__saisie--reference"
                      autoComplete="off"
                      autoCapitalize="characters"
                      spellCheck={false}
                      placeholder="Ex. MP241112.0547.A92041"
                      value={reference}
                      maxLength={40}
                      onChange={(e) => setReference(e.target.value)}
                      disabled={envoi}
                      aria-invalid={soumis && Boolean(erreurs.reference)}
                      aria-describedby="om-reference-erreur"
                    />
                  </span>
                  <span className="om__erreur" id="om-reference-erreur" aria-live="polite">
                    {soumis ? erreurs.reference : ''}
                  </span>
                </label>

                <div className="om__actions">
                  <button type="submit" className="om__bouton" disabled={envoi} aria-busy={envoi}>
                    {envoi ? (
                      <>
                        <span className="om__rotation om__rotation--bouton" aria-hidden="true" />
                        Enregistrement…
                      </>
                    ) : (
                      'Valider'
                    )}
                  </button>
                  <button type="button" className="om__lien" onClick={() => quitter()} disabled={envoi}>
                    Payer plus tard
                  </button>
                </div>
                <p className="om__erreur om__erreur--centre" role="alert">
                  {refus}
                </p>
              </form>
            </div>
          </section>
        )}

        {/* ---------- 3. Le recu ---------- */}
        {profil && temps === 'merci' && don && (
          <section className="om__temps om__temps--recu" key="merci">
            <p className="om__merci">
              <span className="om__merci-coche" aria-hidden="true">
                <svg viewBox="0 0 24 24">
                  <path d="M6 12.5l4 4 8-9" />
                </svg>
              </span>
              Merci ! Votre don est enregistré. L’équipe HOPE le confirme dès réception.
            </p>

            {/* La fente : le recu en sort, comme d'une imprimante. */}
            <div className="om__fente" aria-hidden="true" />
            <div className="om__sortie">
              <article className="om__recu" aria-labelledby="om-recu-titre">
                <header className="om__recu-entete">
                  <img src={logoOrangeMoney} alt="Orange Money" decoding="async" />
                  <span className="om__recu-hope">
                    <HopeLogo />
                  </span>
                </header>

                <h2 className="om__recu-titre" id="om-recu-titre">
                  Reçu de don
                </h2>
                <p className="om__recu-date">Date d’édition : {edition ? horodatage(edition) : '—'}</p>

                <section className="om__recu-section">
                  <h3>Nature de la transaction</h3>
                  <p>Don à HOPE, transfert Orange Money</p>
                </section>

                <section className="om__recu-section">
                  <h3>Expéditeur</h3>
                  <Ligne libelle="Numéro de téléphone" valeur={numeroLisible(`0${numero}`)} />
                </section>

                <section className="om__recu-section">
                  <h3>Transaction</h3>
                  <p className="om__recu-numero">N° {reference.trim().toUpperCase()}</p>
                  <Ligne libelle="Montant envoyé" valeur={fmt.montant(don.montant ?? somme)} />
                </section>

                <section className="om__recu-section">
                  <h3>Bénéficiaire</h3>
                  <Ligne libelle="Nom" valeur={compte.titulaire} />
                  <Ligne libelle="Numéro de téléphone" valeur={numeroLisible(compte.numero)} />
                </section>

                <section className="om__recu-section">
                  <h3>Don HOPE</h3>
                  <Ligne libelle="Référence" valeur={don.reference} />
                  <Ligne libelle="Pour" valeur={beneficiaire} />
                  <Ligne
                    libelle="Statut"
                    valeur={
                      <span className="om__statut">
                        <span className="om__statut-point" aria-hidden="true" />
                        En attente de confirmation
                      </span>
                    }
                  />
                </section>
              </article>
            </div>

            <div className="om__actions om__actions--recu">
              <button type="button" className="om__bouton" onClick={() => quitter()}>
                Continuer mon inscription
              </button>
              <button type="button" className="om__bouton om__bouton--contour" onClick={() => window.print()}>
                Imprimer le reçu
              </button>
            </div>
          </section>
        )}

        <p className="om__pied">HOPE ne vous demandera jamais votre code secret Orange Money.</p>
      </main>
    </div>
  );
}

/**
 * Une ligne de recu : le libelle a gauche, la valeur a droite. Avec
 * aCopier, un bouton "Copier" la suit.
 */
function Ligne({ libelle, valeur, aCopier, className = '' }) {
  const [copie, setCopie] = useState(false);

  useEffect(() => {
    if (!copie) return undefined;
    const minuterie = setTimeout(() => setCopie(false), 1800);
    return () => clearTimeout(minuterie);
  }, [copie]);

  async function copier() {
    try {
      await navigator.clipboard.writeText(aCopier);
      setCopie(true);
    } catch {
      /* le texte reste lisible et selectionnable */
    }
  }

  return (
    <div className={`om__ligne ${className}`.trim()}>
      <span className="om__ligne-libelle">{libelle}</span>
      <span className="om__ligne-valeur">{valeur}</span>
      {aCopier && (
        <button
          type="button"
          className={`om__copier${copie ? ' om__copier--fait' : ''}`}
          onClick={copier}
          aria-label={`Copier : ${libelle}`}
        >
          {copie ? 'Copié' : 'Copier'}
        </button>
      )}
      {aCopier && (
        <span className="sr-only" aria-live="polite">
          {copie ? `${libelle} copié` : ''}
        </span>
      )}
    </div>
  );
}
