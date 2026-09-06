/**
 * Logotype HOPE : le "O" du mot HOPE est remplace par le soleil levant de
 * l'association, suivi de la signature "for a better life".
 */
export default function HopeLogo({ className = '' }) {
  return (
    <div className={`hope-logo ${className}`.trim()}>
      <div className="hope-logo__mot" role="img" aria-label="HOPE">
        <span className="hope-logo__lettre">H</span>

        <svg className="hope-logo__soleil" viewBox="0 0 64 64" aria-hidden="true">
          <defs>
            <linearGradient id="hope-soleil" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#F5E389" />
              <stop offset="100%" stopColor="#E09735" />
            </linearGradient>
          </defs>

          {/* Rayons du soleil */}
          <g stroke="#E09735" strokeWidth="4" strokeLinecap="round">
            <line x1="32" y1="3" x2="32" y2="12" />
            <line x1="11.5" y1="11.5" x2="17.9" y2="17.9" />
            <line x1="52.5" y1="11.5" x2="46.1" y2="17.9" />
            <line x1="3" y1="32" x2="12" y2="32" />
            <line x1="61" y1="32" x2="52" y2="32" />
            <line x1="11.5" y1="52.5" x2="17.9" y2="46.1" />
            <line x1="52.5" y1="52.5" x2="46.1" y2="46.1" />
          </g>

          {/* Disque solaire */}
          <circle cx="32" cy="32" r="13.5" fill="url(#hope-soleil)" />

          {/* Ligne d'horizon */}
          <line
            x1="10"
            y1="45.5"
            x2="54"
            y2="45.5"
            stroke="#5D5696"
            strokeWidth="4.5"
            strokeLinecap="round"
          />
        </svg>

        <span className="hope-logo__lettre">PE</span>
      </div>

      <p className="hope-logo__signature">for a better life</p>
    </div>
  );
}
