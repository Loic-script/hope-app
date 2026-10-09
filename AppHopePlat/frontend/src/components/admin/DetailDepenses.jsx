import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { Tableau } from './ui.jsx';
import * as fmt from '../../utils/format.js';

const PAR_PAGE = 8;

const enCentimes = (valeur) => Math.round(Number(valeur ?? 0) * 100);

export default function DetailDepenses({ depenses, chargement, sommesRecues }) {
  const [recherche, setRecherche] = useState('');
  const [projet, setProjet] = useState('');
  const [visibles, setVisibles] = useState(PAR_PAGE);
  const [pret, setPret] = useState(false);

  useEffect(() => {
    const minuterie = setTimeout(() => setPret(true), 150);
    return () => clearTimeout(minuterie);
  }, []);

  const valides = useMemo(() => (depenses ?? []).filter((d) => d.status !== 'CANCELLED'), [depenses]);

  const projets = useMemo(() => {
    const vus = new Map();
    for (const d of valides) vus.set(String(d.projectId), d.projectName);
    return [...vus.entries()].sort((a, b) => a[1].localeCompare(b[1], 'fr'));
  }, [valides]);

  const filtrees = useMemo(() => {
    const mot = recherche.trim().toLowerCase();
    return valides.filter(
      (d) =>
        (!projet || String(d.projectId) === projet) &&
        (!mot ||
          [d.description, d.supplier, d.category, d.projectName].some((champ) => String(champ ?? '').toLowerCase().includes(mot)))
    );
  }, [valides, projet, recherche]);

  const devises = [...new Set(filtrees.map((d) => d.currency ?? 'MGA'))];
  const devise = devises.length <= 1 ? devises[0] ?? 'MGA' : null;
  const totalCentimes = filtrees.reduce((s, d) => s + enCentimes(d.amount), 0);
  const sansJustificatif = filtrees.filter((d) => !Number(d.documentsCount)).length;

  const categories = useMemo(() => {
    const parCategorie = new Map();
    for (const d of filtrees) {
      const cle = d.category || 'Sans catégorie';
      parCategorie.set(cle, (parCategorie.get(cle) ?? 0) + enCentimes(d.amount));
    }
    return [...parCategorie.entries()].map(([nom, centimes]) => ({ nom, centimes })).sort((a, b) => b.centimes - a.centimes);
  }, [filtrees]);
  const plusGrande = categories[0]?.centimes ?? 0;

  useEffect(() => setVisibles(PAR_PAGE), [recherche, projet]);

  const partRecue =
    devise && !projet && Number(sommesRecues) > 0 ? Math.round((totalCentimes / 100 / Number(sommesRecues)) * 100) : null;

  return (
    <div className="depenses-budget">
      <div className="depenses-budget__chiffres">
        <div className="depenses-budget__chiffre">
          <span className="depenses-budget__etiquette">Total dépensé</span>
          <strong>{devise ? fmt.montant(totalCentimes / 100, devise) : 'Plusieurs devises'}</strong>
          {partRecue !== null && <span className="depenses-budget__note">{partRecue} % des sommes reçues par les projets</span>}
        </div>
        <div className="depenses-budget__chiffre">
          <span className="depenses-budget__etiquette">Dépenses</span>
          <strong>{fmt.nombre(filtrees.length)}</strong>
          <span className="depenses-budget__note">
            sur {fmt.nombre(new Set(filtrees.map((d) => d.projectId)).size)} projet
            {new Set(filtrees.map((d) => d.projectId)).size > 1 ? 's' : ''}
          </span>
        </div>
        <div className={`depenses-budget__chiffre${sansJustificatif > 0 ? ' depenses-budget__chiffre--alerte' : ''}`}>
          <span className="depenses-budget__etiquette">Sans justificatif</span>
          <strong>{fmt.nombre(sansJustificatif)}</strong>
          <span className="depenses-budget__note">{sansJustificatif > 0 ? 'facture ou reçu à joindre' : 'toutes sont justifiées'}</span>
        </div>
      </div>

      {categories.length > 0 && (
        <div className="depenses-budget__categories" aria-label="Répartition par catégorie">
          <h3 className="depenses-budget__titre">Par catégorie</h3>
          <ul>
            {categories.map((c, rang) => (
              <li key={c.nom} className="depenses-budget__categorie" style={{ '--rang': rang }}>
                <span className="depenses-budget__nom">{c.nom}</span>
                <span className="depenses-budget__barre" aria-hidden="true">
                  <span style={{ width: pret && plusGrande > 0 ? `${(c.centimes / plusGrande) * 100}%` : 0 }} />
                </span>
                <span className="depenses-budget__valeur">
                  {devise ? fmt.montant(c.centimes / 100, devise) : fmt.nombre(c.centimes / 100)}
                  {totalCentimes > 0 && <em> · {Math.round((c.centimes * 100) / totalCentimes)} %</em>}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="depenses-budget__outils">
        <label className="depenses-budget__recherche">
          <span className="sr-only">Rechercher une dépense</span>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="11" cy="11" r="6.5" />
            <path d="M20 20l-4.2-4.2" />
          </svg>
          <input
            type="search"
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            placeholder="Description, fournisseur, catégorie…"
          />
        </label>
        <label className="depenses-budget__filtre">
          <span className="sr-only">Filtrer par projet</span>
          <select value={projet} onChange={(e) => setProjet(e.target.value)}>
            <option value="">Tous les projets</option>
            {projets.map(([id, nom]) => (
              <option key={id} value={id}>
                {nom}
              </option>
            ))}
          </select>
        </label>
      </div>

      <Tableau
        empilable
        chargement={chargement}
        lignes={filtrees.slice(0, visibles)}
        cleLigne={(d) => d.id}
        colonnes={[
          { cle: 'date', titre: 'Date', largeur: '110px', rendu: (d) => fmt.date(d.expenseDate) },
          {
            cle: 'projet',
            titre: 'Projet',
            rendu: (d) => (
              <Link className="table__lien" to={`/admin/projects/${d.projectId}?onglet=depenses`}>
                {d.projectName}
              </Link>
            ),
          },
          {
            cle: 'description',
            titre: 'Dépense',
            rendu: (d) => (
              <div>
                <div>{fmt.tronquer(d.description, 80)}</div>
                {d.supplier && <div className="table__secondaire">{d.supplier}</div>}
              </div>
            ),
          },
          {
            cle: 'categorie',
            titre: 'Catégorie',
            rendu: (d) => <span className="depenses-budget__pastille">{d.category || 'Sans catégorie'}</span>,
          },
          {
            cle: 'justificatifs',
            titre: 'Justificatifs',
            aligne: 'centre',
            rendu: (d) =>
              Number(d.documentsCount) > 0 ? (
                <span className="depenses-budget__justifie">{d.documentsCount}</span>
              ) : (
                <span className="depenses-budget__manquant">À joindre</span>
              ),
          },
          {
            cle: 'montant',
            titre: 'Montant',
            aligne: 'droite',
            rendu: (d) => <strong>{fmt.montant(d.amount, d.currency)}</strong>,
          },
        ]}
        vide={<p className="depenses-budget__vide">{valides.length === 0 ? 'Aucune dépense enregistrée pour l’instant.' : 'Aucune dépense ne correspond à ces filtres.'}</p>}
      />

      {filtrees.length > visibles && (
        <div className="depenses-budget__suite">
          <button type="button" className="btn btn--neutre btn--petit" onClick={() => setVisibles((v) => v + PAR_PAGE * 2)}>
            Afficher plus ({filtrees.length - visibles} restantes)
          </button>
        </div>
      )}
    </div>
  );
}
