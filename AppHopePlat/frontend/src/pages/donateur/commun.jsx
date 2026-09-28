import { JaugeHorizon } from '../../components/admin/PublicationProjet.jsx';
import { useDecompte } from '../../hooks/useDecompte.js';
import * as fmt from '../../utils/format.js';

/**
 * Les briques communes aux pages de l'espace donateur.
 */

/** Le statut d'un don : son libelle, et la teinte de sa pastille. */
export const STATUTS_DON = {
  PENDING: { libelle: 'En attente', teinte: 'attente' },
  RECEIVED: { libelle: 'Reçu', teinte: 'recu' },
  FAILED: { libelle: 'Non abouti', teinte: 'echec' },
  REFUNDED: { libelle: 'Remboursé', teinte: 'neutre' },
};

/** Une pastille de statut de don. */
export function StatutDon({ statut }) {
  const s = STATUTS_DON[statut] ?? { libelle: statut, teinte: 'neutre' };
  return <span className={`don-statut don-statut--${s.teinte}`}>{s.libelle}</span>;
}

/** La frequence d'un don, en clair. */
export const FREQUENCES_DON = { ONE_TIME: 'Ponctuel', MONTHLY: 'Mensuel' };

/**
 * Un projet de GET /donateur/projets, sous la forme qu'attend la
 * publication du fil -- celle des projets de l'administration.
 */
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

/** Ou en est le financement d'un projet : la jauge au soleil. */
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

/**
 * La ligne des totaux ou le donateur a le plus donne : un don en euros ne
 * s'additionne pas a un don en ariary, et l'ecran met en avant le principal.
 */
export function totalPrincipal(synthese) {
  const lignes = synthese?.totaux ?? [];
  return lignes[0] ?? null;
}

/**
 * Un montant qui monte de 0 a sa valeur a son arrivee.
 *
 * Les decimales tombent pendant la montee : on compte des ariary entiers,
 * et la valeur exacte s'affiche une fois posee.
 */
export function MontantAnime({ valeur, devise, delai = 0 }) {
  const cible = valeur === null || valeur === undefined ? null : Math.round(Number(valeur));
  const affiche = useDecompte(cible, delai, 1100);
  return <>{affiche === null ? '—' : fmt.montant(affiche === cible ? valeur : affiche, devise)}</>;
}

/** Un nombre qui monte de 0 a sa valeur a son arrivee. */
export function NombreAnime({ valeur, delai = 0 }) {
  const affiche = useDecompte(valeur ?? null, delai);
  return <>{affiche === null ? '—' : fmt.nombre(affiche)}</>;
}
