/**
 * La priorite d'une tache.
 *
 * Quatre degres, du plus pressant au moins pressant. L'equipe le choisit
 * a la creation ; la date de fin vient ensuite le rehausser -- une tache
 * "moyenne" a rendre demain presse plus qu'une "haute" a rendre dans
 * deux mois. C'est le serveur qui calcule cette urgence et ordonne les
 * listes ; ici, de quoi la nommer et la colorer.
 */

/** Du plus pressant au moins pressant : c'est aussi l'ordre des boutons. */
export const PRIORITES = [
  {
    cle: 'urgente',
    label: 'Urgente',
    aide: 'À traiter tout de suite',
    teinte: 'rouge',
  },
  {
    cle: 'haute',
    label: 'Haute',
    aide: 'Avant le reste',
    teinte: 'ambre',
  },
  {
    cle: 'moyenne',
    label: 'Moyenne',
    aide: 'Le rythme ordinaire',
    teinte: 'bleu',
  },
  {
    cle: 'simple',
    label: 'Simple',
    aide: 'Quand quelqu’un a le temps',
    teinte: 'gris',
  },
];

export const LIBELLES_PRIORITE = Object.fromEntries(
  PRIORITES.map(({ cle, label }) => [cle, label])
);

export const TEINTES_PRIORITE = Object.fromEntries(
  PRIORITES.map(({ cle, teinte }) => [cle, teinte])
);

/**
 * Ce que la date de fin ajoute, en clair.
 *
 * Le serveur en tient compte pour l'ordre ; l'ecran doit le dire, sans
 * quoi une tache "simple" en tete de liste passe pour une erreur.
 *
 * @returns {{ texte: string, pressant: boolean }|null}
 */
export function delaiRestant(dateFin, statut = null) {
  if (!dateFin || statut === 'livree') return null;

  const jour = new Date(dateFin);
  if (Number.isNaN(jour.getTime())) return null;

  const aujourdhui = new Date();
  aujourdhui.setHours(0, 0, 0, 0);
  jour.setHours(0, 0, 0, 0);

  const jours = Math.round((jour - aujourdhui) / 86_400_000);
  if (jours < 0) {
    return { texte: jours === -1 ? 'En retard d’un jour' : `En retard de ${-jours} jours`, pressant: true };
  }
  if (jours === 0) return { texte: 'À rendre aujourd’hui', pressant: true };
  if (jours === 1) return { texte: 'À rendre demain', pressant: true };
  if (jours <= 7) return { texte: `À rendre dans ${jours} jours`, pressant: jours <= 3 };
  return { texte: `À rendre dans ${jours} jours`, pressant: false };
}
