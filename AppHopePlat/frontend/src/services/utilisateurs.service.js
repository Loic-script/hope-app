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

/** DELETE /api/admin/utilisateurs/fiches/:id -- refuse si des dons s'y rattachent. */
export async function supprimerFiche(id) {
  const { data } = await api.delete(`/admin/utilisateurs/fiches/${id}`);
  return data;
}
