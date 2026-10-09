import { config } from '../config/env.js';
import * as courriel from './courriel.service.js';

const INTERVALLE_ALERTES_MS = 15 * 60 * 1000;
let derniereAlerte = 0;
let erreursDepuis = 0;

function cheminSeul(url) {
  return String(url ?? '').split('?')[0];
}

export function journalDesRequetes(req, res, suite) {
  const debut = process.hrtime.bigint();
  res.on('finish', () => {
    const dureeMs = Number(process.hrtime.bigint() - debut) / 1e6;
    console.log(
      JSON.stringify({
        niveau: res.statusCode >= 500 ? 'erreur' : res.statusCode >= 400 ? 'attention' : 'info',
        type: 'requete',
        methode: req.method,
        chemin: cheminSeul(req.originalUrl),
        statut: res.statusCode,
        dureeMs: Math.round(dureeMs),
        date: new Date().toISOString(),
      })
    );
  });
  suite();
}

export function signalerErreur(req, erreur) {
  erreursDepuis += 1;
  const destinataire = config.surveillance?.alerteEmail || config.equipe.email;
  if (!config.enProduction || !destinataire) return;
  const maintenant = Date.now();
  if (maintenant - derniereAlerte < INTERVALLE_ALERTES_MS) return;
  const nombre = erreursDepuis;
  derniereAlerte = maintenant;
  erreursDepuis = 0;
  courriel
    .envoyer({
      a: destinataire,
      sujet: 'HOPE — erreur sur le serveur',
      titre: 'Le serveur HOPE a rencontré une erreur',
      paragraphes: [
        `Route : ${req.method} ${cheminSeul(req.originalUrl)}`,
        `Message : ${String(erreur?.message ?? erreur).slice(0, 300)}`,
        `Erreurs depuis la dernière alerte : ${nombre}.`,
        'Le détail complet est dans les journaux de Railway (Deployments → View logs).',
      ],
      note: 'Une alerte au plus par quart d’heure.',
    })
    .catch(() => {});
}
