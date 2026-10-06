/**
 * Le formulaire de contact du site vitrine (contact.service).
 */
import * as contactService from '../services/contact.service.js';
import { gerer } from './handler.js';

export const options = gerer(() => contactService.options());

export const envoyer = gerer((req) => contactService.envoyer(req.body), { statut: 201 });
