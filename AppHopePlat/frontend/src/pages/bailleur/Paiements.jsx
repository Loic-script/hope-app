import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { useChargement } from '../../hooks/useChargement.js';
import * as service from '../../services/bailleur.service.js';
import * as fmt from '../../utils/format.js';
import { EntetePage, Pastille } from './composants.jsx';

/**
 * Paiements effectues : ce que le bailleur a paye a HOPE.
 *
 * Deux sources dans une meme liste : les dons faits depuis l'espace
 * ("Faire un don") et les versements des conventions de l'organisation.
 * Les totaux se lisent par devise ; un paiement en attente (don promis,
 * tranche prevue) se compte a part, jamais dans le paye.
 */
const FILTRES = [
  { cle: 'recu', libelle: 'Effectués' },
  { cle: 'en_attente', libelle: 'En attente' },
  { cle: 'tous', libelle: 'Tous' },
];

const SOURCES = { don: 'Don en ligne', convention: 'Convention' };

function IconeRecu() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 3.5h12v17l-2-1.3-2 1.3-2-1.3-2 1.3-2-1.3-2 1.3z" />
      <path d="M9 9h6M9 12.5h6" />
    </svg>
  );
}

function IconeSablier() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7 3.5h10M7 20.5h10M8 3.5c0 4 8 5 8 8.5s-8 4.5-8 8.5M16 3.5c0 4-8 5-8 8.5s8 4.5 8 8.5" />
    </svg>
  );
}

export default function Paiements() {
  const { donnees, chargement, erreur } = useChargement(() => service.paiements(), []);
  const [filtre, setFiltre] = useState('recu');

  const items = useMemo(() => donnees?.items ?? [], [donnees]);
  const synthese = donnees?.synthese;
  const affiches = useMemo(
    () => (filtre === 'tous' ? items : items.filter((p) => p.etat === filtre)),
    [items, filtre]
  );
  const compte = {
    recu: synthese?.nombrePayes ?? 0,
    en_attente: synthese?.nombreEnAttente ?? 0,
    tous: items.length,
  };

  if (chargement && !donnees) return <p className="vide-bailleur">Chargement de vos paiements…</p>;
  if (erreur) return <p className="alerte-bailleur">{erreur}</p>;

  const totaux = synthese?.totaux ?? [];
  const principal = totaux[0] ?? { devise: 'MGA', paye: '0', enAttente: '0' };

  return (
    <div className="paiements">
      <EntetePage
        titre="Paiements effectués"
        accroche="Ce que vous avez versé à HOPE : vos dons faits depuis l’espace et les versements de vos conventions."
        actions={
          <Link className="bouton-bailleur" to="/bailleur/faire-un-don">
            Faire un don
          </Link>
        }
      />

      <div className="kpi paiements__kpi">
        <article className="kpi__carte kpi__carte--vert paiements__carte" style={{ '--rang': 0 }}>
          <p className="kpi__libelle">Total payé</p>
          <p className="kpi__valeur">{fmt.montant(principal.paye, principal.devise)}</p>
          {totaux.length > 1 && (
            <p className="kpi__note">
              et{' '}
              {totaux
                .slice(1)
                .map((t) => fmt.montant(t.paye, t.devise))
                .join(' · ')}
            </p>
          )}
        </article>
        <article className="kpi__carte kpi__carte--violet paiements__carte" style={{ '--rang': 1 }}>
          <p className="kpi__libelle">Paiements effectués</p>
          <p className="kpi__valeur">{fmt.nombre(compte.recu)}</p>
          <p className="kpi__note">
            {synthese?.dernierPaiement ? `Dernier le ${fmt.date(synthese.dernierPaiement)}` : 'Aucun pour l’instant'}
          </p>
        </article>
        <article className="kpi__carte kpi__carte--orange paiements__carte" style={{ '--rang': 2 }}>
          <p className="kpi__libelle">En attente</p>
          <p className="kpi__valeur">{fmt.montant(principal.enAttente, principal.devise)}</p>
          <p className="kpi__note">
            {compte.en_attente} paiement{compte.en_attente > 1 ? 's' : ''} à confirmer par HOPE
          </p>
        </article>
      </div>

      <section className="panneau-bailleur">
        <div className="paiements__filtres" role="group" aria-label="Filtrer les paiements">
          {FILTRES.map((f) => (
            <button
              key={f.cle}
              type="button"
              className={`paiements__filtre${filtre === f.cle ? ' paiements__filtre--actif' : ''}`}
              aria-pressed={filtre === f.cle}
              onClick={() => setFiltre(f.cle)}
            >
              {f.libelle}
              <span className="paiements__compte">{compte[f.cle]}</span>
            </button>
          ))}
        </div>

        {affiches.length === 0 ? (
          <p className="vide-bailleur">
            {filtre === 'en_attente'
              ? 'Aucun paiement en attente.'
              : 'Aucun paiement effectué à ce jour. Vos dons et les versements de vos conventions apparaîtront ici.'}
          </p>
        ) : (
          <ul className="paiements__liste">
            {affiches.map((p, rang) => (
              <li
                key={p.id}
                className={`paiement paiement--${p.etat}`}
                style={{ '--rang': Math.min(rang, 10) }}
              >
                <span className="paiement__icone" aria-hidden="true">
                  {p.etat === 'recu' ? <IconeRecu /> : <IconeSablier />}
                </span>
                <div className="paiement__corps">
                  <p className="paiement__libelle">
                    {p.projetId ? <Link to={`/bailleur/projets/${p.projetId}`}>{p.libelle}</Link> : p.libelle}
                  </p>
                  <p className="paiement__meta">
                    {SOURCES[p.source]}
                    {p.tranche && ` · Tranche ${p.tranche}`}
                    {p.moyen && ` · ${p.moyen}`}
                    {p.reference && ` · ${p.reference}`}
                  </p>
                </div>
                <div className="paiement__droite">
                  <strong className="paiement__montant">{fmt.montant(p.montant, p.devise)}</strong>
                  <span className="paiement__date">
                    <Pastille teinte={p.etat === 'recu' ? 'vert' : p.enRetard ? 'ambre' : 'gris'}>
                      {p.etat === 'recu' ? 'Payé' : p.enRetard ? 'En retard' : 'En attente'}
                    </Pastille>
                    {p.date &&
                      (p.etat === 'recu'
                        ? fmt.date(p.date)
                        : `${p.source === 'don' ? 'promis' : 'prévu'} le ${fmt.date(p.date)}`)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
