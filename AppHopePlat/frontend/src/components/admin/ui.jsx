/**
 * Briques d'interface partagees par toutes les pages de l'espace admin.
 *
 * Objectif : que chaque ecran se compose de la meme facon (en-tete de page,
 * barre d'outils, panneau, tableau) pour obtenir un ensemble homogene sans
 * dupliquer le balisage.
 */
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

/* ------------------------------------------------------------------
   En-tete de page
   ------------------------------------------------------------------ */

/**
 * @param {{ fil?: {label: string, to?: string}[], titre: string,
 *           accroche?: string, actions?: React.ReactNode }} props
 */
/**
 * @param {object} props
 * @param {boolean} [props.retour] affiche la fleche de retour ; vrai par
 *        defaut, a passer a faux sur une page sans page precedente
 */
export function EntetePage({ fil = [], titre, accroche, actions, retour = true, visuel = null }) {
  const navigate = useNavigate();
  const emplacement = useLocation();

  /*
   * Une cle "default" signale la toute premiere entree de l'historique :
   * la page a ete ouverte directement, par un lien ou un rafraichissement.
   * Un navigate(-1) sortirait alors de l'application ; on remonte a
   * l'accueil a la place.
   */
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
        {/* Un visage, un logo : ce qui identifie la page avant son titre. */}
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
            {/* La barre et son soleil ferment la ligne, a droite du
                dernier intitule. Purement decoratifs. */}
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

/* ------------------------------------------------------------------
   Panneau
   ------------------------------------------------------------------ */

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

/* ------------------------------------------------------------------
   Etats transverses
   ------------------------------------------------------------------ */

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

/* ------------------------------------------------------------------
   Badges de statut
   ------------------------------------------------------------------ */

/** Couleur associee a chaque statut, tous modules confondus. */
const COULEURS_STATUT = {
  // Projets
  DRAFT: 'gris',
  ACTIVE: 'vert',
  COMPLETED: 'bleu',
  SUSPENDED: 'ambre',
  ARCHIVED: 'gris',
  // Budgets
  CLOSED: 'gris',
  // Depenses
  VALIDATED: 'bleu',
  PAID: 'vert',
  CANCELLED: 'rouge',
  // Dons
  PENDING: 'ambre',
  RECEIVED: 'vert',
  REFUNDED: 'gris',
  // Affectations
  DONOR_DESIGNATED: 'violet',
  HOPE_ALLOCATED: 'bleu',
  // Beneficiaires
  INACTIVE: 'gris',
  WITHDRAWN: 'gris',
};

/**
 * @param {{ valeur: string, libelles?: Record<string,string>, couleur?: string }} props
 */
export function Badge({ valeur, libelles, couleur }) {
  if (!valeur) return <span className="badge badge--gris">—</span>;
  const teinte = couleur ?? COULEURS_STATUT[valeur] ?? 'gris';
  return <span className={`badge badge--${teinte}`}>{libelles?.[valeur] ?? valeur}</span>;
}

/* ------------------------------------------------------------------
   Progression
   ------------------------------------------------------------------ */

/** Vert au-dela de 75 %, bleu au-dela de 40 %, ambre en dessous. */
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

/* ------------------------------------------------------------------
   Barre d'outils
   ------------------------------------------------------------------ */

/**
 * @param {{ recherche?: string, onRecherche?: Function, placeholder?: string,
 *           filtres?: {valeur: string, label: string}[], filtreActif?: string,
 *           onFiltre?: Function, compteur?: string, actions?: React.ReactNode }} props
 */
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

/* ------------------------------------------------------------------
   Tableau
   ------------------------------------------------------------------ */

/**
 * Tableau de donnees generique.
 *
 * @param {{ colonnes: {cle: string, titre: string, rendu?: Function,
 *           aligne?: 'droite'|'gauche', largeur?: string}[],
 *           lignes: object[], cleLigne?: Function,
 *           chargement?: boolean, erreur?: string, vide?: React.ReactNode }} props
 */
/** 'droite' pour les montants, 'centre' pour une colonne centree. */
function classeAlignement(aligne) {
  if (aligne === 'droite') return 'table__nombre';
  if (aligne === 'centre') return 'table__centre';
  return undefined;
}

/**
 * @param {object} props
 * @param {(ligne: object) => void} [props.onLigne] rend la ligne entiere
 *        cliquable. Les boutons et liens qu'elle porte gardent leur propre
 *        clic ; le clavier passe par un bouton de la ligne, que la page
 *        fournit.
 */
export function Tableau({
  colonnes,
  lignes,
  cleLigne,
  idLigne,
  // Une classe de plus pour certaines lignes : une ligne de total, par exemple.
  classeLigne,
  chargement,
  erreur,
  vide,
  onLigne,
  // Sur telephone, chaque ligne devient une fiche : la premiere cellule
  // en titre, les autres en lignes "libelle : valeur". Pour les tableaux
  // trop larges pour un petit ecran.
  empilable = false,
}) {
  /*
   * Arriver sur une ligne par son ancre (#compte-xxx).
   *
   * La liste se charge apres la navigation : le navigateur ne trouve rien a
   * faire defiler, on le fait une fois les lignes la. Et une navigation
   * interne (pushState) ne met pas :target a jour -- la ligne visee porte
   * donc sa propre classe.
   */
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

/* ------------------------------------------------------------------
   Onglets
   ------------------------------------------------------------------ */

/**
 * @param {{ onglets: {cle: string, label: string, compteur?: number}[],
 *           actif: string, onChange: Function }} props
 */
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

/* ------------------------------------------------------------------
   Divers
   ------------------------------------------------------------------ */

/** Bouton principal des en-tetes de page ("Nouveau projet"). */
export function BoutonAjout({ children, ...reste }) {
  return (
    <button type="button" className="btn btn--principal" {...reste}>
      <IconePlus />
      {children}
    </button>
  );
}

/** Cellule "titre + sous-titre" utilisee dans les tableaux. */
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

/** Bloc "libelle / valeur" de la fiche projet. */
export function LigneFiche({ terme, children }) {
  return (
    <div>
      <dt className="fiche__terme">{terme}</dt>
      <dd className="fiche__valeur">{children ?? '—'}</dd>
    </div>
  );
}
