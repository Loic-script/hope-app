import { useEffect, useRef, useState } from 'react';

import HopeLogo from '../../components/HopeLogo.jsx';
import LogosCartes, { IconeCvc } from '../../components/paiement/LogosCartes.jsx';
import { montantInitial, usePromesseDon } from '../../hooks/usePromesseDon.js';
import { formaterExpiration, formaterNumero, reseauDe, resumeCarte, verifierCarte } from '../../utils/carteBancaire.js';
import * as fmt from '../../utils/format.js';
import { PAYS, PAYS_PAR_DEFAUT } from '../../utils/pays.js';

/** Les devises d'un don, et les montants proposes dans chacune. */
const DEVISES = [
  { code: 'MGA', symbole: 'Ar', rapides: [10000, 25000, 50000, 100000], minimum: 1000 },
  { code: 'EUR', symbole: '€', rapides: [10, 25, 50, 100], minimum: 1 },
  { code: 'USD', symbole: '$', rapides: [10, 25, 50, 100], minimum: 1 },
];

/** Un montant saisi "25 000" -> 25000 ; "12,50" -> 12.5. */
function montantSaisi(texte) {
  const propre = String(texte ?? '').replace(/[\s  ]/g, '').replace(',', '.');
  if (!/^\d+(\.\d{0,2})?$/.test(propre)) return null;
  const valeur = Number(propre);
  return valeur > 0 ? valeur : null;
}

/**
 * Le don par carte bancaire, ouvert depuis l'etape 4 du parcours.
 *
 * La mise en page des caisses en ligne qu'on connait : a gauche, sur
 * fond sombre, ce que l'on paie -- le montant en grand, la devise, le
 * detail ; a droite, sur fond clair, les coordonnees et le moyen de
 * paiement, champs groupes a bords partages.
 *
 * Ce que la page ne fait PAS, et ne fera jamais : recevoir un numero de
 * carte. Un numero, une date d'expiration, un cryptogramme ne se tapent
 * que chez un prestataire de paiement certifie ; ils ne passent pas par
 * le serveur de HOPE et ne dorment dans aucune base. Ici, le donateur
 * enregistre sa promesse et ses coordonnees de facturation ; l'equipe
 * lui envoie un lien de paiement securise a son adresse e-mail.
 */
