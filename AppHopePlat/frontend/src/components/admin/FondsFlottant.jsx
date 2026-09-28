import { useEffect, useState } from 'react';

import { IconeChevronBas, IconePlus, IconePoignee, IconeRecentrer } from './AdminIcons.jsx';
import { useCarteDeplacable } from '../../hooks/useCarteDeplacable.js';
import * as fmt from '../../utils/format.js';

/**
 * Le budget de HOPE, toujours sous les yeux sur l'ecran Budget.
 *
 * Une carte flottante, posee en haut a droite sous la barre, que l'on
 * deplace comme la carte des taches de l'espace benevole : par sa
 * poignee (souris, doigt, ou fleches du clavier ; Origine la remet en
 * place), et que l'on replie en une pastille. Le navigateur retient ou
 * elle a ete posee et si elle est repliee.
 *
 * Elle dit le fonds HOPE -- les dons non affectes, que l'equipe
 * repartit : ce qui est reste disponible, en grand ; ce qui a ete recu
 * et deja investi, autour d'un anneau qui montre la part engagee.
 */
const RAYON = 30;
const CIRCONFERENCE = 2 * Math.PI * RAYON;

export default function FondsFlottant({ resume, onInvestir, peutInvestir }) {
  // Sur un petit ecran, la carte commence repliee : elle ne masque pas la page.
  const [petit] = useState(() => typeof window !== 'undefined' && window.matchMedia?.('(max-width: 700px)').matches);
  // Tout entiere a l'ecran, jamais sous la barre du haut : ses boutons
  // restent toujours atteignables.
  const carte = useCarteDeplacable('hope.admin.budget-flottant', {
    reduiteParDefaut: petit,
    entiere: true,
    margeHaut: (Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--admin-entete-hauteur')) || 70) + 6,
  });
  const [pret, setPret] = useState(false);

  useEffect(() => {
    const minuterie = setTimeout(() => setPret(true), 250);
    return () => clearTimeout(minuterie);
  }, []);

  if (!resume) return null;

  const recu = Number(resume.hopeTotal ?? 0);
  const investi = Number(resume.investedTotal ?? 0);
  const disponible = Number(resume.availableTotal ?? 0);
  const part = recu > 0 ? Math.min(100, Math.round((investi * 100) / recu)) : 0;
  const trait = pret ? CIRCONFERENCE * (1 - part / 100) : CIRCONFERENCE;

  return (
    <div className="fonds-flottant">
      <div {...carte.enveloppe}>
        <section className="fonds-carte" aria-labelledby="fonds-carte-titre">
          <div className="fonds-carte__barre">
            <button
              type="button"
              className="fonds-carte__poignee"
              title="Déplacer la carte — flèches du clavier, Origine pour la remettre en place"
              aria-label="Déplacer la carte du budget de HOPE : glissez-la, ou utilisez les flèches du clavier"
              {...carte.poignee}
            >
              <IconePoignee />
            </button>
            <h2 className="fonds-carte__titre" id="fonds-carte-titre">
              Budget de HOPE
            </h2>
            {carte.reduite && (
              <span className="fonds-carte__resume" aria-label={`${fmt.montant(disponible)} disponibles`}>
                {fmt.montant(disponible)}
              </span>
            )}
            {carte.deplacee && (
              <button
                type="button"
                className="fonds-carte__action"
                onClick={carte.remettre}
                aria-label="Remettre la carte à sa place"
                title="Remettre la carte à sa place"
              >
                <IconeRecentrer />
              </button>
            )}
            <button
              type="button"
              className="fonds-carte__action fonds-carte__action--pliage"
              onClick={carte.basculerReduction}
              aria-expanded={!carte.reduite}
              aria-controls="fonds-carte-corps"
              aria-label={carte.reduite ? 'Déplier la carte' : 'Réduire la carte'}
              title={carte.reduite ? 'Déplier' : 'Réduire'}
            >
              <IconeChevronBas />
            </button>
          </div>

          <div className="fonds-carte__pliage" id="fonds-carte-corps">
            <div className="fonds-carte__corps">
              <div className="fonds-carte__tete">
                <svg className="fonds-carte__anneau" viewBox="0 0 76 76" role="img" aria-label={`${part} % du fonds investi`}>
                  <circle className="fonds-carte__piste" cx="38" cy="38" r={RAYON} />
                  <circle
                    className="fonds-carte__arc"
                    cx="38"
                    cy="38"
                    r={RAYON}
                    strokeDasharray={CIRCONFERENCE}
                    strokeDashoffset={trait}
                  />
                  <text x="38" y="42" textAnchor="middle" className="fonds-carte__taux">
                    {part} %
                  </text>
                </svg>
                <div>
                  <p className="fonds-carte__etiquette">Disponible à investir</p>
                  <p className="fonds-carte__disponible">{fmt.montant(disponible)}</p>
                </div>
              </div>

              <dl className="fonds-carte__lignes">
                <div>
                  <dt>
                    <i className="fonds-carte__puce fonds-carte__puce--recu" aria-hidden="true" />
                    Fonds reçu
                  </dt>
                  <dd>{fmt.montant(recu)}</dd>
                </div>
                <div>
                  <dt>
                    <i className="fonds-carte__puce fonds-carte__puce--investi" aria-hidden="true" />
                    Déjà investi
                  </dt>
                  <dd>{fmt.montant(investi)}</dd>
                </div>
                <div>
                  <dt>
                    <i className="fonds-carte__puce fonds-carte__puce--disponible" aria-hidden="true" />
                    Disponible
                  </dt>
                  <dd>{fmt.montant(disponible)}</dd>
                </div>
              </dl>

              <button type="button" className="fonds-carte__investir" onClick={onInvestir} disabled={!peutInvestir}>
                <IconePlus />
                Investir
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
