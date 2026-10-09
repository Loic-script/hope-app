import { query } from '../config/database.js';
import { versObjet } from '../shared/mapping.js';

export async function garantir(utilisateurId, client = null) {
  await query(
    `INSERT INTO donateur (utilisateur_id) VALUES ($1)
     ON CONFLICT (utilisateur_id) DO NOTHING`,
    [utilisateurId],
    client
  );
}

export async function trouver(utilisateurId, client = null) {
  const resultat = await query(
    `SELECT u.nom, u.prenom, u.adresse, u.telephone, u.email, u.photo_url, u.cree_le,
            d.ville, d.pays, d.profession, d.source_connaissance,
            d.type_donateur, d.nom_structure, d.site_web, d.devise,
            d.langue, d.fuseau_horaire,
            d.affectation, d.projet_id, d.mode_paiement, d.frequence,
            d.etape_suivante
       FROM utilisateur u
       JOIN donateur d ON d.utilisateur_id = u.id
      WHERE u.id = $1`,
    [utilisateurId],
    client
  );
  return versObjet(resultat.rows[0]);
}

export async function enregistrerEtape1(utilisateurId, donnees, client = null) {
  await query(
    `UPDATE utilisateur
        SET nom = $2, prenom = $3, adresse = $4, telephone = $5
      WHERE id = $1`,
    [utilisateurId, donnees.nom, donnees.prenom, donnees.adresse, donnees.telephone],
    client
  );
  await query(
    `UPDATE donateur
        SET ville = $2, pays = $3, profession = $4, source_connaissance = $5,
            etape_suivante = GREATEST(etape_suivante, 2),
            mis_a_jour_le = NOW()
      WHERE utilisateur_id = $1`,
    [utilisateurId, donnees.ville, donnees.pays, donnees.profession, donnees.source],
    client
  );
}

export async function enregistrerEtape2(utilisateurId, donnees, client = null) {
  await query(
    `UPDATE donateur
        SET type_donateur = $2, nom_structure = $3, site_web = $4,
            devise = $5, langue = $6, fuseau_horaire = $7,
            etape_suivante = GREATEST(etape_suivante, 3),
            mis_a_jour_le = NOW()
      WHERE utilisateur_id = $1`,
    [
      utilisateurId,
      donnees.type,
      donnees.nomStructure,
      donnees.siteWeb,
      donnees.devise,
      donnees.langue,
      donnees.fuseau,
    ],
    client
  );
}

export async function enregistrerEtape3(utilisateurId, donnees, client = null) {
  await query(
    `UPDATE donateur
        SET affectation = $2, projet_id = $3,
            etape_suivante = GREATEST(etape_suivante, 4),
            mis_a_jour_le = NOW()
      WHERE utilisateur_id = $1`,
    [utilisateurId, donnees.affectation, donnees.projetId],
    client
  );
}

export async function enregistrerEtape4(utilisateurId, modePaiement, client = null) {
  await query(
    `UPDATE donateur
        SET mode_paiement = $2,
            etape_suivante = GREATEST(etape_suivante, 5),
            mis_a_jour_le = NOW()
      WHERE utilisateur_id = $1`,
    [utilisateurId, modePaiement],
    client
  );
}

export async function enregistrerEtape5(utilisateurId, frequence, client = null) {
  await query(
    `UPDATE donateur
        SET frequence = $2, etape_suivante = 6, mis_a_jour_le = NOW()
      WHERE utilisateur_id = $1`,
    [utilisateurId, frequence],
    client
  );
  await query('UPDATE utilisateur SET profil_complete = TRUE WHERE id = $1', [utilisateurId], client);
}
