export async function badges(api) {
  const { data } = await api.get('/espace/badges');
  return data;
}

export async function notifications(api) {
  const { data } = await api.get('/espace/notifications');
  return data.items ?? [];
}

export async function marquerLue(api, id) {
  const { data } = await api.patch(`/espace/notifications/${id}/lue`);
  return data;
}

export async function marquerToutLu(api) {
  const { data } = await api.patch('/espace/notifications/lues');
  return data;
}

export async function messages(api) {
  const { data } = await api.get('/espace/messages');
  return data.items ?? [];
}

export async function repondre(api, id, corps) {
  const { data } = await api.post(`/espace/messages/${id}/reponse`, { corps });
  return data.entree;
}

export async function envoyerMessage(api, corps) {
  const { data } = await api.post('/espace/messages', corps);
  return data.message;
}