export default function PaiementCarte() {
  const {
    profil,
    personne,
    beneficiaire,
    email,
    erreurChargement,
    don,
    envoi,
    refus,
    setRefus,
    promettre,
    quitter,
    montantPrevu,
    devisePrevue,
    libelleSuite,
    libellePlusTard,
  } = usePromesseDon('carte_bancaire');

  const [devise, setDevise] = useState('MGA');
  const [montant, setMontant] = useState('');
  const [titulaire, setTitulaire] = useState('');
  const [adresse, setAdresse] = useState({ pays: PAYS_PAR_DEFAUT, ligne: '', ligne2: '', codePostal: '', ville: '' });
  // La carte : dans cet etat du navigateur, et nulle part ailleurs. Jamais
  // envoyee au serveur de HOPE (voir utils/carteBancaire.js).
  const [numero, setNumero] = useState('');
  const [expiration, setExpiration] = useState('');
  const [cvc, setCvc] = useState('');
  const [details, setDetails] = useState(false);
  const [soumis, setSoumis] = useState(false);
  const titre = useRef(null);

  // Une fois charge : la devise et le montant du don prepare (sinon la
  // devise du profil), le titulaire et l'adresse de facturation.
  useEffect(() => {
    if (!profil) return;
    const choisie = [devisePrevue, personne.devise].find((d) => DEVISES.some((x) => x.code === d)) ?? 'MGA';
    setDevise(choisie);
    setMontant(montantInitial(montantPrevu, devisePrevue, choisie));
    setTitulaire([personne.prenom, personne.nom].filter(Boolean).join(' '));
    const pays = String(personne.pays || PAYS_PAR_DEFAUT).toUpperCase();
    // Un pays en toutes lettres (bailleur) : Madagascar par defaut.
    const code = /^[A-Z]{2}$/.test(pays) ? pays : PAYS_PAR_DEFAUT;
    setAdresse({ pays: code, ligne: personne.adresse ?? '', ligne2: '', codePostal: '', ville: personne.ville ?? '' });
    // Seulement au chargement.
  }, [profil]);

  useEffect(() => {
    if (don) titre.current?.focus();
  }, [don]);

  const reglage = DEVISES.find((d) => d.code === devise) ?? DEVISES[0];
  const somme = montantSaisi(montant);

  const erreurs = {
    montant:
      somme === null
        ? 'Indiquez le montant de votre don.'
        : somme < reglage.minimum
          ? `Au moins ${fmt.montant(reglage.minimum, devise)}.`
          : '',
    ...verifierCarte({ numero, expiration, cvc }),
    titulaire: titulaire.trim() ? '' : 'Indiquez le nom inscrit sur la carte.',
    adresse: adresse.ligne.trim() && adresse.ville.trim() ? '' : 'Complétez l’adresse de facturation.',
  };
  const erreurCarte = erreurs.numero || erreurs.expiration || erreurs.cvc;
  const valide = !erreurs.montant && !erreurCarte && !erreurs.titulaire && !erreurs.adresse;
  const reseau = reseauDe(numero);

  function changerDevise(code) {
    setDevise(code);
    setMontant('');
  }

  async function soumettre(evenement) {
    evenement.preventDefault();
    setSoumis(true);
    setRefus('');
    if (!valide) {
      const premier = erreurs.montant
        ? '#carte-montant'
        : erreurs.numero
          ? '#carte-numero'
          : erreurs.expiration
            ? '#carte-expiration'
            : erreurs.cvc
              ? '#carte-cvc'
              : erreurs.titulaire
                ? '#carte-titulaire'
                : '#carte-adresse';
      requestAnimationFrame(() => document.querySelector(premier)?.focus());
      return;
    }

    const cree = await promettre({
      montant: somme,
      devise,
      facturation: {
        titulaire: titulaire.trim(),
        adresse: [adresse.ligne.trim(), adresse.ligne2.trim()].filter(Boolean).join(', '),
        codePostal: adresse.codePostal.trim(),
        ville: adresse.ville.trim(),
        pays: adresse.pays,
        // Le reseau et les 4 derniers chiffres : rien d'autre ne part.
        carte: resumeCarte(numero),
      },
    });
    // La carte n'a plus rien a faire dans la page.
    if (cree) {
      setNumero('');
      setExpiration('');
      setCvc('');
    }
  }


  const total = somme ? fmt.montant(somme, devise) : fmt.montant(0, devise);

  return (
    <div className="carte">
      {/* ---------- Ce que l'on paie ---------- */}
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
                disabled={envoi || Boolean(don)}
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

      {/* ---------- Le paiement ---------- */}
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

          {profil && !don && (
            <form className="carte__formulaire" onSubmit={soumettre} noValidate aria-label="Paiement par carte">
              <h1 className="sr-only">Don par carte bancaire</h1>

              <label className="carte__champ" htmlFor="carte-montant">
                <span className="carte__rubrique">Montant du don</span>
                <span className={`carte__montant${soumis && erreurs.montant ? ' carte__montant--erreur' : ''}`}>
                  <input
                    id="carte-montant"
                    inputMode="decimal"
                    autoComplete="off"
                    placeholder="0"
                    value={montant}
                    onChange={(e) => setMontant(e.target.value.replace(/[^\d\s,.]/g, ''))}
                    disabled={envoi}
                    aria-invalid={soumis && Boolean(erreurs.montant)}
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
                {soumis ? erreurs.montant : ''}
              </p>

              <h2 className="carte__rubrique carte__rubrique--section">Coordonnées</h2>
              <div className="carte__gris">
                <span className="carte__gris-libelle">E-mail</span>
                <span className="carte__gris-valeur">{email}</span>
              </div>

              <h2 className="carte__rubrique carte__rubrique--section">Moyen de paiement</h2>
              <div className="carte__boite">
                <div className="carte__boite-tete">
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <rect x="2.5" y="5" width="19" height="14" rx="2" />
                    <path d="M2.5 9.5h19" />
                  </svg>
                  <span>Carte</span>
                </div>

                {/* Les informations de la carte : numero, puis expiration et CVC. */}
                <div className="carte__champ carte__champ--boite">
                  <span className="carte__etiquette" id="carte-infos-titre">
                    Informations de la carte
                  </span>
                  <div
                    className={`carte__groupe carte__groupe--carte${soumis && erreurCarte ? ' carte__groupe--erreur' : ''}`}
                    role="group"
                    aria-labelledby="carte-infos-titre"
                  >
                    <span className="carte__numero">
                      <input
                        id="carte-numero"
                        aria-label="Numéro de carte"
                        inputMode="numeric"
                        autoComplete="cc-number"
                        placeholder="1234 1234 1234 1234"
                        value={numero}
                        onChange={(e) => setNumero(formaterNumero(e.target.value))}
                        disabled={envoi}
                        aria-invalid={soumis && Boolean(erreurs.numero)}
                        spellCheck={false}
                      />
                      <LogosCartes actif={reseau?.cle ?? null} />
                    </span>
                    <span className="carte__groupe-rang">
                      <input
                        id="carte-expiration"
                        aria-label="Date d’expiration (MM / AA)"
                        inputMode="numeric"
                        autoComplete="cc-exp"
                        placeholder="MM / AA"
                        value={expiration}
                        onChange={(e) => setExpiration(formaterExpiration(e.target.value, expiration))}
                        disabled={envoi}
                        aria-invalid={soumis && Boolean(erreurs.expiration)}
                      />
                      <span className="carte__cvc">
                        <input
                          id="carte-cvc"
                          aria-label="Cryptogramme (CVC)"
                          inputMode="numeric"
                          autoComplete="cc-csc"
                          placeholder="CVC"
                          value={cvc}
                          maxLength={reseau?.cvc ?? 4}
                          onChange={(e) => setCvc(e.target.value.replace(/\D/g, '').slice(0, reseau?.cvc ?? 4))}
                          disabled={envoi}
                          aria-invalid={soumis && Boolean(erreurs.cvc)}
                        />
                        <IconeCvc />
                      </span>
                    </span>
                  </div>
                  {soumis && erreurCarte && <span className="carte__erreur">{erreurCarte}</span>}
                </div>

                <label className="carte__champ carte__champ--boite" htmlFor="carte-titulaire">
                  <span className="carte__etiquette">Nom du titulaire de la carte</span>
                  <input
                    id="carte-titulaire"
                    className={`carte__saisie${soumis && erreurs.titulaire ? ' carte__saisie--erreur' : ''}`}
                    autoComplete="cc-name"
                    placeholder="Nom complet"
                    value={titulaire}
                    maxLength={120}
                    onChange={(e) => setTitulaire(e.target.value)}
                    disabled={envoi}
                    aria-invalid={soumis && Boolean(erreurs.titulaire)}
                  />
                  {soumis && erreurs.titulaire && <span className="carte__erreur">{erreurs.titulaire}</span>}
                </label>

                <div className="carte__champ carte__champ--boite">
                  <span className="carte__etiquette" id="carte-adresse-titre">
                    Adresse de facturation
                  </span>
                  <div
                    className={`carte__groupe${soumis && erreurs.adresse ? ' carte__groupe--erreur' : ''}`}
                    role="group"
                    aria-labelledby="carte-adresse-titre"
                  >
                    <span className="carte__groupe-select">
                      <select
                        aria-label="Pays"
                        value={adresse.pays}
                        onChange={(e) => setAdresse((a) => ({ ...a, pays: e.target.value }))}
                        disabled={envoi}
                        autoComplete="country"
                      >
                        {PAYS.map((p) => (
                          <option key={p.code} value={p.code}>
                            {p.nom}
                          </option>
                        ))}
                      </select>
                    </span>
                    <input
                      id="carte-adresse"
                      aria-label="Ligne d’adresse n°1"
                      placeholder="Ligne d’adresse n°1"
                      autoComplete="address-line1"
                      value={adresse.ligne}
                      maxLength={200}
                      onChange={(e) => setAdresse((a) => ({ ...a, ligne: e.target.value }))}
                      disabled={envoi}
                    />
                    <input
                      aria-label="Ligne d’adresse n°2"
                      placeholder="Ligne d’adresse n°2"
                      autoComplete="address-line2"
                      value={adresse.ligne2}
                      maxLength={50}
                      onChange={(e) => setAdresse((a) => ({ ...a, ligne2: e.target.value }))}
                      disabled={envoi}
                    />
                    <span className="carte__groupe-rang">
                      <input
                        aria-label="Code postal"
                        placeholder="Code postal"
                        autoComplete="postal-code"
                        value={adresse.codePostal}
                        maxLength={20}
                        onChange={(e) => setAdresse((a) => ({ ...a, codePostal: e.target.value }))}
                        disabled={envoi}
                      />
                      <input
                        aria-label="Ville"
                        placeholder="Ville"
                        autoComplete="address-level2"
                        value={adresse.ville}
                        maxLength={120}
                        onChange={(e) => setAdresse((a) => ({ ...a, ville: e.target.value }))}
                        disabled={envoi}
                      />
                    </span>
                  </div>
                  {soumis && erreurs.adresse && <span className="carte__erreur">{erreurs.adresse}</span>}
                </div>
              </div>

              {/* Ce qui arrive a la carte, dit sans detour. */}
              <p className="carte__lien-securise">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <rect x="5" y="10.5" width="14" height="10" rx="2" />
                  <path d="M8.5 10.5V8a3.5 3.5 0 017 0v2.5" />
                </svg>
                <span>
                  Votre carte n’est pas débitée sur cette page, et son numéro n’est ni envoyé ni conservé par HOPE.
                  L’équipe vous envoie à <strong>{email}</strong> un lien de paiement sécurisé pour régler.
                </span>
              </p>

              <button type="submit" className="carte__payer" disabled={envoi} aria-busy={envoi}>
                {envoi ? (
                  <>
                    <span className="carte__rotation carte__rotation--clair" aria-hidden="true" />
                    Enregistrement…
                  </>
                ) : (
                  <>
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <rect x="5" y="10.5" width="14" height="10" rx="2" />
                      <path d="M8.5 10.5V8a3.5 3.5 0 017 0v2.5" />
                    </svg>
                    {somme && !erreurs.montant ? `Donner ${fmt.montant(somme, devise)}` : 'Faire mon don'}
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

          {/* ---------- Merci ---------- */}
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
                Votre promesse de <strong>{fmt.montant(don.montant ?? somme, don.devise ?? devise)}</strong> est
                enregistrée. L’équipe HOPE vous envoie un lien de paiement sécurisé à <strong>{email}</strong>.
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
                      Lien de paiement à venir
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
        </div>
      </main>
    </div>
  );
}
