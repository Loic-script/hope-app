import { cloneElement } from 'react';
import { isValidPhoneNumber, parsePhoneNumberFromString } from 'libphonenumber-js';

import ChoixSurPage, { parLettre } from '../ChoixSurPage.jsx';
import { IconeChevronBas } from '../HopeIcons.jsx';
import { PAYS, PAYS_PAR_DEFAUT, indicatifDe, nomAnglais, nomDuPays } from '../../utils/pays.js';

/**
 * Les pieces communes aux parcours d'accueil.
 *
 * Le donateur a ouvert la voie : un champ avec son icone et son erreur,
 * un telephone en deux morceaux -- l'indicatif choisi dans la liste de
 * tous les pays, puis le numero --, et les rayons du soleil en
 * filigrane. Le benevole remplit une autre fiche, mais la saisie doit
 * se faire de la meme facon : c'est la meme maison.
 *
 * Ces composants portent les classes "parcours__*" (parcours-donateur.css).
 * Le nom vient du premier parcours ; renommer un millier de lignes de
 * style n'apprendrait rien a personne.
 */

/*
 * Sur telephone, les longues listes -- pays, indicatif -- s'ouvrent sur
 * une page a part, recherche en haut (ChoixSurPage). On les y cherche en
 * francais comme en anglais -- "Allemagne" ou "Germany" --, et
 * l'indicatif par son numero, avec ou sans "+".
 */

/**
 * Les pays sur la page de choix : Madagascar en suggestion, puis tous
 * les pays -- Madagascar compris -- ranges par lettre, chacun avec son
 * drapeau. Pour l'indicatif, chaque ligne porte aussi "+261", et se
 * cherche par "261" ou "+261".
 */
function groupesDePays(avecIndicatif) {
  const options = PAYS.map((pays) => {
    const indicatif = indicatifDe(pays.code);
    return {
      valeur: pays.code,
      libelle: pays.nom,
      drapeau: pays.code,
      detail: avecIndicatif ? indicatif : undefined,
      motsCles: [nomAnglais(pays.code), ...(avecIndicatif ? [indicatif.slice(1)] : [])],
    };
  });
  const alphabetique = [...options].sort((a, b) => a.libelle.localeCompare(b.libelle, 'fr'));
  return [
    {
      libelle: 'Suggestion',
      options: options.filter((option) => option.valeur === PAYS_PAR_DEFAUT),
    },
    ...parLettre(alphabetique),
  ];
}

export const GROUPES_PAYS = groupesDePays(false);
export const GROUPES_INDICATIF = groupesDePays(true);

/**
 * Un choix fait sur la page de choix, rendu comme un changement de liste
 * native : les gestionnaires du formulaire n'ont pas a distinguer l'un
 * de l'autre.
 */
export const commeUneListe = (gestionnaire) => (valeur) =>
  gestionnaire({ target: { value: valeur, tagName: 'SELECT' } });

/* ------------------------------------------------------------------
   Le telephone
   ------------------------------------------------------------------ */

/** Le numero tel qu'on le montre : national s'il vient du pays choisi. */
export function numeroAffiche(telephone, indicatif) {
  const numero = parsePhoneNumberFromString(telephone ?? '');
  if (!numero) return telephone ?? '';
  return numero.country === (indicatif || PAYS_PAR_DEFAUT)
    ? numero.formatNational()
    : numero.formatInternational();
}

/** Le numero saisi, au format international, ou null s'il ne vaut rien. */
export function numeroInternational(saisie, indicatif) {
  const texte = String(saisie ?? '').trim();
  if (texte === '') return null;
  const code = indicatif || PAYS_PAR_DEFAUT;
  if (!isValidPhoneNumber(texte, code)) return null;
  return parsePhoneNumberFromString(texte, code)?.number ?? null;
}

/** Le pays d'un numero deja enregistre ("+33612..." -> "FR"), s'il se deduit. */
export function paysDuNumero(telephone) {
  return parsePhoneNumberFromString(telephone ?? '')?.country ?? null;
}

/**
 * L'indicatif du telephone : tous les pays, Madagascar en tete.
 *
 * Replie, il ne montre que "+261" : le nom du pays ne tiendrait pas
 * devant le numero. Ouvert, c'est la liste native du systeme -- "Pays
 * (+indicatif)" -- que le clavier et les lecteurs d'ecran savent
 * parcourir, et qui s'ouvre en roue sur un telephone. Elle est posee,
 * transparente, sur l'affichage : c'est elle que l'on touche.
 *
 * Sur telephone, la meme case ouvre la page de choix, avec sa recherche.
 */
export function SelecteurIndicatif({ valeur, onChange, disabled, surPage = false, id = 'indicatif' }) {
  const affichage = (
    <span className="parcours__indicatif" aria-hidden="true">
      {indicatifDe(valeur)}
      <IconeChevronBas className="parcours__indicatif-chevron" />
    </span>
  );

  if (surPage) {
    return (
      <>
        {affichage}
        <ChoixSurPage
          id={id}
          className="parcours__indicatif-liste"
          nom="Indicatif téléphonique"
          aria-label={`Indicatif téléphonique : ${nomDuPays(valeur || PAYS_PAR_DEFAUT)} ${indicatifDe(valeur)}`}
          valeur={valeur}
          groupes={GROUPES_INDICATIF}
          indiceRecherche="Pays ou indicatif, par ex. +261…"
          onChoisir={commeUneListe(onChange)}
          disabled={disabled}
          rendu={() => null}
        />
      </>
    );
  }

  return (
    <>
      {affichage}
      <select
        id={id}
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

/* ------------------------------------------------------------------
   Le champ
   ------------------------------------------------------------------ */

/**
 * Un champ : libelle, icone, saisie, erreur.
 *
 * La saisie arrive en enfant ; ce composant lui donne son id, et la
 * relie a son message d'erreur pour les lecteurs d'ecran.
 *
 * "prefixe" tient l'indicatif du telephone, "liste" ajoute le chevron
 * d'une liste deroulante.
 */
export function Champ({
  id,
  prefixeId = 'parcours',
  libelle,
  facultatif = false,
  erreur,
  aide,
  Icone,
  prefixe,
  liste = false,
  children,
}) {
  const identifiant = `${prefixeId}-${id}`;
  const idErreur = `${identifiant}-erreur`;
  const idAide = `${identifiant}-aide`;
  const decrit = [erreur ? idErreur : null, aide && !erreur ? idAide : null]
    .filter(Boolean)
    .join(' ');
  const saisie = cloneElement(children, {
    id: identifiant,
    name: id,
    className: 'parcours__saisie',
    'aria-invalid': Boolean(erreur),
    'aria-describedby': decrit || undefined,
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
      {erreur ? (
        <p className="parcours__erreur" id={idErreur}>
          {erreur}
        </p>
      ) : (
        aide && (
          <p className="parcours__aide" id={idAide}>
            {aide}
          </p>
        )
      )}
    </div>
  );
}

/**
 * Les rayons du soleil HOPE, en filigrane dans les coins bas de la page.
 * Purement decoratifs.
 */
export function RayonsDecor({ className }) {
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
