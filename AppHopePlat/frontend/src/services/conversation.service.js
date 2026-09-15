/**
 * Les conversations, pour tous les espaces.
 *
 * Le client axios est passe en parametre : chaque espace a le sien, avec
 * son jeton. L'API est la meme des deux cotes -- /espace/conversations
 * pour un utilisateur, /admin/conversations pour l'equipe -- d'ou la
 * racine, elle aussi donnee par l'appelant.
 */

/** GET .../conversations — rend aussi qui je suis. */
export async function lister(api, racine) {
  const { data } = await api.get(`${racine}/conversations`);
  return { moi: data.moi ?? null, items: data.items ?? [] };
}

/** GET .../conversations/annuaire */
export async function annuaire(api, racine) {
  const { data } = await api.get(`${racine}/conversations/annuaire`);
  return data.items ?? [];
}

/** GET .../conversations/:id */
export async function recuperer(api, racine, id) {
  const { data } = await api.get(`${racine}/conversations/${id}`);
  return data;
}

/** POST .../conversations — ouvre, ou retrouve celle qui existe. */
export async function ouvrir(api, racine, destinataire, corps) {
  const { data } = await api.post(`${racine}/conversations`, { destinataire, corps });
  return data.id;
}

/** POST .../conversations/:id/messages */
export async function ecrire(api, racine, id, corps) {
  const { data } = await api.post(`${racine}/conversations/${id}/messages`, { corps });
  return data.message;
}
