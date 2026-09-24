import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';

import HopeLogo from '../../components/HopeLogo.jsx';
import logoMvola from '../../assets/paiement/mvola.webp';
import { messageErreur } from '../../services/api.js';
import * as donateurService from '../../services/donateur.service.js';
import * as fmt from '../../utils/format.js';

/** Le parcours d'accueil, ou l'on revient une fois le paiement fait. */
const PARCOURS = '/donateur/completer-profil';

/** Les montants proposes d'un geste, en ariary. */
const MONTANTS_RAPIDES = [5000, 10000, 25000, 50000, 100000];
const MONTANT_MINIMUM = 1000;
const MONTANT_MAXIMUM = 50000000;

/** Les trois temps de la page. */
const TEMPS = ['montant', 'envoi', 'merci'];

/** "0341234567" -> "034 12 345 67", comme on le lit sur un SMS MVola. */
function numeroLisible(numero) {
  const chiffres = String(numero ?? '').replace(/\D/g, '');
  const national = chiffres.startsWith('261') ? `0${chiffres.slice(3)}` : chiffres;
  if (national.length !== 10) return national;
  return `${national.slice(0, 3)} ${national.slice(3, 5)} ${national.slice(5, 8)} ${national.slice(8)}`;
}

/** Le numero du profil, s'il est MVola : "+261341234567" -> "341234567". */
function numeroMvolaDuProfil(telephone) {
  const national = String(telephone ?? '').replace(/\D/g, '').replace(/^261/, '').replace(/^0/, '');
  return /^3[48]\d{7}$/.test(national) ? national : '';
}

/** Un montant saisi "25 000" -> 25000, ou null. */
function montantSaisi(texte) {
  const chiffres = String(texte ?? '').replace(/\D/g, '');
  return chiffres ? Number.parseInt(chiffres, 10) : null;
}

/**
 * Le paiement par MVola, ouvert depuis l'etape 4 du parcours d'accueil.
 *
 * Trois temps, comme dans l'application MVola que le donateur a dans la
 * poche -- jaune, noir, des pastilles rondes :
 *
 *   1. le montant, et le numero MVola qui paiera ;
 *   2. l'envoi : le numero de HOPE a composer depuis #111#, puis la
 *      reference que MVola renvoie par SMS ;
 *   3. le merci, et la suite du parcours.
 *
 * Ce que la page ne fait PAS : debiter le telephone. L'API marchande de
 * MVola n'est pas encore branchee ; le donateur envoie lui-meme, et
 * l'equipe rapproche la reference de son releve avant de confirmer. La
 * page le dit sans detour : rien ne passe pour paye qui ne l'est pas.
 *
 * Aucun code secret n'est jamais demande ici : il ne se tape que dans
 * MVola.
 */
