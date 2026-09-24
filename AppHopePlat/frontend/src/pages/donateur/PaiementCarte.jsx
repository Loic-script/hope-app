import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';

import HopeLogo from '../../components/HopeLogo.jsx';
import logoCartes from '../../assets/paiement/cartes-bancaires.webp';
import { PARCOURS } from '../../hooks/usePaiementMobile.js';
import { messageErreur } from '../../services/api.js';
import * as donateurService from '../../services/donateur.service.js';
import * as fmt from '../../utils/format.js';
import { PAYS, PAYS_PAR_DEFAUT, nomDuPays } from '../../utils/pays.js';

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
  const navigate = useNavigate();
  const { rafraichir } = useOutletContext() ?? {};

  const [profil, setProfil] = useState(null);
  const [projets, setProjets] = useState([]);
  const [erreurChargement, setErreurChargement] = useState('');

  const [devise, setDevise] = useState('MGA');
  const [montant, setMontant] = useState('');
  const [titulaire, setTitulaire] = useState('');
  const [adresse, setAdresse] = useState({ pays: PAYS_PAR_DEFAUT, ligne: '', codePostal: '', ville: '' });
  const [adresseOuverte, setAdresseOuverte] = useState(false);
  const [details, setDetails] = useState(false);
  const [soumis, setSoumis] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const [refus, setRefus] = useState('');
  const [don, setDon] = useState(null);
  const titre = useRef(null);

  useEffect(() => {
    let annule = false;
    Promise.all([donateurService.recupererProfil(), donateurService.listerProjets()])
      .then(([lu, liste]) => {
        if (annule) return;
        if (lu.paiement?.mode !== 'carte_bancaire' || lu.etapeSuivante < 5) {
          navigate(PARCOURS, { replace: true });
          return;
        }
        setProfil(lu);
        setProjets(liste?.items ?? []);
        // La devise du profil, si c'en est une qu'on sait recevoir.
        const preferee = lu.profil?.devise;
        if (DEVISES.some((d) => d.code === preferee)) setDevise(preferee);
        const info = lu.informations ?? {};
        setTitulaire([info.prenom, info.nom].filter(Boolean).join(' '));
        const pays = String(info.pays || PAYS_PAR_DEFAUT).toUpperCase();
        setAdresse({ pays, ligne: info.adresse ?? '', codePostal: '', ville: info.ville ?? '' });
        // Sans adresse au profil, les champs s'ouvrent d'emblee.
        setAdresseOuverte(!info.adresse || !info.ville);
      })
      .catch((echec) => {
        if (!annule) setErreurChargement(messageErreur(echec, 'La page de paiement n’a pas pu être préparée.'));
      });
    return () => {
      annule = true;
    };
  }, [navigate]);

  useEffect(() => {
    if (don) titre.current?.focus();
  }, [don]);

  const reglage = DEVISES.find((d) => d.code === devise) ?? DEVISES[0];
  const somme = montantSaisi(montant);
  const email = profil?.compte?.email ?? '';
  const beneficiaire = useMemo(() => {
    if (!profil) return '';
    if (profil.don?.affectation !== 'PROJECT') return 'Les projets de HOPE';
    const projet = projets.find((p) => Number(p.id) === Number(profil.don?.projetId));
    return projet?.nom ?? 'Le projet choisi';
  }, [profil, projets]);

  const erreurs = {
    montant:
      somme === null
        ? 'Indiquez le montant de votre don.'
        : somme < reglage.minimum
          ? `Au moins ${fmt.montant(reglage.minimum, devise)}.`
          : '',
    titulaire: titulaire.trim() ? '' : 'Indiquez le nom inscrit sur la carte.',
    adresse: adresse.ligne.trim() && adresse.ville.trim() ? '' : 'Complétez l’adresse de facturation.',
  };
  const valide = !erreurs.montant && !erreurs.titulaire && !erreurs.adresse;

  function changerDevise(code) {
    setDevise(code);
    setMontant('');
  }

  async function soumettre(evenement) {
    evenement.preventDefault();
    setSoumis(true);
    setRefus('');
    if (erreurs.adresse) setAdresseOuverte(true);
    if (!valide) {
      const premier = erreurs.montant ? '#carte-montant' : erreurs.titulaire ? '#carte-titulaire' : '#carte-adresse';
      requestAnimationFrame(() => document.querySelector(premier)?.focus());
      return;
    }

    setEnvoi(true);
    try {
      const reponse = await donateurService.faireUnDon({
        affectation: profil.don?.affectation || 'HOPE',
        projetId: profil.don?.affectation === 'PROJECT' ? profil.don.projetId : undefined,
        montant: String(somme),
        devise,
        mode: 'carte_bancaire',
        frequence: 'ONE_TIME',
        facturation: {
          titulaire: titulaire.trim(),
          adresse: adresse.ligne.trim(),
          codePostal: adresse.codePostal.trim(),
          ville: adresse.ville.trim(),
          pays: adresse.pays,
        },
      });
      setDon(reponse.don);
      await rafraichir?.();
    } catch (echec) {
      setRefus(messageErreur(echec, 'Votre don n’a pas pu être enregistré. Réessayez.'));
    } finally {
      setEnvoi(false);
    }
  }

  function quitter(etape) {
    navigate(PARCOURS, { replace: true, state: etape ? { etape } : undefined });
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
                  <img src={logoCartes} alt="Visa, Mastercard et autres cartes acceptées" decoding="async" />
                </div>

                {/* Pas de champ de carte : la raison, dite au donateur. */}
                <p className="carte__lien-securise">
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <rect x="5" y="10.5" width="14" height="10" rx="2" />
                    <path d="M8.5 10.5V8a3.5 3.5 0 017 0v2.5" />
                  </svg>
                  <span>
                    Vous recevrez à <strong>{email}</strong> un lien de paiement sécurisé
                    <span className="carte__long"> : c’est là que vous saisirez votre carte</span>. HOPE ne voit ni ne
                    conserve jamais son numéro.
                  </span>
                </p>

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
                  {adresseOuverte ? (
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
                        aria-label="Adresse"
                        placeholder="Adresse"
                        autoComplete="address-line1"
                        value={adresse.ligne}
                        maxLength={255}
                        onChange={(e) => setAdresse((a) => ({ ...a, ligne: e.target.value }))}
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
                  ) : (
                    // L'adresse du profil, resumee : on ne la retape pas.
                    <div className="carte__adresse-resumee">
                      <span>
                        {[adresse.ligne, adresse.ville, nomDuPays(adresse.pays)].filter(Boolean).join(', ')}
                      </span>
                      <button
                        type="button"
                        className="carte__modifier"
                        onClick={() => {
                          setAdresseOuverte(true);
                          requestAnimationFrame(() => document.querySelector('#carte-adresse')?.focus());
                        }}
                        disabled={envoi}
                      >
                        Modifier
                      </button>
                    </div>
                  )}
                  {soumis && erreurs.adresse && <span className="carte__erreur">{erreurs.adresse}</span>}
                </div>
              </div>

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
                Payer plus tard
              </button>
              <p className="carte__erreur carte__erreur--centre" role="alert">
                {refus}
              </p>

              <p className="carte__pied">
                Aucun montant n’est débité sur cette page. Votre carte se règle uniquement depuis le lien sécurisé.
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
                Continuer mon inscription
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
