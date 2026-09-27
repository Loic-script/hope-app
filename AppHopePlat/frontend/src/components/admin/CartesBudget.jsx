import { useEffect, useRef, useState } from 'react';

import * as fmt from '../../utils/format.js';

/**
 * Les quatre sommes du budget, en tete de l'ecran Budget :
 *
 *   ce que HOPE a recu, ce qu'il faut aux projets, ce qui reste a
 *   trouver, ce que le fonds HOPE a deja investi.
 *
 * Chaque carte porte son chiffre (qui monte jusqu'a sa valeur), une
 * jauge qui dit ou l'on en est, et une ligne de detail. Sans animation
 * si le systeme le demande (prefers-reduced-motion).
 */

const calme = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** Un nombre qui monte de 0 a sa cible, en ralentissant a l'arrivee. */
function useCompteur(cible, duree = 1100) {
  const [valeur, setValeur] = useState(() => (calme() ? cible : 0));
  const depart = useRef(0);
  useEffect(() => {
    if (!Number.isFinite(cible)) return undefined;
    if (calme()) {
      setValeur(cible);
      return undefined;
    }
    const origine = depart.current;
    const debut = performance.now();
    let image;
    const avancer = (maintenant) => {
      const t = Math.min(1, (maintenant - debut) / duree);
      const adouci = 1 - (1 - t) ** 3;
      setValeur(origine + (cible - origine) * adouci);
      if (t < 1) image = requestAnimationFrame(avancer);
      else depart.current = cible;
    };
    image = requestAnimationFrame(avancer);
    return () => cancelAnimationFrame(image);
  }, [cible, duree]);
  return valeur;
}

const ICONES = {
  recu: (
    <>
      <path d="M12 20s-7-4.4-7-10a4 4 0 017-2.6A4 4 0 0119 10c0 5.6-7 10-7 10z" />
      <path d="M9.5 11.5h5M12 9v5" />
    </>
  ),
  necessaire: (
    <>
      <path d="M4 20h16M6 20V10M10 20V10M14 20V10M18 20V10M3 10l9-6 9 6z" />
    </>
  ),
  restant: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
  investi: (
    <>
      <path d="M4 17l5-5 4 4 7-7" />
      <path d="M15 9h5v5" />
    </>
  ),
};

/** Une carte : icone, libelle, montant anime, jauge, detail. */
function Carte({ teinte, icone, libelle, montant, devise, texte, jauge, detail, rang }) {
  const compte = useCompteur(Number(montant));
  const [pret, setPret] = useState(false);
  useEffect(() => {
    const minuterie = setTimeout(() => setPret(true), 120 + rang * 90);
    return () => clearTimeout(minuterie);
  }, [rang]);

  const affiche = texte ?? fmt.montant(Math.round(compte), devise);

  return (
    <article className={`carte-budget carte-budget--${teinte}`} style={{ '--rang': rang }}>
      <div className="carte-budget__entete">
        <span className="carte-budget__icone" aria-hidden="true">
          <svg viewBox="0 0 24 24">{ICONES[icone]}</svg>
        </span>
        <h3 className="carte-budget__libelle">{libelle}</h3>
      </div>
      <p className="carte-budget__montant">
        {/* La valeur finale pour les lecteurs d'ecran ; le compteur anime est decoratif. */}
        <span className="sr-only">{texte ?? fmt.montant(montant, devise)}</span>
        <span aria-hidden="true">{affiche}</span>
      </p>
      {jauge && (
        <div
          className="carte-budget__jauge"
          role="img"
          aria-label={jauge.libelle}
          title={jauge.libelle}
        >
          {jauge.segments.map((segment, index) => (
            <span
              key={index}
              className={`carte-budget__segment carte-budget__segment--${segment.teinte}`}
              style={{ width: pret ? `${Math.max(0, Math.min(100, segment.part))}%` : 0 }}
            />
          ))}
        </div>
      )}
      <p className="carte-budget__detail">{detail}</p>
    </article>
  );
}

/**
 * @param {object} props
 * @param {object} props.resume   l'etat du fonds (summary de /admin/fund)
 * @param {object|null} props.total le total des projets dans une seule devise, ou null
 * @param {string} props.texteNecessaire / props.texteRestant   la somme ecrite, si plusieurs devises
 * @param {number} props.nombreProjets
 */
export default function CartesBudget({ resume, total, texteNecessaire, texteRestant, nombreProjets }) {
  const recu = Number(resume?.grandTotal ?? 0);
  const affectes = Number(resume?.designatedTotal ?? 0);
  const hope = Number(resume?.hopeTotal ?? 0);
  const investi = Number(resume?.investedTotal ?? 0);
  const disponible = Number(resume?.availableTotal ?? 0);

  const necessaire = Number(total?.requiredBudget ?? 0);
  const finance = Number(total?.fundedTotal ?? 0);
  const restant = Number(total?.remainingNeed ?? 0);
  const partFinancee = necessaire > 0 ? Math.round((finance * 100) / necessaire) : 0;
  const partInvestie = hope > 0 ? Math.round((investi * 100) / hope) : 0;

  return (
    <section className="cartes-budget" aria-label="Les sommes du budget">
      <Carte
        rang={0}
        teinte="violet"
        icone="recu"
        libelle="Sommes reçues par HOPE"
        montant={recu}
        detail={`${fmt.montant(affectes)} affectés · ${fmt.montant(hope)} au fonds HOPE`}
        jauge={{
          libelle: `Dons affectés ${resume?.designatedShare ?? 0} %, fonds HOPE ${resume?.hopeShare ?? 0} %`,
          segments: [
            { teinte: 'violet', part: Number(resume?.designatedShare ?? 0) },
            { teinte: 'bleu-clair', part: Number(resume?.hopeShare ?? 0) },
          ],
        }}
      />
      <Carte
        rang={1}
        teinte="bleu"
        icone="necessaire"
        libelle="Somme nécessaire aux projets"
        montant={necessaire}
        texte={total ? null : texteNecessaire}
        detail={`${fmt.nombre(nombreProjets)} projet${nombreProjets > 1 ? 's' : ''} en cours ou terminé${nombreProjets > 1 ? 's' : ''}`}
        jauge={
          total && {
            libelle: `${partFinancee} % du budget nécessaire est financé`,
            segments: [{ teinte: 'bleu', part: partFinancee }],
          }
        }
      />
      <Carte
        rang={2}
        teinte="orange"
        icone="restant"
        libelle="Somme restante à financer"
        montant={restant}
        texte={total ? null : texteRestant}
        detail={total ? (restant > 0 ? `${partFinancee} % du budget déjà financé` : 'Tous les budgets sont couverts') : 'Budget nécessaire moins sommes reçues'}
        jauge={
          total && {
            libelle: `Il reste ${100 - partFinancee} % du budget à financer`,
            segments: [{ teinte: 'orange', part: 100 - partFinancee }],
          }
        }
      />
      <Carte
        rang={3}
        teinte="vert"
        icone="investi"
        libelle="Sommes investies"
        montant={investi}
        detail={disponible > 0 ? `${fmt.montant(disponible)} encore disponibles à investir` : 'Tout le fonds HOPE est investi'}
        jauge={{
          libelle: `${partInvestie} % du fonds HOPE est investi`,
          segments: [{ teinte: 'vert', part: partInvestie }],
        }}
      />
    </section>
  );
}