export default function PaiementMvola() {
  const navigate = useNavigate();
  const { rafraichir } = useOutletContext() ?? {};

  const [profil, setProfil] = useState(null);
  const [compte, setCompte] = useState(null);
  const [projets, setProjets] = useState([]);
  const [erreurChargement, setErreurChargement] = useState('');

  const [temps, setTemps] = useState('montant');
  const [montant, setMontant] = useState('');
  const [numero, setNumero] = useState('');
  const [reference, setReference] = useState('');
  const [soumis, setSoumis] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const [refus, setRefus] = useState('');
  const [don, setDon] = useState(null);
  const titre = useRef(null);

  useEffect(() => {
    let annule = false;
    Promise.all([donateurService.recupererProfil(), donateurService.compteMvola(), donateurService.listerProjets()])
      .then(([lu, mvola, liste]) => {
        if (annule) return;
        // La page n'a de sens qu'apres le choix de MVola a l'etape 4.
        if (lu.paiement?.mode !== 'mvola' || lu.etapeSuivante < 5) {
          navigate(PARCOURS, { replace: true });
          return;
        }
        setProfil(lu);
        setCompte(mvola);
        setProjets(liste?.items ?? []);
        setNumero(numeroMvolaDuProfil(lu.informations?.telephone));
      })
      .catch((echec) => {
        if (!annule) setErreurChargement(messageErreur(echec, 'La page de paiement n’a pas pu être préparée.'));
      });
    return () => {
      annule = true;
    };
  }, [navigate]);

  // A chaque temps, le titre reprend le focus : un lecteur d'ecran
  // annonce ou l'on est, le clavier repart du haut.
  useEffect(() => {
    if (profil) titre.current?.focus();
  }, [temps, profil]);

  const somme = montantSaisi(montant);
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
        : somme < MONTANT_MINIMUM
          ? `Au moins ${fmt.montant(MONTANT_MINIMUM)}.`
          : somme > MONTANT_MAXIMUM
            ? `Au plus ${fmt.montant(MONTANT_MAXIMUM)}.`
            : '',
    numero: /^3[48]\d{7}$/.test(numero) ? '' : 'Un numéro MVola commence par 034 ou 038.',
    reference: /^[A-Za-z0-9][A-Za-z0-9.-]{3,39}$/.test(reference.trim())
      ? ''
      : 'Recopiez la référence reçue par SMS (lettres et chiffres).',
  };

  function allerA(prochain) {
    setSoumis(false);
    setRefus('');
    setTemps(prochain);
    const sobre = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: 0, behavior: sobre ? 'auto' : 'smooth' });
  }

  function validerMontant(evenement) {
    evenement.preventDefault();
    setSoumis(true);
    if (erreurs.montant || erreurs.numero) return;
    allerA('envoi');
  }

  async function declarer(evenement) {
    evenement.preventDefault();
    setSoumis(true);
    setRefus('');
    if (erreurs.reference) return;

    setEnvoi(true);
    try {
      const reponse = await donateurService.faireUnDon({
        affectation: profil.don?.affectation || 'HOPE',
        projetId: profil.don?.affectation === 'PROJECT' ? profil.don.projetId : undefined,
        montant: String(somme),
        devise: 'MGA',
        mode: 'mvola',
        // Le premier don ; la frequence se choisit a l'etape suivante.
        frequence: 'ONE_TIME',
        referencePaiement: reference.trim(),
        numeroPayeur: `+261${numero}`,
      });
      setDon(reponse.don);
      await rafraichir?.();
      allerA('merci');
    } catch (echec) {
      setRefus(messageErreur(echec, 'Votre don n’a pas pu être enregistré. Réessayez.'));
    } finally {
      setEnvoi(false);
    }
  }

  /** Revenir au parcours : a l'etape 4, ou a la suite. */
  function quitter(etape) {
    navigate(PARCOURS, { replace: true, state: etape ? { etape } : undefined });
  }

  const indice = TEMPS.indexOf(temps);

  return (
    <div className="mvola">
      <div className="mvola__halo" aria-hidden="true" />

      <main className="mvola__cadre">
        {/* Sur ordinateur seulement : la colonne jaune qui resume le don. */}
        {profil && compte?.disponible && (
          <Resume
            indice={indice}
            montant={somme}
            beneficiaire={beneficiaire}
            titulaire={compte.titulaire}
            numero={numero}
          />
        )}

        <div className="mvola__principal">
        <header className="mvola__entete">
          <button
            type="button"
            className="mvola__carre"
            onClick={() => (temps === 'envoi' ? allerA('montant') : quitter(4))}
            disabled={envoi || temps === 'merci'}
            aria-label={temps === 'envoi' ? 'Revenir au montant' : 'Revenir au choix du paiement'}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M15 5l-7 7 7 7" />
            </svg>
          </button>
          <div className="mvola__qui">
            <span className="mvola__bonjour">Don à HOPE</span>
            <span className="mvola__nom">
              <HopeLogo className="mvola__hope" compact /> Paiement par MVola
            </span>
          </div>
          <img className="mvola__logo" src={logoMvola} alt="MVola" decoding="async" />
          <span className="mvola__etape-texte" aria-hidden="true">
            Étape {indice + 1} sur 3
          </span>
        </header>

        {/* Ou l'on en est : la pilule noire avance, comme "A ne pas manquer". */}
        <ol className="mvola__pas" aria-label="Étapes du paiement">
          {['Montant', 'Envoi', 'Merci'].map((nom, i) => (
            <li
              key={nom}
              className={`mvola__pas-point${i === indice ? ' mvola__pas-point--actif' : ''}${i < indice ? ' mvola__pas-point--fait' : ''}`}
              aria-current={i === indice ? 'step' : undefined}
            >
              <span className="sr-only">{`${nom}${i < indice ? ' (fait)' : ''}`}</span>
            </li>
          ))}
        </ol>

        {erreurChargement && (
          <p className="mvola__alerte" role="alert">
            {erreurChargement}
          </p>
        )}
        {!profil && !erreurChargement && (
          <div className="mvola__attente" role="status">
            <span className="mvola__rotation" aria-hidden="true" />
            Préparation du paiement…
          </div>
        )}

        {profil && compte && !compte.disponible && (
          <section className="mvola__temps" key="indisponible">
            <h1 className="mvola__titre" ref={titre} tabIndex={-1}>
              MVola n’est pas encore ouvert
            </h1>
            <p className="mvola__texte">
              Le numéro MVola de HOPE n’est pas encore configuré. Vous pourrez donner depuis votre espace
              dès qu’il le sera, ou choisir un autre moyen de paiement.
            </p>
            <div className="mvola__actions">
              <button type="button" className="mvola__bouton" onClick={() => quitter(4)}>
                Choisir un autre moyen
              </button>
              <button type="button" className="mvola__plus-tard" onClick={() => quitter()}>
                Continuer sans payer
              </button>
            </div>
          </section>
        )}

        {/* ---------- 1. Le montant ---------- */}
        {profil && compte?.disponible && temps === 'montant' && (
          <section className="mvola__temps" key="montant">
            <h1 className="mvola__titre" ref={titre} tabIndex={-1}>
              Combien souhaitez-vous donner ?
            </h1>

            <form onSubmit={validerMontant} noValidate aria-label="Montant du don">
              <div className="mvola__solde">
                <label className="mvola__solde-haut" htmlFor="mvola-montant">
                  <span className="mvola__solde-libelle">Montant du don</span>
                  <span className="mvola__solde-valeur">
                    <input
                      id="mvola-montant"
                      className="mvola__montant"
                      inputMode="numeric"
                      autoComplete="off"
                      placeholder="0"
                      value={somme === null ? '' : fmt.nombre(somme)}
                      onChange={(e) => setMontant(e.target.value)}
                      aria-invalid={soumis && Boolean(erreurs.montant)}
                      aria-describedby="mvola-montant-erreur"
                      style={{ '--chiffres': Math.max(1, fmt.nombre(somme ?? 0).length) }}
                    />
                    <span className="mvola__devise">Ar</span>
                  </span>
                </label>
                <div className="mvola__solde-bas">
                  <div>
                    <span className="mvola__solde-petit">Pour</span>
                    <strong className="mvola__solde-fort">{beneficiaire}</strong>
                  </div>
                  <div>
                    <span className="mvola__solde-petit">Vers</span>
                    <strong className="mvola__solde-fort">{compte.titulaire}</strong>
                  </div>
                </div>
              </div>
              <p className="mvola__erreur" id="mvola-montant-erreur" aria-live="polite">
                {soumis ? erreurs.montant : ''}
              </p>

              <p className="mvola__rubrique">Montants rapides</p>
              <div className="mvola__rapides" role="group" aria-label="Montants rapides">
                {MONTANTS_RAPIDES.map((valeur) => (
                  <button
                    key={valeur}
                    type="button"
                    className={`mvola__rapide${somme === valeur ? ' mvola__rapide--choisi' : ''}`}
                    aria-pressed={somme === valeur}
                    onClick={() => setMontant(String(valeur))}
                  >
                    <span className="mvola__rapide-rond" aria-hidden="true">
                      Ar
                    </span>
                    {fmt.nombre(valeur)}
                  </button>
                ))}
              </div>

              <label className="mvola__champ" htmlFor="mvola-numero">
                <span className="mvola__champ-libelle">Votre numéro MVola</span>
                <span className={`mvola__telephone${soumis && erreurs.numero ? ' mvola__telephone--erreur' : ''}`}>
                  <span className="mvola__indicatif" aria-hidden="true">
                    +261
                  </span>
                  <input
                    id="mvola-numero"
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel-national"
                    placeholder="34 12 345 67"
                    value={numero}
                    maxLength={9}
                    onChange={(e) => setNumero(e.target.value.replace(/\D/g, '').replace(/^0/, '').slice(0, 9))}
                    aria-invalid={soumis && Boolean(erreurs.numero)}
                    aria-describedby="mvola-numero-aide"
                  />
                </span>
                <span
                  className={`mvola__aide${soumis && erreurs.numero ? ' mvola__aide--erreur' : ''}`}
                  id="mvola-numero-aide"
                >
                  {soumis && erreurs.numero ? erreurs.numero : 'Le numéro Telma depuis lequel vous payez.'}
                </span>
              </label>

              <div className="mvola__actions">
                <button type="submit" className="mvola__bouton">
                  Continuer vers MVola
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M5 12h14M13 6l6 6-6 6" />
                  </svg>
                </button>
                <button type="button" className="mvola__plus-tard" onClick={() => quitter()}>
                  Payer plus tard
                </button>
              </div>
            </form>
          </section>
        )}

        {/* ---------- 2. L'envoi ---------- */}
        {profil && compte?.disponible && temps === 'envoi' && (
          <section className="mvola__temps" key="envoi">
            <h1 className="mvola__titre" ref={titre} tabIndex={-1}>
              Envoyez {fmt.montant(somme)} depuis MVola
            </h1>
            <p className="mvola__texte">
              Depuis le <strong>{numeroLisible(`0${numero}`)}</strong>, en trois gestes.
              {/* Le pied de page le redit : le telephone s'en passe ici. */}
              <span className="mvola__hors-telephone">
                {' '}
                Votre code secret ne se tape que dans MVola : HOPE ne vous le demandera jamais.
              </span>
            </p>

            <ol className="mvola__gestes">
              <li className="mvola__geste" style={{ '--rang': 0 }}>
                <span className="mvola__geste-rond" aria-hidden="true">
                  <svg viewBox="0 0 24 24">
                    <rect x="6" y="2.5" width="12" height="19" rx="2.5" />
                    <path d="M10.5 18.5h3" />
                  </svg>
                </span>
                <span className="mvola__geste-titre">Composez #111#</span>
                <span className="mvola__geste-texte">ou ouvrez l’application MVola</span>
              </li>
              <li className="mvola__geste" style={{ '--rang': 1 }}>
                <span className="mvola__geste-rond" aria-hidden="true">
                  <svg viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="8.5" />
                    <path d="M9 13.5l3-3 3 3M12 10.5V16" />
                    <path d="M16.5 4.5l2-2M18.5 2.5v2.4M18.5 2.5h-2.4" />
                  </svg>
                </span>
                <span className="mvola__geste-titre">Transfert &amp; Paiement</span>
                <span className="mvola__geste-texte">vers le numéro de HOPE ci-dessous</span>
              </li>
              <li className="mvola__geste" style={{ '--rang': 2 }}>
                <span className="mvola__geste-rond" aria-hidden="true">
                  <svg viewBox="0 0 24 24">
                    <rect x="5" y="10.5" width="14" height="10" rx="2" />
                    <path d="M8.5 10.5V8a3.5 3.5 0 017 0v2.5" />
                    <circle cx="12" cy="15.5" r="1.2" />
                  </svg>
                </span>
                <span className="mvola__geste-titre">Code secret</span>
                <span className="mvola__geste-texte">puis gardez le SMS de confirmation</span>
              </li>
            </ol>

            <div className="mvola__destinataire">
              <Copiable
                libelle={`Numéro MVola de ${compte.titulaire}`}
                valeur={compte.numero}
                affiche={numeroLisible(compte.numero)}
              />
              <Copiable libelle="Montant exact" valeur={String(somme)} affiche={fmt.montant(somme)} />
              <p className="mvola__destinataire-nom">
                Au nom de <strong>{compte.titulaire}</strong> — vérifiez-le avant de valider.
              </p>
            </div>

            <a className="mvola__composer" href="tel:%23111%23">
              <span className="mvola__composer-pulse" aria-hidden="true" />
              Composer #111# sur ce téléphone
            </a>

            <form onSubmit={declarer} noValidate aria-label="Référence de la transaction">
              <label className="mvola__champ" htmlFor="mvola-reference">
                <span className="mvola__champ-libelle">Référence reçue par SMS</span>
                <input
                  id="mvola-reference"
                  className={`mvola__saisie${soumis && erreurs.reference ? ' mvola__saisie--erreur' : ''}`}
                  autoComplete="off"
                  autoCapitalize="characters"
                  spellCheck={false}
                  placeholder="Ex. 2609241234567"
                  value={reference}
                  maxLength={40}
                  onChange={(e) => setReference(e.target.value)}
                  disabled={envoi}
                  aria-invalid={soumis && Boolean(erreurs.reference)}
                  aria-describedby="mvola-reference-aide"
                />
                <span
                  className={`mvola__aide${soumis && erreurs.reference ? ' mvola__aide--erreur' : ''}`}
                  id="mvola-reference-aide"
                >
                  {soumis && erreurs.reference
                    ? erreurs.reference
                    : 'MVola vous l’envoie juste après le paiement. L’équipe HOPE la rapproche de son relevé.'}
                </span>
              </label>

              <div className="mvola__actions">
                <button type="submit" className="mvola__bouton" disabled={envoi} aria-busy={envoi}>
                  {envoi ? (
                    <>
                      <span className="mvola__rotation mvola__rotation--clair" aria-hidden="true" />
                      Enregistrement…
                    </>
                  ) : (
                    'J’ai envoyé mon don'
                  )}
                </button>
                <button type="button" className="mvola__plus-tard" onClick={() => quitter()} disabled={envoi}>
                  Payer plus tard
                </button>
              </div>
              <p className="mvola__erreur mvola__erreur--centre" role="alert">
                {refus}
              </p>
            </form>
          </section>
        )}

        {/* ---------- 3. Merci ---------- */}
        {profil && temps === 'merci' && don && (
          <section className="mvola__temps mvola__temps--merci" key="merci">
            <div className="mvola__sceau" aria-hidden="true">
              <span className="mvola__onde" />
              <span className="mvola__onde mvola__onde--2" />
              <svg viewBox="0 0 52 52">
                <circle cx="26" cy="26" r="24" />
                <path d="M15 27l7 7 15-16" />
              </svg>
              {Array.from({ length: 8 }, (_, i) => (
                <span key={i} className="mvola__etincelle" style={{ '--angle': `${i * 45}deg` }} />
              ))}
            </div>
            <h1 className="mvola__titre mvola__titre--centre" ref={titre} tabIndex={-1}>
              Misaotra betsaka !
            </h1>
            <p className="mvola__texte mvola__texte--centre">
              Votre don de <strong>{fmt.montant(don.montant ?? somme)}</strong> est enregistré. L’équipe HOPE le
              confirme dès qu’elle voit votre paiement sur son relevé MVola.
            </p>

            <dl className="mvola__recu">
              <div>
                <dt>Don</dt>
                <dd>{don.reference}</dd>
              </div>
              <div>
                <dt>Pour</dt>
                <dd>{beneficiaire}</dd>
              </div>
              <div>
                <dt>Référence MVola</dt>
                <dd>{reference.trim().toUpperCase()}</dd>
              </div>
              <div>
                <dt>Statut</dt>
                <dd>
                  <span className="mvola__statut">
                    <span className="mvola__statut-point" aria-hidden="true" />
                    En attente de confirmation
                  </span>
                </dd>
              </div>
            </dl>

            <div className="mvola__actions">
              <button type="button" className="mvola__bouton" onClick={() => quitter()}>
                Continuer mon inscription
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M5 12h14M13 6l6 6-6 6" />
                </svg>
              </button>
            </div>
          </section>
        )}

        <p className="mvola__pied">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 3l7 3v5c0 4.5-3 8.3-7 10-4-1.7-7-5.5-7-10V6z" />
            <path d="M9 12l2 2 4-4" />
          </svg>
          HOPE ne vous demandera jamais votre code secret MVola.
        </p>
        </div>
      </main>
    </div>
  );
}

