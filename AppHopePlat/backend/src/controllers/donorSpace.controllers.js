/**
 * Espace donateur. req.donateur est pose par authenticateDonor.
 */
import * as donorProfileService from '../services/donorProfile.service.js';
import * as donorSpaceService from '../services/donorSpace.service.js';
import * as mediaService from '../services/media.service.js';
import { gerer } from './handler.js';

export const profil = {
  recuperer: gerer((req) => donorProfileService.recuperer(req.donateur.id)),
  enregistrerEtape1: gerer((req) =>
    donorProfileService.enregistrerEtape1(req.donateur.id, req.body)
  ),
  enregistrerEtape2: gerer((req) =>
    donorProfileService.enregistrerEtape2(req.donateur.id, req.body)
  ),
  enregistrerEtape3: gerer((req) =>
    donorProfileService.enregistrerEtape3(req.donateur.id, req.body)
  ),
  enregistrerEtape4: gerer((req) =>
    donorProfileService.enregistrerEtape4(req.donateur.id, req.body)
  ),
  enregistrerEtape5: gerer((req) =>
    donorProfileService.enregistrerEtape5(req.donateur.id, req.body)
  ),
  projets: gerer(async () => ({ items: await donorProfileService.projetsProposes() })),
  projet: gerer((req) => donorSpaceService.projet(req.donateur.id, req.params.id)),
  // La photo : televersee ici, rattachee par PATCH /profil/photo.
  televerserPhoto: gerer((req) => mediaService.enregistrer(req.file), { statut: 201 }),
  changerPhoto: gerer((req) => donorSpaceService.changerPhoto(req.donateur.id, req.body)),
};

/** Ses dons, et un nouveau don -- une promesse, confirmee a reception. */
export const dons = {
  lister: gerer((req) => donorSpaceService.mesDons(req.donateur.id)),
  faire: gerer((req) => donorSpaceService.faireUnDon(req.donateur, req.body), { statut: 201 }),
};

/** Les nouvelles de HOPE. */
export const actualites = {
  lister: gerer(() => donorSpaceService.actualites()),
};
