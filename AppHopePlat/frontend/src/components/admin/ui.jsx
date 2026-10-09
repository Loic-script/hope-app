import { useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';

import {
  IconeAlerte,
  IconePlus,
  IconeRecherche,
  IconeRetour,
  IconeValide,
} from './AdminIcons.jsx';
import * as fmt from '../../utils/format.js';

export function EntetePage({ fil = [], titre, accroche, actions, retour = true, visuel = null }) {
  const navigate = useNavigate();
  const emplacement = useLocation();

  const revenir = () => (emplacement.key === 'default' ? navigate('/admin') : navigate(-1));

  return (
    <header className="page-entete">
      <div className="page-entete__gauche">
        {retour && (
          <button
            type="button"
            className="page-entete__retour"
            onClick={revenir}
            aria-label="Revenir à la page précédente"
          >
            <IconeRetour />
          </button>
        )}
        {visuel && <div className="page-entete__visuel">{visuel}</div>}
        <div className="page-entete__intitule">
        {fil.length > 0 && (
          <nav className="page-entete__fil" aria-label="Fil d'Ariane">
            {fil.map((etape, index) => (
              <span key={`${etape.label}-${index}`}>
                {etape.to ? <Link to={etape.to}>{etape.label}</Link> : etape.label}
                {index < fil.length - 1 && ' / '}
              </span>
            ))}
            <span className="trait-hope" aria-hidden="true" />
          </nav>
        )}
        <h1 className="page-entete__titre">{titre}</h1>
        {accroche && <p className="page-entete__accroche">{accroche}</p>}
        </div>
      </div>
      {actions && <div className="page-entete__actions">{actions}</div>}
    </header>
  );
}

export function Panneau({ titre, sousTitre, actions, children, serre = false, className = '' }) {
  return (
    <section className={`panneau ${className}`.trim()}>
      {(titre || actions) && (
        <div className="panneau__entete">
          <div className="panneau__intitule">
            {titre && <h2 className="panneau__titre">{titre}</h2>}
            {sousTitre && <p className="panneau__sous-titre">{sousTitre}</p>}
          </div>
          {actions && <div className="page-entete__actions">{actions}</div>}
        </div>
      )}
      <div className={`panneau__corps${serre ? ' panneau__corps--serre' : ''}`}>{children}</div>
    </section>
  );
}

export function Chargement({ texte = 'Chargement…' }) {
  return (
    <div className="chargement" role="status" aria-live="polite">
      <span className="chargement__rotation" aria-hidden="true" />
      {texte}
    </div>
  );
}

export function Alerte({ type = 'erreur', children }) {
  if (!children) return null;
  return (
    <div className={`alerte alerte--${type}`} role={type === 'erreur' ? 'alert' : 'status'}>
      {type === 'succes' ? <IconeValide /> : <IconeAlerte />}
      <div>{children}</div>
    </div>
  );
}

export function EtatVide({ titre, texte, action }) {
  return (
    <div className="etat-vide">
      <p className="etat-vide__titre">{titre}</p>
      {texte && <p className="etat-vide__texte">{texte}</p>}
      {action && <div className="etat-vide__action">{action}</div>}
    </div>
  );
}

const COULEURS_STATUT = {
  DRAFT: 'gris',
  ACTIVE: 'vert',
  COMPLETED: 'bleu',
  SUSPENDED: 'ambre',
  ARCHIVED: 'gris',
  CLOSED: 'gris',
  VALIDATED: 'bleu',
  PAID: 'vert',
  CANCELLED: 'rouge',
  PENDING: 'ambre',
  RECEIVED: 'vert',
  REFUNDED: 'gris',
  DONOR_DESIGNATED: 'violet',
  HOPE_ALLOCATED: 'bleu',
  INACTIVE: 'gris',
  WITHDRAWN: 'gris',
};

export function Badge({ valeur, libelles, couleur }) {
  if (!valeur) return <span className="badge badge--gris">—</span>;
  const teinte = couleur ?? COULEURS_STATUT[valeur] ?? 'gris';
  return <span className={`badge badge--${teinte}`}>{libelles?.[valeur] ?? valeur}</span>;
}

function teinteProgression(valeur) {
  if (valeur >= 100) return 'vert';
  if (valeur >= 75) return 'vert';
  if (valeur >= 40) return 'bleu';
  return 'ambre';
}

export function Progression({ valeur, teinte }) {
  const pourcentage = Math.max(0, Math.min(100, Number(valeur) || 0));
  return (
    <div className="progression">
      <div className="progression__valeur">{fmt.pourcent(valeur ?? 0)}</div>
      <div
        className="progression__rail"
        role="progressbar"
        aria-valuenow={pourcentage}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className={`progression__barre progression__barre--${teinte ?? teinteProgression(pourcentage)}`}
          style={{ width: `${pourcentage}%` }}
        />
      </div>
    </div>
  );
}

export function BarreOutils({
  recherche,
  onRecherche,
  placeholder = 'Rechercher…',
  filtres,
  filtreActif,
  onFiltre,
  compteur,
  actions,
}) {
  return (
    <div className="outils">
      {onRecherche && (
        <div className="outils__recherche">
          <IconeRecherche />
          <input
            type="search"
            value={recherche ?? ''}
            onChange={(e) => onRecherche(e.target.value)}
            placeholder={placeholder}
            aria-label={placeholder}
          />
        </div>
      )}

      {filtres && filtres.length > 0 && (
        <div className="filtres" role="group" aria-label="Filtrer">
          {filtres.map((filtre) => (
            <button
              key={filtre.valeur}
              type="button"
              className={`filtres__bouton${filtreActif === filtre.valeur ? ' filtres__bouton--actif' : ''}`}
              onClick={() => onFiltre?.(filtre.valeur)}
              aria-pressed={filtreActif === filtre.valeur}
            >
              {filtre.label}
            </button>
          ))}
        </div>
      )}

      {(compteur || actions) && (
        <div className="outils__droite">
          {compteur && <span className="outils__compteur">{compteur}</span>}
          {actions}
        </div>
      )}
    </div>
  );
}

function classeAlignement(aligne) {
  if (aligne === 'droite') return 'table__nombre';
  if (aligne === 'centre') return 'table__centre';
  return undefined;
}

export function Tableau({
  colonnes,
  lignes,
  cleLigne,
  idLigne,
  classeLigne,
  chargement,
  erreur,
  vide,
  onLigne,
  empilable = false,
}) {
  const { hash } = useLocation();
  const visee = idLigne && hash ? decodeURIComponent(hash.slice(1)) : null;

  useEffect(() => {
    if (!visee || !lignes?.length) return;
    document.getElementById(visee)?.scrollIntoView({ block: 'center' });
  }, [visee, lignes]);

  if (chargement) return <Chargement />;
  if (erreur) {
    return (
      <div className="panneau__corps">
        <Alerte>{erreur}</Alerte>
      </div>
    );
  }
  if (!lignes || lignes.length === 0) return vide ?? <EtatVide titre="Aucun résultat" />;

  return (
    <div className="table-enveloppe">
      <table className={empilable ? 'table table--empilable' : 'table'}>
        <thead>
          <tr>
            {colonnes.map((colonne) => (
              <th
                key={colonne.cle}
                className={classeAlignement(colonne.aligne)}
                style={colonne.largeur ? { width: colonne.largeur } : undefined}
              >
                {colonne.titre}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {lignes.map((ligne, index) => (
            <tr
              key={cleLigne ? cleLigne(ligne) : (ligne.id ?? index)}
              id={idLigne ? idLigne(ligne) : undefined}
              className={
                [
                  visee && idLigne(ligne) === visee ? 'ligne--visee' : '',
                  onLigne ? 'ligne--cliquable' : '',
                  classeLigne?.(ligne) ?? '',
                ]
                  .filter(Boolean)
                  .join(' ') || undefined
              }
              onClick={
                onLigne
                  ? (evenement) => {
                      if (evenement.target.closest('button, a, input, select, label, textarea')) return;
                      onLigne(ligne);
                    }
                  : undefined
              }
            >
              {colonnes.map((colonne) => (
                <td
                  key={colonne.cle}
                  className={classeAlignement(colonne.aligne)}
                  data-libelle={empilable ? colonne.titre : undefined}
                >
                  {colonne.rendu ? colonne.rendu(ligne) : (ligne[colonne.cle] ?? '—')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Onglets({ onglets, actif, onChange }) {
  return (
    <div className="onglets" role="tablist">
      {onglets.map((onglet) => (
        <button
          key={onglet.cle}
          type="button"
          role="tab"
          aria-selected={actif === onglet.cle}
          className={`onglets__bouton${actif === onglet.cle ? ' onglets__bouton--actif' : ''}`}
          onClick={() => onChange(onglet.cle)}
        >
          {onglet.label}
          {onglet.compteur !== undefined && (
            <span className="onglets__compteur">{onglet.compteur}</span>
          )}
        </button>
      ))}
    </div>
  );
}

export function BoutonAjout({ children, ...reste }) {
  return (
    <button type="button" className="btn btn--principal" {...reste}>
      <IconePlus />
      {children}
    </button>
  );
}

export function CelluleDouble({ principal, secondaire, to }) {
  return (
    <div>
      {to ? (
        <Link className="table__lien" to={to}>
          {principal}
        </Link>
      ) : (
        <div className="table__principal">{principal}</div>
      )}
      {secondaire && <div className="table__secondaire">{secondaire}</div>}
    </div>
  );
}

export function LigneFiche({ terme, children }) {
  return (
    <div>
      <dt className="fiche__terme">{terme}</dt>
      <dd className="fiche__valeur">{children ?? '—'}</dd>
    </div>
  );
}
