import * as lettreActualites from '../services/lettreActualites.service.js';
import { gerer } from './handler.js';

export const etat = gerer((req) => lettreActualites.etat(req.utilisateurId));

export const choisir = gerer((req) => lettreActualites.choisir(req.utilisateurId, req.body ?? {}));

export const desinscrire = gerer((req) => lettreActualites.desinscrire({ jeton: req.query.jeton ?? req.body?.jeton }));
