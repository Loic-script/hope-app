/**
 * Enveloppe commune des controleurs.
 *
 * Evite de repeter un try/catch dans chaque handler : la valeur retournee
 * par l'action est envoyee en JSON, et toute erreur part vers le
 * gestionnaire centralise.
 */

/**
 * @param {(req, res) => unknown} action
 * @param {{ statut?: number }} options code HTTP en cas de succes
 */
export function gerer(action, { statut = 200 } = {}) {
  return (req, res, suite) => {
    Promise.resolve()
      .then(() => action(req, res))
      .then((resultat) => {
        // Une action qui a deja repondu elle-meme ne renvoie rien.
        if (resultat === undefined || res.headersSent) return;
        res.status(statut).json(resultat);
      })
      .catch(suite);
  };
}
