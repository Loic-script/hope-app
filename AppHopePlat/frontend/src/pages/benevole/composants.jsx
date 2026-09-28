/** Statut d'une tache. */
export const STATUTS_TACHE = {
  a_faire: 'À faire',
  en_cours: 'En cours',
  livree: 'Livrée',
};

/** Une pastille de statut, quel que soit le domaine. */
export function Pastille({ valeur, libelles, teinte }) {
  return (
    <span className={`pastille pastille--${teinte ?? 'gris'}`}>
      {libelles?.[valeur] ?? valeur}
    </span>
  );
}

/**
 * L'equipe d'une tache, en prenoms : "Avec Hery, Faniry".
 *
 * Seulement des prenoms : les photos des benevoles ne sont montrees qu'a
 * l'equipe HOPE.
 */
export function EquipeTache({ tache, className = 'equipe-tache' }) {
  const equipe = tache.equipe ?? [];
  if (equipe.length === 0) return null;
  const dedans = tache.maPlace === 'affectee';
  return (
    <p className={className}>
      {dedans ? 'Équipe : ' : 'Déjà dessus : '}
      {equipe.join(', ')}
    </p>
  );
}

/**
 * Ce qu'un benevole peut faire d'une tache qui n'est pas encore la sienne.
 *
 * Prendre une tache, c'est la demander : l'equipe HOPE valide. Libre, on
 * la demande ; deja prise par d'autres, on demande a la rejoindre. Une
 * demande en attente s'annule ; une demande refusee se renouvelle.
 *
 * @param {{ tache: object, envoi: boolean, onDemander: Function,
 *           onAnnuler: Function, classeBouton?: string, classeSecondaire?: string }} props
 */
export function ActionDemande({
  tache,
  envoi,
  onDemander,
  onAnnuler,
  classeBouton = 'btn btn--principal btn--petit',
  classeSecondaire = 'btn btn--neutre btn--petit',
}) {
  if (tache.statut === 'livree') return null;

  if (tache.maPlace === 'affectee') {
    return <span className="etat-demande etat-demande--dedans">Vous êtes dans l’équipe</span>;
  }

  if (tache.maPlace === 'demandee') {
    return (
      <>
        <span className="etat-demande">Demande envoyée — l’équipe HOPE doit la valider</span>
        <button type="button" className={classeSecondaire} disabled={envoi} onClick={() => onAnnuler(tache)}>
          Annuler ma demande
        </button>
      </>
    );
  }

  const rejoindre = (tache.equipe ?? []).length > 0;
  return (
    <>
      {tache.maPlace === 'refusee' && (
        <span className="etat-demande etat-demande--refus">Demande précédente non retenue</span>
      )}
      <button type="button" className={classeBouton} disabled={envoi} onClick={() => onDemander(tache)}>
        {tache.maPlace === 'refusee'
          ? 'Redemander'
          : rejoindre
            ? 'Demander à rejoindre'
            : 'Demander cette tâche'}
      </button>
    </>
  );
}
