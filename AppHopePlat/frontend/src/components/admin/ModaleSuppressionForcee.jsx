import { useEffect, useState } from 'react';

import { IconeAlerte } from './AdminIcons.jsx';
import { Modale } from './forms.jsx';

/**
 * Le dernier avertissement avant une suppression irreversible.
 *
 * Un projet qui a recu un don ou paye une depense ne s'efface pas : la
 * regle protege l'historique, et l'archivage existe pour cela. Il
 * arrive pourtant qu'un projet soit ouvert par erreur, avec de
 * l'argent saisi par erreur aussi. Cette fenetre est ce detour-la.
 *
 * Elle ne demande pas "etes-vous sur ?" -- personne ne lit cette
 * question. Elle dit, ligne par ligne, ce qui va disparaitre et ce qui
 * survivra, puis demande d'ecrire le nom du projet : le temps de
 * l'ecrire est le temps de se raviser.
 *
 * @param {{ ouverte: boolean, projet: object|null, ecritures?: object,
 *           onFermer: () => void, onConfirmer: () => void,
 *           envoi?: boolean, erreur?: string }} proprietes
 */
export default function ModaleSuppressionForcee({
  ouverte,
  projet,
  ecritures = null,
  onFermer,
  onConfirmer,
  envoi = false,
  erreur,
}) {
  const [saisi, setSaisi] = useState('');

  useEffect(() => {
    if (ouverte) setSaisi('');
  }, [ouverte]);

  if (!projet) return null;

  const nom = projet.name ?? projet.nom ?? '';
  const concorde = saisi.trim().toLowerCase() === nom.trim().toLowerCase();

  // Ce que l'on sait du projet : la liste en dit le sort, meme quand le
  // compte exact n'est pas connu de cet ecran.
  const dons = ecritures?.dons ?? null;
  const depenses = ecritures?.depenses ?? null;
  const investissements = ecritures?.investissements ?? null;
  const compte = (nombre, singulier, pluriel = `${singulier}s`) =>
    nombre === null ? `Les ${pluriel}` : `${nombre} ${nombre > 1 ? pluriel : singulier}`;

  return (
    <Modale
      ouverte={ouverte}
      titre="Supprimer quand même ce projet ?"
      sousTitre={nom}
      onFermer={onFermer}
      erreur={erreur}
      pied={
        <>
          <button type="button" className="btn btn--neutre" onClick={onFermer} disabled={envoi}>
            Annuler
          </button>
          <button
            type="button"
            className="btn btn--danger"
            onClick={onConfirmer}
            disabled={envoi || !concorde}
          >
            {envoi ? 'Suppression…' : 'Supprimer définitivement'}
          </button>
        </>
      }
    >
      <div className="suppression-forcee">
        <p className="suppression-forcee__alerte">
          <IconeAlerte />
          Cette suppression est définitive. Rien ne sera récupérable.
        </p>

        <p className="suppression-forcee__intro">Voici ce qui va se passer :</p>

        <ul className="suppression-forcee__liste">
          <li className="suppression-forcee__garde">
            <strong>{compte(dons, 'don')}</strong> {dons === 1 ? 'reste' : 'restent'} enregistré
            {dons !== 1 && 's'} et rejoin{dons === 1 ? 't' : 'dront'} les fonds de HOPE. Le donateur
            les garde dans son espace, la comptabilité ne perd rien.
          </li>
          <li className="suppression-forcee__efface">
            <strong>{compte(depenses, 'dépense')}</strong> et{' '}
            <strong>{compte(investissements, 'investissement')}</strong> de ce projet
            {' '}sont effacés. Les sommes investies retournent aux fonds disponibles.
          </li>
          <li className="suppression-forcee__efface">
            Les tâches, les preuves terrain, les impacts mesurés, les bénéficiaires rattachés et les
            affectations des partenaires à ce projet sont effacés.
          </li>
        </ul>

        <p className="suppression-forcee__conseil">
          Si vous vouliez seulement le sortir des listes, <strong>archivez-le</strong> : son
          histoire reste consultable.
        </p>

        <label className="suppression-forcee__champ" htmlFor="suppression-forcee-nom">
          <span>
            Pour confirmer, écrivez le nom du projet : <strong>{nom}</strong>
          </span>
          <input
            id="suppression-forcee-nom"
            type="text"
            value={saisi}
            onChange={(evenement) => setSaisi(evenement.target.value)}
            disabled={envoi}
            autoComplete="off"
            placeholder={nom}
            aria-describedby="suppression-forcee-aide"
          />
        </label>
        <p className="suppression-forcee__aide" id="suppression-forcee-aide">
          {concorde
            ? 'Le nom correspond : le bouton de suppression est actif.'
            : 'Le bouton de suppression s’active quand le nom correspond.'}
        </p>
      </div>
    </Modale>
  );
}
