/**
 * Service de l'espace donateur.
 *
 * Tout passe par apiDonateur : son jeton ne vaut que pour cet espace.
 */
import { apiDonateur } from './apiDonateur.js';

/**
 * GET /api/donateur/profil
 *
 * La fiche, l'etape ou reprendre le parcours d'accueil, et les listes
 * dont le formulaire a besoin.
 */
export async function recupererProfil() {
  const { data } = await apiDonateur.get('/donateur/profil');
  return data;
}

/** PUT /api/donateur/profil/etape-2 : le profil et les preferences. */
export async function enregistrerEtape2(profil) {
  const { data } = await apiDonateur.put('/donateur/profil/etape-2', profil);
  return data;
}

/** PUT /api/donateur/profil/etape-1 : les informations personnelles. */
export async function enregistrerEtape1(informations) {
  const { data } = await apiDonateur.put('/donateur/profil/etape-1', informations);
  return data;
}
