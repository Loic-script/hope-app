/**
 * La messagerie, pour tous les espaces.
 *
 * Le client axios est passe en parametre : chaque espace a le sien, avec
 * son jeton. L'API est la meme des deux cotes -- /espace/conversations
 * pour un utilisateur, /admin/conversations pour l'equipe -- d'ou la
 * racine, elle aussi donnee par l'appelant.
 */

/** GET .../conversations : les fils, qui je suis, et le total des non-lus. */
export async function lister(api, racine) {
  const { data } = await api.get(`${racine}/conversations`);
  return { moi: data.moi ?? null, items: data.items ?? [], nonLus: data.nonLus ?? 0 };
}

/** GET .../conversations/joignables */
export async function joignables(api, racine) {
  const { data } = await api.get(`${racine}/conversations/joignables`);
  return data.items ?? [];
}

/** GET .../conversations/non-lus : le total, et le fil du plus recent. */
export async function nonLus(api, racine) {
  const { data } = await api.get(`${racine}/conversations/non-lus`);
  return { total: data.total ?? 0, dernierFil: data.dernierFil ?? null };
}

/** GET .../conversations/:id : le fil et ses messages. Ne marque rien comme lu. */
export async function recuperer(api, racine, id) {
  const { data } = await api.get(`${racine}/conversations/${id}`);
  return data;
}

/** POST .../conversations/:id/lu : lu jusqu'au dernier message affiche. */
export async function marquerLu(api, racine, id, jusquAuMessage) {
  const { data } = await api.post(`${racine}/conversations/${id}/lu`, { jusquAuMessage });
  return data;
}

/** POST .../conversations : ouvre le fil avec une personne, ou retrouve celui qui existe. */
export async function ouvrir(api, racine, cible) {
  const { data } = await api.post(`${racine}/conversations`, { cible });
  return data.id;
}

/**
 * POST .../conversations/:id/messages
 *
 * Sans piece jointe, un simple JSON. Avec, un formulaire multipart : on
 * laisse alors le navigateur ecrire l'en-tete et sa frontiere -- le client
 * pose "application/json" par defaut, et multer ne trouverait rien a lire.
 */
export async function envoyer(api, racine, id, { corps, fichiers = [] }) {
  if (fichiers.length === 0) {
    const { data } = await api.post(`${racine}/conversations/${id}/messages`, { corps });
    return data.message;
  }

  const formulaire = new FormData();
  formulaire.append('corps', corps ?? '');
  for (const fichier of fichiers) formulaire.append('files', fichier);

  const { data } = await api.post(`${racine}/conversations/${id}/messages`, formulaire, {
    headers: { 'Content-Type': undefined },
    // Cinq videos de 25 Mo ne partent pas en dix secondes sur une ligne lente.
    timeout: 180000,
  });
  return data.message;
}

/** PATCH .../conversations/:id/messages/:messageId */
export async function modifier(api, racine, id, messageId, corps) {
  const { data } = await api.patch(`${racine}/conversations/${id}/messages/${messageId}`, { corps });
  return data.message;
}

/** DELETE .../conversations/:id/messages/:messageId */
export async function supprimer(api, racine, id, messageId) {
  const { data } = await api.delete(`${racine}/conversations/${id}/messages/${messageId}`);
  return data.message;
}

/**
 * POST .../conversations/:id/messages/:messageId/transfert
 *
 * @param {({type: 'fil', id: number} | {type: string, id: string})[]} cibles
 * @returns {Promise<number[]>} les fils ou le message est arrive
 */
export async function transferer(api, racine, id, messageId, cibles) {
  const { data } = await api.post(`${racine}/conversations/${id}/messages/${messageId}/transfert`, { cibles });
  return data.fils ?? [];
}
