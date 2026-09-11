/**
 * Limitation du nombre de tentatives, en memoire.
 *
 * Objectif : ralentir une attaque par force brute sur les routes
 * publiques -- connexions et inscriptions. Implementation volontairement
 * minimale (une Map par processus) ; en production on utiliserait un
 * stockage partage type Redis.
 *
 * Le compteur est tenu par IP ET PAR ROUTE. Une seule cle par IP
 * faisait partager le meme compteur a toutes les routes limitees : une
 * rafale d'inscriptions bloquait alors les connexions, et chaque mont
 * voyait son "maximum" appliquer un decompte qui n'etait pas le sien.
 * Derriere un partage de connexion -- le cas courant a Madagascar --
 * une IP represente beaucoup de monde, et l'un penalisait les autres.
 */
const tentatives = new Map();

/**
 * Desactivation reservee aux suites de tests.
 *
 * Une suite enchaine des dizaines de connexions en quelques secondes et
 * se heurterait a la limite sans rien prouver. Le drapeau est ignore en
 * production : il ne peut pas y desactiver la protection, meme pose par
 * erreur.
 */
function limiteurDesactive() {
  return (
    process.env.NODE_ENV !== 'production' &&
    process.env.DESACTIVER_LIMITEUR === '1'
  );
}

/**
 * @param {{ fenetreMs?: number, maximum?: number }} options
 */
export function limiterTentatives({ fenetreMs = 60_000, maximum = 10 } = {}) {
  return function limiteur(req, res, next) {
    if (limiteurDesactive()) return next();

    // La route entre dans la cle : chaque point d'entree a son budget.
    const cle = `${req.ip ?? 'inconnu'}|${req.baseUrl}${req.route?.path ?? req.path}`;
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
        message: `Trop de tentatives. Reessayez dans ${secondes} secondes.`,
      });
    }

    return next();
  };
}

/** Vide les compteurs : utile pour les tests automatises. */
export function reinitialiserTentatives() {
  tentatives.clear();
}
