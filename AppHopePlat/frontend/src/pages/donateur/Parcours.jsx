import { cloneElement, useEffect, useRef, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { isValidPhoneNumber, parsePhoneNumberFromString } from 'libphonenumber-js';

import HopeLogo from '../../components/HopeLogo.jsx';
import {
  IconeChevronBas,
  IconeFleche,
  IconeGlobe,
  IconeImmeuble,
  IconeMallette,
  IconeMegaphone,
  IconeRepere,
  IconeTelephone,
  IconeUtilisateur,
} from '../../components/HopeIcons.jsx';
import { useChargement } from '../../hooks/useChargement.js';
import { messageErreur } from '../../services/api.js';
import * as donateurService from '../../services/donateur.service.js';
import { PAYS, PAYS_PAR_DEFAUT, indicatifDe, nomDuPays } from '../../utils/pays.js';

/** Le parcours compte cinq etapes ; la sixieme veut dire "termine". */
const NOMBRE_ETAPES = 5;

/**
 * Le parcours d'accueil du donateur.
 *
 * Il s'ouvre des l'inscription : informations personnelles, profil du
 * donateur, affectation du don, mode de paiement, frequence. Chaque
 * etape est enregistree en la quittant ; le serveur retient ou
 * reprendre, et un donateur qui s'arrete en chemin retrouve sa place.
 *
 * Seule l'etape 1 est construite. Les suivantes attendent leur modele.
 */
export default function Parcours() {
  const navigate = useNavigate();
  const { rafraichir } = useOutletContext();
  const { donnees, chargement, erreur } = useChargement(() => donateurService.recupererProfil(), []);

  const [etape, setEtape] = useState(null);
  // La fiche telle que le serveur l'a renvoyee apres la derniere etape :
  // revenir en arriere doit montrer ce qui vient d'etre enregistre, pas
  // ce qui avait ete lu a l'ouverture de la page.
  const [misAJour, setMisAJour] = useState(null);
  const profil = misAJour ?? donnees;

  useEffect(() => {
    if (!donnees) return;
    if (donnees.etapeSuivante > NOMBRE_ETAPES) {
      navigate('/donateur', { replace: true });
      return;
    }
    setEtape((courante) => courante ?? donnees.etapeSuivante);
  }, [donnees, navigate]);

  /** Change d'etape en ramenant le haut de la page sous les yeux. */
  function allerA(numero) {
    setEtape(numero);
    const sobre = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: 0, behavior: sobre ? 'auto' : 'smooth' });
  }

  return (
    <div className="parcours">
      <RayonsDecor className="parcours__rayons parcours__rayons--gauche" />
      <RayonsDecor className="parcours__rayons parcours__rayons--droite" />

      <main className="parcours__colonne">
        <HopeLogo className="parcours__logo" />

        {chargement && !donnees && (
          <p className="parcours__attente" role="status">
            Préparation de votre espace…
          </p>
        )}
        {erreur && (
          <p className="parcours__alerte" role="alert">
            {erreur}
          </p>
        )}

        {/* La cle relance l'animation d'entree a chaque changement d'etape. */}
        {profil && etape === 1 && (
          <EtapeInformations
            key="etape-1"
            initiales={profil.informations}
            sources={profil.options?.sources ?? []}
            onSuivante={async (reponse) => {
              setMisAJour(reponse);
              await rafraichir?.();
              allerA(Math.min(reponse.etapeSuivante, NOMBRE_ETAPES));
            }}
          />
        )}
        {profil && etape > 1 && (
          <EtapeAVenir key={`etape-${etape}`} etape={etape} onRetour={() => allerA(1)} />
        )}
      </main>
    </div>
  );
}

/* ================================================================
   Etape 1 : informations personnelles
   ================================================================ */

/** Ordre des champs obligatoires : c'est aussi l'ordre du focus en erreur. */
const OBLIGATOIRES = ['nom', 'prenom', 'adresse', 'ville', 'pays', 'telephone'];

/**
 * Le numero tel qu'on l'affiche : national s'il est de l'indicatif
 * choisi, international sinon. Le serveur, lui, le garde au format
 * +261...
 */
function numeroAffiche(telephone, indicatif) {
  const numero = parsePhoneNumberFromString(telephone ?? '');
  if (!numero) return telephone ?? '';
  return numero.country === (indicatif || PAYS_PAR_DEFAUT)
    ? numero.formatNational()
    : numero.formatInternational();
}

