import type { RequestHandler } from 'express';
import type { ZodType } from 'zod';

/**
 * Validation des entrees HTTP.
 *
 * Le controleur ne valide QUE la forme (champs presents, types, formats).
 * Les regles metier — montant affectable, transition de statut autorisee,
 * budget disponible — restent entierement dans les services : les dupliquer
 * ici garantirait qu'elles divergent un jour.
 */

export function validateBody<T>(schema: ZodType<T>): RequestHandler {
  return (req, _res, next) => {
    // parse leve une ZodError, transformee en 400 par le gestionnaire d'erreurs.
    req.body = schema.parse(req.body);
    next();
  };
}

export function validateQuery<T>(schema: ZodType<T>): RequestHandler {
  return (req, res, next) => {
    // Express 5 rend req.query en lecture seule : on stocke le resultat
    // valide sur res.locals plutot que de reecrire la requete.
    res.locals['query'] = schema.parse(req.query);
    next();
  };
}

/** Recupere la query validee posee par validateQuery. */
export function getQuery<T>(res: { locals: Record<string, unknown> }): T {
  return res.locals['query'] as T;
}

/**
 * Lit un parametre d'URL en chaine simple.
 *
 * Express 5 type les parametres en `string | string[]` car un motif de route
 * peut en capturer plusieurs. Nos routes n'en attendent qu'un : ce lecteur
 * evite d'eparpiller la meme verification dans chaque controleur.
 */
export function readParam(
  params: Record<string, string | string[] | undefined>,
  name: string,
): string {
  const value = params[name];
  if (Array.isArray(value)) return (value[0] ?? '').trim();
  return (value ?? '').trim();
}
