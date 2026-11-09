import { config } from '../config/env.js';

export function refuserEnProduction(script) {
  if (!config.enProduction) return;
  console.error(
    `[HOPE] ${script} installe des comptes de demonstration dont les mots de passe sont publics.\n` +
      '       Refuse en production (NODE_ENV=production).'
  );
  process.exit(1);
}
