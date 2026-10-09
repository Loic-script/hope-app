export async function lister(api, racine) {
  const { data } = await api.get(`${racine}/conversations`);
  return { moi: data.moi ?? null, items: data.items ?? [], nonLus: data.nonLus ?? 0 };
}

export async function joignables(api, racine) {
  const { data } = await api.get(`${racine}/conversations/joignables`);
  return data.items ?? [];
}

export async function nonLus(api, racine) {
  const { data } = await api.get(`${racine}/conversations/non-lus`);
  return { total: data.total ?? 0, dernierFil: data.dernierFil ?? null };
}

export async function recuperer(api, racine, id) {
  const { data } = await api.get(`${racine}/conversations/${id}`);
  return data;
}

export async function marquerLu(api, racine, id, jusquAuMessage) {
  const { data } = await api.post(`${racine}/conversations/${id}/lu`, { jusquAuMessage });
  return data;
}

export async function ouvrir(api, racine, cible) {
  const { data } = await api.post(`${racine}/conversations`, { cible });
  return data.id;
}

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
    timeout: 180000,
  });
  return data.message;
}

export async function modifier(api, racine, id, messageId, corps) {
  const { data } = await api.patch(`${racine}/conversations/${id}/messages/${messageId}`, { corps });
  return data.message;
}

export async function supprimer(api, racine, id, messageId) {
  const { data } = await api.delete(`${racine}/conversations/${id}/messages/${messageId}`);
  return data.message;
}

export async function transferer(api, racine, id, messageId, cibles) {
  const { data } = await api.post(`${racine}/conversations/${id}/messages/${messageId}/transfert`, { cibles });
  return data.fils ?? [];
}

export async function fichiers(api, racine, id) {
  const { data } = await api.get(`${racine}/conversations/${id}/fichiers`);
  return data.items ?? [];
}

export async function creerGroupe(api, racine, { nom, participants, photo = null }) {
  const formulaire = new FormData();
  formulaire.append('nom', nom);
  formulaire.append('participants', JSON.stringify(participants));
  if (photo) formulaire.append('photo', photo);
  const { data } = await api.post(`${racine}/conversations/groupes`, formulaire, {
    headers: { 'Content-Type': undefined },
    timeout: 60000,
  });
  return data.id;
}

export async function ajouterAuGroupe(api, racine, id, participants) {
  const { data } = await api.post(`${racine}/conversations/${id}/participants`, { participants });
  return data.ajoutes ?? 0;
}

export async function quitterGroupe(api, racine, id) {
  const { data } = await api.post(`${racine}/conversations/${id}/quitter`);
  return data;
}

export async function depuisFiche(api, racine, cible) {
  const { data } = await api.post(`${racine}/conversations/depuis-fiche`, cible);
  return data.id;
}
