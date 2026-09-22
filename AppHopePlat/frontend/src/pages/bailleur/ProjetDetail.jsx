import { useState } from 'react';
import { useParams } from 'react-router-dom';

import FicheProjet from '../../components/projet/FicheProjet.jsx';
import { useChargement } from '../../hooks/useChargement.js';
import * as service from '../../services/bailleur.service.js';
import * as fmt from '../../utils/format.js';
import { Pastille } from './composants.jsx';
import { STATUTS_PROJET } from './Projets.jsx';
import FenetreRapportProjet from './RapportProjet.jsx';

/**
 * Un projet, tel qu'un partenaire le consulte : la fiche commune
 * (FicheProjet), avec ce qui regarde le bailleur -- s'il le finance, ce
 * qu'il y a affecte, et le rapport a jour, a un clic en tete de page.
 */
export default function ProjetDetail() {
  const { id } = useParams();
  const [rapportOuvert, setRapportOuvert] = useState(false);

  const { donnees, chargement, erreur } = useChargement(() => service.projet(id), [id]);

  if (chargement && !donnees) return <p className="vide-bailleur">Chargement du projet…</p>;
  if (erreur) return <p className="alerte-bailleur">{erreur}</p>;
  if (!donnees) return null;

  const projet = donnees.project;
  const statut = STATUTS_PROJET[projet.status] ?? STATUTS_PROJET.IN_PROGRESS;
  const devise = projet.currency ?? 'MGA';

  return (
    <>
      <FicheProjet
        donnees={donnees}
        lienRetour="/bailleur/projets"
        libelleRetour="Tous les projets"
        pastilles={
          <>
            <Pastille teinte={statut.teinte}>{statut.libelle}</Pastille>
            {projet.financeParMoi && <Pastille teinte="violet">Vous financez</Pastille>}
          </>
        }
        action={
          <button type="button" className="bouton-bailleur" onClick={() => setRapportOuvert(true)}>
            Lire le rapport
          </button>
        }
        votrePart={
          projet.financeParMoi
            ? {
                libelle: 'Votre affectation',
                montant: fmt.montant(donnees.finance.votreAffectation, devise),
                note:
                  'Le montant que votre organisation a attribué à ce projet. Il s’ajoute à la ' +
                  'somme investie, qui ne compte que les dons et les fonds de HOPE.',
              }
            : null
        }
      />

      <FenetreRapportProjet
        projet={rapportOuvert ? projet : null}
        onFermer={() => setRapportOuvert(false)}
      />
    </>
  );
}
