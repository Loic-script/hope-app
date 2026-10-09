const tentatives = new Map();

function limiteurDesactive() {
  return (
    process.env.NODE_ENV !== 'production' &&
    process.env.DESACTIVER_LIMITEUR === '1'
  );
}

export function limiterTentatives({ fenetreMs = 60_000, maximum = 10 } = {}) {
  return function limiteur(req, res, next) {
    if (limiteurDesactive()) return next();

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

export function reinitialiserTentatives() {
  tentatives.clear();
}
