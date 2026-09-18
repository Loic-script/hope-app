/**
 * Espace donateur. req.donateur est pose par authenticateDonor.
 */
import * as donorProfileService from '../services/donorProfile.service.js';
import { gerer } from './handler.js';

export const profil = {
  recuperer: gerer((req) => donorProfileService.recuperer(req.donateur.id)),
  enregistrerEtape1: gerer((req) =>
    donorProfileService.enregistrerEtape1(req.donateur.id, req.body)
  ),
  enregistrerEtape2: gerer((req) =>
    donorProfileService.enregistrerEtape2(req.donateur.id, req.body)
  ),
};