/** Les trois temps, tels que la colonne du resume les raconte. */
const ETAPES = [
  { nom: 'Montant', texte: 'Ce que vous donnez, et depuis quel numéro.' },
  { nom: 'Envoi', texte: 'Depuis #111#, vers le numéro de HOPE.' },
  { nom: 'Merci', texte: 'L’équipe confirme dès réception.' },
];

/**
 * La colonne jaune de l'ordinateur : les deux marques, les trois temps,
 * et le don tel qu'il se precise. Le telephone ne l'affiche pas -- il
 * a la pilule et la carte "solde", et pas de place a perdre.
 */
function Resume({ indice, montant, beneficiaire, titulaire, numero }) {
  return (
    <aside className="mvola__cote" aria-label="Récapitulatif du don">
      <div className="mvola__marques">
        <span className="mvola__marque-hope">
          <HopeLogo />
        </span>
        <span className="mvola__croix" aria-hidden="true">
          ×
        </span>
        <img className="mvola__marque-mvola" src={logoMvola} alt="MVola" decoding="async" />
      </div>

      <h2 className="mvola__cote-titre">Votre don, en trois gestes</h2>
      <p className="mvola__cote-texte">
        Le paiement se fait dans MVola, depuis votre téléphone. HOPE reçoit votre don et vous le confirme.
      </p>

      <ol className="mvola__etapes">
        {ETAPES.map((etape, i) => (
          <li
            key={etape.nom}
            className={`mvola__etape${i === indice ? ' mvola__etape--active' : ''}${i < indice ? ' mvola__etape--faite' : ''}`}
            aria-current={i === indice ? 'step' : undefined}
          >
            <span className="mvola__etape-rond" aria-hidden="true">
              {i < indice ? (
                <svg viewBox="0 0 24 24">
                  <path d="M6 12.5l4 4 8-9" />
                </svg>
              ) : (
                i + 1
              )}
            </span>
            <span className="mvola__etape-corps">
              <strong>{etape.nom}</strong>
              <small>{etape.texte}</small>
            </span>
          </li>
        ))}
      </ol>

      <dl className="mvola__resume">
        <div className="mvola__resume-montant">
          <dt>Montant</dt>
          <dd key={montant ?? 0}>{montant ? fmt.montant(montant) : '—'}</dd>
        </div>
        <div>
          <dt>Pour</dt>
          <dd>{beneficiaire}</dd>
        </div>
        <div>
          <dt>Vers</dt>
          <dd>{titulaire}</dd>
        </div>
        <div>
          <dt>Depuis</dt>
          <dd>{/^3[48]\d{7}$/.test(numero) ? numeroLisible(`0${numero}`) : '—'}</dd>
        </div>
      </dl>

      <p className="mvola__cote-pied">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 3l7 3v5c0 4.5-3 8.3-7 10-4-1.7-7-5.5-7-10V6z" />
          <path d="M9 12l2 2 4-4" />
        </svg>
        HOPE ne vous demandera jamais votre code secret MVola.
      </p>
    </aside>
  );
}

/**
 * Une valeur a recopier dans MVola, et son bouton "Copier".
 *
 * Le presse-papiers peut etre refuse (page non securisee, navigateur
 * ancien) : le texte reste alors selectionnable a la main.
 */
function Copiable({ libelle, valeur, affiche }) {
  const [copie, setCopie] = useState(false);

  useEffect(() => {
    if (!copie) return undefined;
    const minuterie = setTimeout(() => setCopie(false), 1800);
    return () => clearTimeout(minuterie);
  }, [copie]);

  async function copier() {
    try {
      await navigator.clipboard.writeText(valeur);
      setCopie(true);
    } catch {
      /* le texte reste lisible et selectionnable */
    }
  }

  return (
    <div className="mvola__copiable">
      <span className="mvola__copiable-libelle">{libelle}</span>
      <span className="mvola__copiable-valeur">{affiche}</span>
      <button
        type="button"
        className={`mvola__copier${copie ? ' mvola__copier--fait' : ''}`}
        onClick={copier}
        aria-label={`Copier : ${libelle}`}
      >
        {copie ? 'Copié' : 'Copier'}
      </button>
      <span className="sr-only" aria-live="polite">
        {copie ? `${libelle} copié` : ''}
      </span>
    </div>
  );
}
