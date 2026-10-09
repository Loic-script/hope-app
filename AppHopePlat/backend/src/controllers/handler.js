export function gerer(action, { statut = 200 } = {}) {
  return (req, res, suite) => {
    Promise.resolve()
      .then(() => action(req, res))
      .then((resultat) => {
        if (resultat === undefined || res.headersSent) return;
        res.status(statut).json(resultat);
      })
      .catch(suite);
  };
}
