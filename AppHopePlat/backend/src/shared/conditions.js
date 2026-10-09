export const VERSION_CONDITIONS = '2026-09-25';

export function verifierConsentement(corps, details) {
  if (corps?.accepteConditions !== true) {
    details.accepteConditions = 'Acceptez les conditions d’utilisation et la politique de confidentialité';
  }
}
