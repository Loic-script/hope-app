import { cloneElement } from 'react';
import { isValidPhoneNumber, parsePhoneNumberFromString } from 'libphonenumber-js';

import ChoixSurPage, { parLettre } from '../ChoixSurPage.jsx';
import { IconeChevronBas } from '../HopeIcons.jsx';
import { PAYS, PAYS_PAR_DEFAUT, indicatifDe, nomAnglais, nomDuPays } from '../../utils/pays.js';

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

export const commeUneListe = (gestionnaire) => (valeur) =>
  gestionnaire({ target: { value: valeur, tagName: 'SELECT' } });

export function numeroAffiche(telephone, indicatif) {
  const numero = parsePhoneNumberFromString(telephone ?? '');
  if (!numero) return telephone ?? '';
  return numero.country === (indicatif || PAYS_PAR_DEFAUT)
    ? numero.formatNational()
    : numero.formatInternational();
}

export function numeroInternational(saisie, indicatif) {
  const texte = String(saisie ?? '').trim();
  if (texte === '') return null;
  const code = indicatif || PAYS_PAR_DEFAUT;
  if (!isValidPhoneNumber(texte, code)) return null;
  return parsePhoneNumberFromString(texte, code)?.number ?? null;
}

export function paysDuNumero(telephone) {
  return parsePhoneNumberFromString(telephone ?? '')?.country ?? null;
}

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