/** Le numero saisi, au format international, ou null s'il ne vaut rien. */
function numeroInternational(saisie, indicatif) {
  const texte = String(saisie ?? '').trim();
  if (texte === '') return null;
  const code = indicatif || PAYS_PAR_DEFAUT;
  if (!isValidPhoneNumber(texte, code)) return null;
  return parsePhoneNumberFromString(texte, code)?.number ?? null;
}

/** Le pays d'un numero deja enregistre ("+33612..." -> "FR"), s'il se deduit. */
function paysDuNumero(telephone) {
  return parsePhoneNumberFromString(telephone ?? '')?.country ?? null;
}

/** Les erreurs du formulaire, champ par champ. */
function verifier(champs) {
  const erreurs = {};
  if (champs.nom.trim() === '') erreurs.nom = 'Indiquez votre nom.';
  if (champs.prenom.trim() === '') erreurs.prenom = 'Indiquez votre prénom.';
  if (champs.adresse.trim() === '') erreurs.adresse = 'Indiquez votre adresse.';
  if (champs.ville.trim() === '') erreurs.ville = 'Indiquez votre ville.';
  if (champs.pays === '') erreurs.pays = 'Choisissez votre pays.';
  if (champs.telephone.trim() === '') {
    erreurs.telephone = 'Indiquez votre numéro de téléphone.';
  } else if (!numeroInternational(champs.telephone, champs.indicatif)) {
    erreurs.telephone = `Ce numéro n’est pas valide pour ${nomDuPays(
      champs.indicatif || PAYS_PAR_DEFAUT
    )} (${indicatifDe(champs.indicatif)}).`;
  }
  if (champs.profession.length > 120) erreurs.profession = 'Au plus 120 caractères.';
  return erreurs;
}

