import { config } from '../config/env.js';
import { envoyer, verifierEnvoi } from '../services/courriel.service.js';

const destinataire = process.argv[2] || config.equipe.email || config.smtp.user;

console.log(`[HOPE] Serveur SMTP : ${config.smtp.host || '(aucun)'}:${config.smtp.port}`);
console.log(`[HOPE] Identifiant  : ${config.smtp.user || '(vide)'}`);
console.log(`[HOPE] Expediteur   : ${config.smtp.from}`);

const { pret, raison } = await verifierEnvoi();
if (!pret) {
  console.error(`[HOPE] Connexion refusee : ${raison}`);
  process.exit(1);
}
console.log('[HOPE] Connexion SMTP etablie.');

if (!destinataire) {
  console.error('[HOPE] Indiquez une adresse : npm run courriel:essai -- vous@exemple.com');
  process.exit(1);
}

const parti = await envoyer({
  a: destinataire,
  sujet: 'HOPE — courriel d’essai',
  titre: 'Les courriels de HOPE fonctionnent.',
  paragraphes: [
    'Ce message confirme que la plateforme HOPE peut envoyer des courriels.',
    'Les donateurs, bénévoles et bailleurs recevront désormais leurs confirmations et leurs reçus.',
  ],
});
console.log(parti ? `[HOPE] Courriel d'essai envoye a ${destinataire}.` : "[HOPE] Le courriel d'essai n'est pas parti.");
process.exit(parti ? 0 : 1);
