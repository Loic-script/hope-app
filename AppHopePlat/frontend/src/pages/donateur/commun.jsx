import { JaugeHorizon } from '../../components/admin/PublicationProjet.jsx';
import { useDecompte } from '../../hooks/useDecompte.js';
import * as fmt from '../../utils/format.js';

export const STATUTS_DON = {
  PENDING: { libelle: 'En attente', teinte: 'attente' },
  RECEIVED: { libelle: 'Reçu', teinte: 'recu' },
  FAILED: { libelle: 'Non abouti', teinte: 'echec' },
  REFUNDED: { libelle: 'Remboursé', teinte: 'neutre' },
};

export function StatutDon({ statut }) {
  const s = STATUTS_DON[statut] ?? { libelle: statut, teinte: 'neutre' };
  return <span className={`don-statut don-statut--${s.teinte}`}>{s.libelle}</span>;
}

export const FREQUENCES_DON = { ONE_TIME: 'Ponctuel', MONTHLY: 'Mensuel' };

export function projetCommePublication(projet) {
  return {
    id: projet.id,
    name: projet.nom,
    reference: projet.reference,
    categoryName: projet.categorie,
    location: projet.lieu,
    startDate: projet.debut,
    description: projet.description || projet.accroche,
    mediaUrl: projet.image,
    mediaType: projet.image ? 'PHOTO' : null,
    currency: projet.devise,
  };
}

export function JaugeProjet({ projet }) {
  return (
    <JaugeHorizon
      taux={projet.taux}
      recu={projet.collecte}
      manque={projet.restant}
      devise={projet.devise ?? 'MGA'}
    />
  );
}

export function totalPrincipal(synthese) {
  const lignes = synthese?.totaux ?? [];
  return lignes[0] ?? null;
}

export function MontantAnime({ valeur, devise, delai = 0 }) {
  const cible = valeur === null || valeur === undefined ? null : Math.round(Number(valeur));
  const affiche = useDecompte(cible, delai, 1100);
  return <>{affiche === null ? '—' : fmt.montant(affiche === cible ? valeur : affiche, devise)}</>;
}

export function NombreAnime({ valeur, delai = 0 }) {
  const affiche = useDecompte(valeur ?? null, delai);
  return <>{affiche === null ? '—' : fmt.nombre(affiche)}</>;
}
