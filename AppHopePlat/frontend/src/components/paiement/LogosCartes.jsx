/**
 * Les marques des reseaux acceptes, dessinees petites, comme dans le
 * champ du numero d'une caisse en ligne. Le reseau reconnu reste en
 * couleur, les autres s'effacent.
 *
 * @param {{ actif?: string|null }} props  la cle du reseau reconnu
 */
export default function LogosCartes({ actif = null }) {
  const classe = (cle) => `logos-cartes__logo${actif && actif !== cle ? ' logos-cartes__logo--efface' : ''}`;
  return (
    <span className="logos-cartes" aria-hidden="true">
      <svg className={classe('visa')} viewBox="0 0 38 24">
        <rect width="38" height="24" rx="3" fill="#fff" stroke="#d9d9e3" />
        <text x="19" y="16.2" textAnchor="middle" fontFamily="Arial, sans-serif" fontSize="10.5" fontStyle="italic" fontWeight="900" fill="#1a1f71">
          VISA
        </text>
      </svg>
      <svg className={classe('mastercard')} viewBox="0 0 38 24">
        <rect width="38" height="24" rx="3" fill="#252525" />
        <circle cx="15" cy="12" r="7" fill="#eb001b" />
        <circle cx="23" cy="12" r="7" fill="#f79e1b" />
        <path d="M19 6.4a7 7 0 010 11.2 7 7 0 010-11.2z" fill="#ff5f00" />
      </svg>
      <svg className={classe('amex')} viewBox="0 0 38 24">
        <rect width="38" height="24" rx="3" fill="#1f72cd" />
        <text x="19" y="15.4" textAnchor="middle" fontFamily="Arial, sans-serif" fontSize="7.4" fontWeight="900" fill="#fff" letterSpacing="0.4">
          AMEX
        </text>
      </svg>
      <svg className={classe('jcb')} viewBox="0 0 38 24">
        <rect width="38" height="24" rx="3" fill="#fff" stroke="#d9d9e3" />
        <rect x="7" y="5" width="8" height="14" rx="2.5" fill="#0e4c96" />
        <rect x="15" y="5" width="8" height="14" rx="2.5" fill="#e21836" />
        <rect x="23" y="5" width="8" height="14" rx="2.5" fill="#00a14e" />
        <text x="19" y="14.6" textAnchor="middle" fontFamily="Arial, sans-serif" fontSize="6.6" fontWeight="900" fill="#fff">
          JCB
        </text>
      </svg>
    </span>
  );
}

/** Le dos d'une carte, son cryptogramme en evidence : l'icone du CVC. */
export function IconeCvc() {
  return (
    <svg className="icone-cvc" viewBox="0 0 30 20" aria-hidden="true">
      <rect x="0.75" y="0.75" width="28.5" height="18.5" rx="2.5" fill="#fff" stroke="#1a1a1f" strokeWidth="1.5" />
      <rect x="0.75" y="3.5" width="28.5" height="3.5" fill="#1a1a1f" />
      <rect x="4" y="10" width="14" height="4" rx="1" fill="#e6e6ec" />
      <text x="24" y="16.2" textAnchor="middle" fontFamily="Arial, sans-serif" fontSize="6" fontWeight="700" fill="#1a1a1f">
        123
      </text>
    </svg>
  );
}
