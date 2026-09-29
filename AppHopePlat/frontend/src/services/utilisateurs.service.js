/**
 * Service de l'ecran "Utilisateurs" : donateurs, benevoles, bailleurs.
 *
 * Un compte (inscrit en ligne) se designe par son UUID ; une fiche
 * donateur (saisie par l'equipe) par son numero.
 */
import { api } from './api.js';

/**
 * GET /api/admin/utilisateurs/:onglet
 * @param {'donateurs'|'benevoles'|'bailleurs'} onglet
 * @param {{ recherche?: string }} filtres
 */
export async function lister(onglet, filtres = {}) {
  const { data } = await api.get(`/admin/utilisateurs/${onglet}`, { params: filtres });
  return data;
}

/** GET /api/admin/utilisateurs/comptes/:id */
export async function profilCompte(id) {
  const { data } = await api.get(`/admin/utilisateurs/comptes/${id}`);
  return data;
}

/** GET /api/admin/utilisateurs/fiches/:id */
export async function profilFiche(id) {
  const { data } = await api.get(`/admin/utilisateurs/fiches/${id}`);
  return data;
}

/** PATCH /api/admin/utilisateurs/comptes/:id */
export async function modifierCompte(id, modifications) {
  const { data } = await api.patch(`/admin/utilisateurs/comptes/${id}`, modifications);
  return data;
}

/** DELETE /api/admin/utilisateurs/comptes/:id -- le compte passe a "supprime". */
export async function supprimerCompte(id) {
  const { data } = await api.delete(`/admin/utilisateurs/comptes/${id}`);
  return data;
}

/**
 * DELETE /api/admin/utilisateurs/fiches/:id
 *
 * Refuse tant que des dons s'y rattachent : les supprimer retirerait des
 * sommes recues par les projets. Deux issues alors :
 *   - `forcer`   : l'identite est effacee, les dons restent sans son nom ;
 *   - `avecDons` : tout part, dons compris (les totaux des projets baissent).
 */
export async function supprimerFiche(id, { forcer = false, avecDons = false } = {}) {
  const params = {};
  if (forcer) params.forcer = 1;
  if (avecDons) params.avecDons = 1;
  const { data } = await api.delete(`/admin/utilisateurs/fiches/${id}`, {
    params: Object.keys(params).length > 0 ? params : undefined,
  });
  return data;
}
