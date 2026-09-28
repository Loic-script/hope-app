/**
 * Le consentement a l'inscription.
 *
 * Un compte ne s'ouvre qu'une fois les conditions d'utilisation et la
 * politique de confidentialite acceptees. La base garde la date et la
 * version acceptee : si les textes changent, on sait qui a accepte quoi.
 *
 * La version suit la date de publication des textes ; le frontend
 * affiche la meme (frontend/src/pages/Legal.jsx).
 */
export const VERSION_CONDITIONS = '2026-09-25';

/** Ajoute l'erreur au formulaire si la case n'est pas cochee. */
export function verifierConsentement(corps, details) {
  if (corps?.accepteConditions !== true) {
    details.accepteConditions = 'Acceptez les conditions d’utilisation et la politique de confidentialité';
  }
}

