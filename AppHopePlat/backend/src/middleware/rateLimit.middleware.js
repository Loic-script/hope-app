/**
 * Limitation simple du nombre de tentatives de connexion, en memoire.
 *
 * Objectif : ralentir une attaque par force brute sur /api/admin/login.
 * Implementation volontairement minimale (une Map par processus) ; en
 * production on utiliserait un stockage partage type Redis.
 */
const tentatives = new Map();

/**
 * @param {{ fenetreMs?: number, maximum?: number }} options
 */
export function limiterTentatives({ fenetreMs = 60_000, maximum = 10 } = {}) {
  return function limiteur(req, res, next) {
    const cle = req.ip ?? 'inconnu';
    const maintenant = Date.now();
    const entree = tentatives.get(cle);

    if (!entree || maintenant > entree.expireA) {
      tentatives.set(cle, { compteur: 1, expireA: maintenant + fenetreMs });
      return next();
    }

    entree.compteur += 1;

    if (entree.compteur > maximum) {
      const secondes = Math.ceil((entree.expireA - maintenant) / 1000);
      res.set('Retry-After', String(secondes));
      return res.status(429).json({
        success: false,
        code: 'TROP_DE_TENTATIVES',
        message: `Trop de tentatives de connexion. Reessayez dans ${secondes} secondes.`,
      });
    }

    return next();
  };
}

/** Vide le compteur : utile pour les tests automatises. */
export function reinitialiserTentatives() {
  tentatives.clear();
}
