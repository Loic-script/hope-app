import { useState } from 'react';

import { useChargement } from '../../hooks/useChargement.js';
import * as service from '../../services/espaceBenevole.service.js';
import { CarteMission, FORMATS } from './composants.jsx';

/** Les filtres proposes au-dessus de la liste. */
const ONGLETS = [
  { cle: 'toutes', label: 'Toutes' },
  { cle: 'presentiel', label: FORMATS.presentiel },
  { cle: 'terrain', label: FORMATS.terrain },
  { cle: 'distance', label: FORMATS.distance },
];

/**
 * Liste des missions proposees.
 *
 * Par defaut on ne montre que celles a venir : une mission passee ne
 * sert plus a rien a un benevole qui cherche ou s'engager. La case
 * permet de rouvrir l'historique.
 */
export default function Missions() {
  const [format, setFormat] = useState('toutes');
  const [recherche, setRecherche] = useState('');
  const [aVenirSeulement, setAVenirSeulement] = useState(true);

  const { donnees, chargement, erreur } = useChargement(
    () =>
      service.listerMissions({
        format: format === 'toutes' ? undefined : format,
        search: recherche.trim() || undefined,
        aVenir: aVenirSeulement,
      }),
    [format, recherche, aVenirSeulement]
  );

  const missions = donnees ?? [];

  return (
    <>
      <header className="page-benevole__entete">
        <h1 className="page-benevole__titre">Missions</h1>
        <p className="page-benevole__accroche">
          Choisissez une mission et inscrivez-vous. Les missions de terrain demandent un
          profil validé par HOPE.
        </p>
      </header>

      <div className="filtres-benevole">
        <div className="filtres-benevole__onglets" role="tablist">
          {ONGLETS.map((onglet) => (
            <button
              key={onglet.cle}
              type="button"
              role="tab"
              aria-selected={format === onglet.cle}
              className={`filtres-benevole__onglet${
                format === onglet.cle ? ' filtres-benevole__onglet--actif' : ''
              }`}
              onClick={() => setFormat(onglet.cle)}
            >
              {onglet.label}
            </button>
          ))}
        </div>

        <div className="filtres-benevole__droite">
          <input
            type="search"
            className="filtres-benevole__recherche"
            placeholder="Chercher un titre, un lieu, un projet…"
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            aria-label="Rechercher une mission"
          />
          <label className="filtres-benevole__case">
            <input
              type="checkbox"
              checked={aVenirSeulement}
              onChange={(e) => setAVenirSeulement(e.target.checked)}
            />
            À venir seulement
          </label>
        </div>
      </div>

      {erreur && <p className="alerte-benevole">{erreur}</p>}

      {chargement && missions.length === 0 ? (
        <p className="bloc__vide">Chargement des missions…</p>
      ) : missions.length === 0 ? (
        <p className="bloc__vide">
          Aucune mission ne correspond. Élargissez la recherche, ou décochez « À venir
          seulement » pour voir les missions passées.
        </p>
      ) : (
        <div className="cartes">
          {missions.map((mission) => (
            <CarteMission
              key={mission.id}
              mission={{ ...mission, inscriptionStatut: mission.monInscriptionStatut }}
            />
          ))}
        </div>
      )}
    </>
  );
}