function EtapeInformations({ initiales, sources, onSuivante }) {
  /*
   * L'indicatif est distinct du pays de residence : on peut vivre en
   * France et garder un numero malgache. Il part du numero deja
   * enregistre, a defaut du pays, a defaut de Madagascar.
   */
  const [champs, setChamps] = useState(() => {
    const indicatif = paysDuNumero(initiales.telephone) ?? (initiales.pays || PAYS_PAR_DEFAUT);
    return {
      nom: initiales.nom ?? '',
      prenom: initiales.prenom ?? '',
      adresse: initiales.adresse ?? '',
      ville: initiales.ville ?? '',
      pays: initiales.pays ?? '',
      indicatif,
      telephone: numeroAffiche(initiales.telephone, indicatif),
      profession: initiales.profession ?? '',
      source: initiales.source ?? '',
    };
  });
  // Tant qu'on ne l'a pas choisi soi-meme, l'indicatif suit le pays : on
  // n'a pas a le chercher deux fois. Une fois choisi, on le respecte.
  const [indicatifChoisi, setIndicatifChoisi] = useState(() =>
    Boolean(paysDuNumero(initiales.telephone))
  );
  // Un champ n'est juge qu'une fois quitte : on ne reproche pas a
  // quelqu'un ce qu'il est en train d'ecrire.
  const [touches, setTouches] = useState({});
  const [erreursServeur, setErreursServeur] = useState({});
  const [soumis, setSoumis] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const [refus, setRefus] = useState('');
  const formulaire = useRef(null);

  const erreursLocales = verifier(champs);
  const erreurDe = (champ) =>
    erreursServeur[champ] ?? ((touches[champ] || soumis) ? erreursLocales[champ] : undefined);

  function modifier(champ) {
    return (evenement) => {
      const valeur = evenement.target.value;
      setChamps((precedents) => ({ ...precedents, [champ]: valeur }));
      setErreursServeur((precedentes) => ({ ...precedentes, [champ]: undefined }));
      // Un choix dans une liste est acheve des qu'il est fait.
      if (evenement.target.tagName === 'SELECT') {
        setTouches((precedents) => ({ ...precedents, [champ]: true }));
      }
    };
  }

  /** Le pays de residence ; l'indicatif le suit s'il n'a pas ete choisi. */
  function modifierPays(evenement) {
    const valeur = evenement.target.value;
    modifier('pays')(evenement);
    if (!indicatifChoisi && valeur) {
      setChamps((precedents) => ({ ...precedents, indicatif: valeur }));
    }
  }

  function modifierIndicatif(evenement) {
    const valeur = evenement.target.value;
    setIndicatifChoisi(true);
    setChamps((precedents) => ({ ...precedents, indicatif: valeur }));
    setErreursServeur((precedentes) => ({ ...precedentes, telephone: undefined }));
  }

  function quitter(champ) {
    return () => {
      setTouches((precedents) => ({ ...precedents, [champ]: true }));
      if (champ === 'telephone') {
        // Un numero saisi avec son "+" dit lui-meme son pays : l'indicatif
        // s'y range. "+33 6 12 34 56 78" -> +33 et "06 12 34 56 78".
        const texte = champs.telephone.trim();
        const international = texte.startsWith('+')
          ? parsePhoneNumberFromString(texte)
          : null;
        if (international?.isValid() && international.country) {
          setIndicatifChoisi(true);
          setChamps((precedents) => ({
            ...precedents,
            indicatif: international.country,
            telephone: international.formatNational(),
          }));
          return;
        }
        // Un numero valide se remet en forme : 0341234567 -> 034 12 345 67.
        const valide = numeroInternational(champs.telephone, champs.indicatif);
        if (valide) {
          setChamps((precedents) => ({
            ...precedents,
            telephone: numeroAffiche(valide, precedents.indicatif),
          }));
        }
      }
    };
  }

  /** Porte le focus sur le premier champ en erreur, dans l'ordre du formulaire. */
  function focaliserPremiereErreur(erreurs) {
    const premier = [...OBLIGATOIRES, 'profession', 'source'].find((champ) => erreurs[champ]);
    if (premier) formulaire.current?.querySelector(`#donateur-${premier}`)?.focus();
  }

  async function soumettre(evenement) {
    evenement.preventDefault();
    setSoumis(true);
    setRefus('');

    const erreurs = verifier(champs);
    if (Object.keys(erreurs).length > 0) {
      focaliserPremiereErreur(erreurs);
      return;
    }

    setEnvoi(true);
    try {
      const reponse = await donateurService.enregistrerEtape1({
        nom: champs.nom.trim(),
        prenom: champs.prenom.trim(),
        adresse: champs.adresse.trim(),
        ville: champs.ville.trim(),
        pays: champs.pays,
        telephone: numeroInternational(champs.telephone, champs.indicatif),
        profession: champs.profession.trim(),
        source: champs.source,
      });
      await onSuivante(reponse);
    } catch (echec) {
      const details = echec?.response?.data?.details ?? {};
      setErreursServeur(details);
      focaliserPremiereErreur(details);
      setRefus(messageErreur(echec, 'Vos informations n’ont pas pu être enregistrées.'));
    } finally {
      setEnvoi(false);
    }
  }

  const nbErreurs = soumis
    ? [...OBLIGATOIRES, 'profession', 'source'].filter((champ) => erreurDe(champ)).length
    : 0;

  return (
    <>
      <EntetePas
        etape={1}
        titre="Faisons connaissance"
        accroche="Complétez vos informations personnelles pour commencer."
      />

      <form
        ref={formulaire}
        className="parcours__formulaire"
        onSubmit={soumettre}
        noValidate
        aria-labelledby="parcours-section-1"
      >
        <h2 className="parcours__section" id="parcours-section-1">
          Informations personnelles
        </h2>

        <div className="parcours__paire">
          <Champ id="nom" libelle="Nom" erreur={erreurDe('nom')} Icone={IconeUtilisateur}>
            <input
              type="text"
              value={champs.nom}
              onChange={modifier('nom')}
              onBlur={quitter('nom')}
              placeholder="Votre nom"
              autoComplete="family-name"
              maxLength={80}
              disabled={envoi}
              autoFocus
            />
          </Champ>
          <Champ id="prenom" libelle="Prénom" erreur={erreurDe('prenom')} Icone={IconeUtilisateur}>
            <input
              type="text"
              value={champs.prenom}
              onChange={modifier('prenom')}
              onBlur={quitter('prenom')}
              placeholder="Votre prénom"
              autoComplete="given-name"
              maxLength={80}
              disabled={envoi}
            />
          </Champ>
        </div>

        <Champ id="adresse" libelle="Adresse" erreur={erreurDe('adresse')} Icone={IconeRepere}>
          <input
            type="text"
            value={champs.adresse}
            onChange={modifier('adresse')}
            onBlur={quitter('adresse')}
            placeholder="Votre adresse"
            autoComplete="street-address"
            maxLength={255}
            disabled={envoi}
          />
        </Champ>

        <div className="parcours__paire">
          <Champ id="ville" libelle="Ville" erreur={erreurDe('ville')} Icone={IconeImmeuble}>
            <input
              type="text"
              value={champs.ville}
              onChange={modifier('ville')}
              onBlur={quitter('ville')}
              placeholder="Votre ville"
              autoComplete="address-level2"
              maxLength={120}
              disabled={envoi}
            />
          </Champ>
          <Champ id="pays" libelle="Pays" erreur={erreurDe('pays')} Icone={IconeGlobe} liste>
            <select
              value={champs.pays}
              onChange={modifierPays}
              onBlur={quitter('pays')}
              autoComplete="country"
              disabled={envoi}
              data-vide={champs.pays === ''}
            >
              <option value="">Sélectionnez votre pays</option>
              {PAYS.map((pays) => (
                <option key={pays.code} value={pays.code}>
                  {pays.nom}
                </option>
              ))}
            </select>
          </Champ>
        </div>

        <Champ
          id="telephone"
          libelle="Téléphone"
          erreur={erreurDe('telephone')}
          Icone={IconeTelephone}
          prefixe={
            <SelecteurIndicatif
              valeur={champs.indicatif}
              onChange={modifierIndicatif}
              disabled={envoi}
            />
          }
        >
          <input
            type="tel"
            inputMode="tel"
            value={champs.telephone}
            onChange={modifier('telephone')}
            onBlur={quitter('telephone')}
            placeholder="Votre numéro de téléphone"
            autoComplete="tel-national"
            maxLength={24}
            disabled={envoi}
          />
        </Champ>

        <Champ
          id="profession"
          libelle="Profession"
          facultatif
          erreur={erreurDe('profession')}
          Icone={IconeMallette}
        >
          <input
            type="text"
            value={champs.profession}
            onChange={modifier('profession')}
            onBlur={quitter('profession')}
            placeholder="Votre profession"
            autoComplete="organization-title"
            maxLength={120}
            disabled={envoi}
          />
        </Champ>

        <Champ
          id="source"
          libelle="Comment avez-vous connu Hope ?"
          facultatif
          erreur={erreurDe('source')}
          Icone={IconeMegaphone}
          liste
        >
          <select
            value={champs.source}
            onChange={modifier('source')}
            disabled={envoi}
            data-vide={champs.source === ''}
          >
            <option value="">Sélectionnez une réponse</option>
            {sources.map((source) => (
              <option key={source.cle} value={source.cle}>
                {source.libelle}
              </option>
            ))}
          </select>
        </Champ>

        <button type="submit" className="parcours__continuer" disabled={envoi} aria-busy={envoi}>
          {envoi ? (
            <>
              <span className="parcours__rotation" aria-hidden="true" />
              Enregistrement…
            </>
          ) : (
            <>
              Continuer
              <IconeFleche className="parcours__fleche" />
            </>
          )}
        </button>

        {/* Sous le bouton, la ou le regard se pose apres le clic. Toujours
            present, meme vide : une zone d'alerte ajoutee apres coup
            n'est pas toujours annoncee par les lecteurs d'ecran. */}
        <p className="parcours__recap" role="alert">
          {refus ||
            (nbErreurs > 0
              ? `${nbErreurs} champ${nbErreurs > 1 ? 's demandent' : ' demande'} votre attention.`
              : '')}
        </p>
      </form>
    </>
  );
}

