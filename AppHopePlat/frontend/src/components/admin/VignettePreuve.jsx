import { Vignette } from '../preuves/MediasPreuve.jsx';
import * as fieldProofService from '../../services/fieldProof.service.js';

export default function VignettePreuve({ preuve }) {
  return <Vignette preuve={preuve} charger={fieldProofService.urlDuFichier} />;
}
