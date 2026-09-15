/**
 * Notifications et messages, pour tous les espaces utilisateurs.
 *
 * Le client axios est passe en parametre, et non choisi ici : l'espace
 * benevole et l'espace bailleur ont chacun le leur, avec son jeton et sa
 * cle de stockage. Deviner lequel employer d'apres l'URL de la page
 * marcherait jusqu'au jour ou une page servirait les deux.
 */

/** GET /api/espace/badges — les deux compteurs du menu. */
export async function badges(api) {
  const { data } = await api.get('/espace/badges');
  return data;
}

/** GET /api/espace/notifications */
export async function notifications(api) {
  const { data } = await api.get('/espace/notifications');
  return data.items ?? [];
}

/** PATCH /api/espace/notifications/:id/lue */
export async function marquerLue(api, id) {
  const { data } = await api.patch(`/espace/notifications/${id}/lue`);
  return data;
}

/** PATCH /api/espace/notifications/lues */
export async function marquerToutLu(api) {
  const { data } = await api.patch('/espace/notifications/lues');
  return data;
}

/**
 * GET /api/espace/messages
 *
 * L'appel eteint aussi la pastille : ouvrir la boite vaut lecture des
 * reponses, cote serveur.
 */
export async function messages(api) {
  const { data } = await api.get('/espace/messages');
  return data.items ?? [];
}

/** POST /api/espace/messages/:id/reponse — repondre dans un fil ouvert. */
export async function repondre(api, id, corps) {
  const { data } = await api.post(`/espace/messages/${id}/reponse`, { corps });
  return data.entree;
}

/** POST /api/espace/messages */
export async function envoyerMessage(api, corps) {
  const { data } = await api.post('/espace/messages', corps);
  return data.message;
}
