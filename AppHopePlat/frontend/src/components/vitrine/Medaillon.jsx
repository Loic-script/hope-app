/**
 * Le medaillon des sections du site : un anneau jaune sur un disque
 * blanc, l'icone au centre, et le soleil autour. Trois variantes,
 * relevees sur les maquettes, l'anneau exterieur (R = 28,5) pris pour
 * unite :
 *   - `couronne` (raison d'etre, vision) : anneau de 0,155 R, huit traits
 *     tous les 30 degres de 1,26 a 1,67 R, le quart bas-droit libre du
 *     cote de la carte ;
 *   - `rayons` (mission) : anneau de 0,126 R, trois rayons de 1,2 a 2 R
 *     larges de 0,3 R, le boitier grandi vers le haut pour les contenir ;
 *   - `eventail` (s'engager) : anneau de 0,155 R, cinq rayons de 1,3 a
 *     1,7 R tous les 30 degres, sur le haut seulement.
 *
 * Le disque blanc va jusqu'au depart des traits (1,26 R) : pose sur une
 * carte, il en creuse le coin ou le bord ; pose sur la ligne de la
 * mission, il l'interrompt.
 *
 * L'icone est soit un dessin (children, reduit par `echelle`), soit un
 * fichier fourni par HOPE (`image` : { src, largeur, hauteur }).
 *
 * Les styles (.v-medaillon) sont dans vitrine-decouvrir.css.
 */
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
            ) : variante === 'eventail' ? (
              [0, -30, 30, -60, 60].map((angle) => (
                <rect
                  key={angle}
                  x="-2.3"
                  y="-48.5"
                  width="4.6"
                  height="11.5"
                  rx="2.3"
                  transform={angle === 0 ? undefined : `rotate(${angle})`}
                />
              ))
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
