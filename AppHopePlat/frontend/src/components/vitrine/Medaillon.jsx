export default function Medaillon({ children, image = null, variante = 'couronne', echelle = 1, className = '' }) {
  const rayons = variante === 'rayons';
  return (
    <span className={`v-medaillon v-medaillon--${variante} ${className}`.trim()} aria-hidden="true">
      <svg className="v-medaillon__soleil" viewBox={rayons ? '-50 -60 100 110' : '-50 -50 100 100'}>
        <g className="v-medaillon__rayons">
          <g className="v-medaillon__rayons-vif">
            {rayons ? (
              <>
                <rect x="-4.15" y="-57" width="8.3" height="22.8" rx="4.15" />
                <rect x="-4.3" y="-58.1" width="8.6" height="21.6" rx="4.3" transform="rotate(-48.7)" />
                <rect x="-4.3" y="-58.1" width="8.6" height="21.6" rx="4.3" transform="rotate(48.7)" />
              </>
            ) : (
              <>
                <rect x="-2.3" y="-47.6" width="4.6" height="11.7" rx="2.3" />
                <rect x="-2.3" y="-47.6" width="4.6" height="11.7" rx="2.3" transform="rotate(30)" />
                <rect x="-2.3" y="-47.6" width="4.6" height="11.7" rx="2.3" transform="rotate(60)" />
                <rect x="-2.3" y="-47.6" width="4.6" height="11.7" rx="2.3" transform="rotate(210)" />
                <rect x="-2.3" y="-47.6" width="4.6" height="11.7" rx="2.3" transform="rotate(240)" />
                <rect x="-2.3" y="-47.6" width="4.6" height="11.7" rx="2.3" transform="rotate(270)" />
                <rect x="-2.3" y="-47.6" width="4.6" height="11.7" rx="2.3" transform="rotate(300)" />
                <rect x="-2.3" y="-47.6" width="4.6" height="11.7" rx="2.3" transform="rotate(330)" />
              </>
            )}
          </g>
        </g>
        <circle className="v-medaillon__halo" r="36.5" />
        <circle className="v-medaillon__anneau" r={rayons ? 26.7 : 26.3} strokeWidth={rayons ? 3.6 : 4.4} />
        <g className="v-medaillon__icone">
          {image ? (
            <image href={image.src} x={-image.largeur / 2} y={-image.hauteur / 2} width={image.largeur} height={image.hauteur} />
          ) : (
            <g transform={echelle === 1 ? undefined : `scale(${echelle})`}>{children}</g>
          )}
        </g>
      </svg>
    </span>
  );
}
