import { Link, useParams } from 'react-router-dom';

import { IconeCoeur } from '../../components/HopeIcons.jsx';
import FicheProjet from '../../components/projet/FicheProjet.jsx';
import { useChargement } from '../../hooks/useChargement.js';
import * as service from '../../services/donateur.service.js';
import * as fmt from '../../utils/format.js';

const STATUTS_PROJET = {
  IN_PROGRESS: { libelle: 'En cours', teinte: 'recu' },
  COMPLETED: { libelle: 'Terminé', teinte: 'neutre' },
  ARCHIVED: { libelle: 'Archivé', teinte: 'neutre' },
};

/** "25 000 Ar" ou "25 000 Ar et 40 €" : un total par devise. */
function totaux(lignes, cle) {
  return lignes
    .filter((l) => Number(l[cle]) > 0)
    .map((l) => fmt.montant(l[cle], l.devise))
    .join(' et ');
}

/**
 * Un projet, tel qu'un donateur le consulte : la fiche commune
 * (FicheProjet) -- ce qu'il est, son financement, son impact --, avec ce
 * qui regarde le donateur : ses dons a ce projet, et le bouton pour y
 * donner tant qu'il est ouvert.
 */
export default function ProjetDetail() {
  const { id } = useParams();
  const { donnees, chargement, erreur } = useChargement(() => service.projet(id), [id]);

  if (chargement && !donnees) return <p className="don-vide">Chargement du projet…</p>;
  if (erreur) return <p className="don-refus">{erreur}</p>;
  if (!donnees) return null;

  const projet = donnees.project;
  const statut = STATUTS_PROJET[projet.status] ?? STATUTS_PROJET.IN_PROGRESS;
  const vos = donnees.vosDons ?? { totaux: [], nombreRecus: 0, nombreEnAttente: 0 };
  const aDonne = vos.nombreRecus + vos.nombreEnAttente > 0;
  const recu = totaux(vos.totaux, 'recu');
  const promis = totaux(vos.totaux, 'enAttente');

  return (
    <div className="espace-donateur">
      <FicheProjet
        donnees={donnees}
        lienRetour="/donateur/projets"
        libelleRetour="Tous les projets"
        pastilles={
          <>
            <span className={`don-statut don-statut--${statut.teinte}`}>{statut.libelle}</span>
            {vos.nombreRecus > 0 && <span className="don-statut don-statut--violet">Vous soutenez</span>}
          </>
        }
        action={
          donnees.ouvertAuxDons ? (
            <Link className="don-cta don-cta--plein" to={`/donateur/faire-un-don?projet=${projet.id}`}>
              <IconeCoeur />
              Faire un don
            </Link>
          ) : null
        }
        votrePart={
          aDonne
            ? {
                libelle: 'Vos dons à ce projet',
                montant: recu || 'En attente de confirmation',
                note: [
                  recu && `${vos.nombreRecus} don${vos.nombreRecus > 1 ? 's' : ''} reçu${vos.nombreRecus > 1 ? 's' : ''}.`,
                  promis && `${promis} promis, en attente de confirmation par l’équipe HOPE.`,
                  'Vos dons comptent dans la somme investie dès leur réception.',
                ]
                  .filter(Boolean)
                  .join(' '),
              }
            : null
        }
      />
    </div>
  );
}
