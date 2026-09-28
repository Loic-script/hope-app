/**
 * Vignette d'une preuve terrain, cote back-office.
 *
 * L'affichage vit avec les autres composants de lecture ; il ne reste
 * ici que le chargeur, qui va chercher le fichier derriere le jeton de
 * l'administration.
 *
 * Partagee entre l'ecran Preuves terrain et l'onglet Impact de la fiche
 * projet, qui montrent les memes lignes.
 */
import { Vignette } from '../preuves/MediasPreuve.jsx';
import * as fieldProofService from '../../services/fieldProof.service.js';

export default function VignettePreuve({ preuve }) {
  return <Vignette preuve={preuve} charger={fieldProofService.urlDuFichier} />;
}