/* ================================================================
   Etapes 2 a 5 : en attente de leur modele
   ================================================================ */

const ETAPES_A_VENIR = {
  2: 'Votre profil de donateur',
  3: 'L’affectation de votre don',
  4: 'Votre mode de paiement',
  5: 'La fréquence de votre don',
};

/**
 * Provisoire : l'etape existe dans le parcours, pas encore a l'ecran.
 * Les informations deja donnees sont enregistrees ; on peut revenir les
 * corriger, ou entrer dans son espace.
 */
function EtapeAVenir({ etape, onRetour }) {
  const navigate = useNavigate();
  return (
    <>
      <EntetePas
        etape={etape}
        titre={ETAPES_A_VENIR[etape] ?? 'La suite'}
        accroche="Cette étape arrive très bientôt. Vos informations personnelles sont bien enregistrées."
      />
      <div className="parcours__actions">
        <button type="button" className="parcours__secondaire" onClick={onRetour}>
          Revoir mes informations
        </button>
        <button
          type="button"
          className="parcours__continuer"
          onClick={() => navigate('/donateur')}
        >
          Accéder à mon espace
          <IconeFleche className="parcours__fleche" />
        </button>
      </div>
    </>
  );
}

/* ================================================================
   Pieces communes
   ================================================================ */

