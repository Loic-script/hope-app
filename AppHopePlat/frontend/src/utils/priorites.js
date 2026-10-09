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
