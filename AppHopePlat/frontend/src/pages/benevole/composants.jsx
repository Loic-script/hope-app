export const STATUTS_TACHE = {
  a_faire: 'À faire',
  en_cours: 'En cours',
  livree: 'Livrée',
};

export function Pastille({ valeur, libelles, teinte }) {
  return (
    <span className={`pastille pastille--${teinte ?? 'gris'}`}>
      {libelles?.[valeur] ?? valeur}
    </span>
  );
}

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