/**
 * L'en-tete d'une etape : son numero, sa progression, son titre.
 *
 * La barre sous "Etape 1" compte les cinq etapes : on sait ou l'on est,
 * et combien il en reste, sans avoir a le lire.
 */
function EntetePas({ etape, titre, accroche }) {
  return (
    <header className="parcours__entete">
      <p className="parcours__etape">
        Étape {etape}
        <span className="sr-only"> sur {NOMBRE_ETAPES}</span>
      </p>
      <ol className="parcours__progression" aria-hidden="true">
        {Array.from({ length: NOMBRE_ETAPES }, (_, index) => (
          <li
            key={index}
            className={
              index + 1 < etape
                ? 'parcours__pas parcours__pas--fait'
                : index + 1 === etape
                  ? 'parcours__pas parcours__pas--actif'
                  : 'parcours__pas'
            }
          />
        ))}
      </ol>
      <h1 className="parcours__titre">{titre}</h1>
      <p className="parcours__accroche">{accroche}</p>
    </header>
  );
}

/**
 * Un champ : libelle, icone, saisie, erreur.
 *
 * La saisie arrive en enfant ; ce composant lui donne son id, et la
 * relie a son message d'erreur pour les lecteurs d'ecran.
 */
function Champ({ id, libelle, facultatif = false, erreur, Icone, prefixe, liste = false, children }) {
  const identifiant = `donateur-${id}`;
  const idErreur = `${identifiant}-erreur`;
  const saisie = cloneElement(children, {
    id: identifiant,
    name: id,
    className: 'parcours__saisie',
    'aria-invalid': Boolean(erreur),
    'aria-describedby': erreur ? idErreur : undefined,
    'aria-required': facultatif ? undefined : true,
  });

  return (
    <div className={`parcours__champ${erreur ? ' parcours__champ--erreur' : ''}`}>
      <label className="parcours__libelle" htmlFor={identifiant}>
        {libelle}
        {facultatif && <span className="parcours__facultatif">facultatif</span>}
      </label>
      <div className={`parcours__boite${prefixe ? ' parcours__boite--prefixe' : ''}`}>
        <Icone className="parcours__icone" />
        {prefixe && <div className="parcours__prefixe">{prefixe}</div>}
        {saisie}
        {liste && <IconeChevronBas className="parcours__chevron" />}
      </div>
      {erreur && (
        <p className="parcours__erreur" id={idErreur}>
          {erreur}
        </p>
      )}
    </div>
  );
}

/**
 * L'indicatif du telephone : tous les pays, Madagascar en tete.
 *
 * Replie, il ne montre que "+261" : le nom du pays ne tiendrait pas
 * devant le numero. Ouvert, c'est la liste native du systeme -- "Pays
 * (+indicatif)" -- que le clavier et les lecteurs d'ecran savent
 * parcourir, et qui s'ouvre en roue sur un telephone. Elle est posee,
 * transparente, sur l'affichage : c'est elle que l'on touche.
 */
function SelecteurIndicatif({ valeur, onChange, disabled }) {
  return (
    <>
      <span className="parcours__indicatif" aria-hidden="true">
        {indicatifDe(valeur)}
        <IconeChevronBas className="parcours__indicatif-chevron" />
      </span>
      <select
        id="donateur-indicatif"
        className="parcours__indicatif-liste"
        value={valeur}
        onChange={onChange}
        disabled={disabled}
        aria-label="Indicatif téléphonique"
      >
        {PAYS.map((pays) => (
          <option key={pays.code} value={pays.code}>
            {pays.nom} ({indicatifDe(pays.code)})
          </option>
        ))}
      </select>
    </>
  );
}

/**
 * Les rayons du soleil HOPE, en filigrane dans les coins bas de la page.
 * Purement decoratifs.
 */
function RayonsDecor({ className }) {
  return (
    <svg className={className} viewBox="0 0 240 240" aria-hidden="true" focusable="false">
      <circle cx="120" cy="240" r="62" />
      <g strokeLinecap="round" strokeWidth="22">
        <line x1="120" y1="150" x2="120" y2="96" />
        <line x1="62" y1="176" x2="30" y2="140" />
        <line x1="178" y1="176" x2="210" y2="140" />
        <line x1="40" y1="228" x2="4" y2="214" />
        <line x1="200" y1="228" x2="236" y2="214" />
      </g>
    </svg>
  );
}
