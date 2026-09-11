import * as fmt from '../../utils/format.js';

/** Libelles des trois natures de soutien. */
export const TYPES_SOUTIEN = {
  financier: 'Financement',
  competences: 'Mécénat de compétences',
  materiel: 'Don matériel',
};

/** Statuts d'un engagement. */
export const STATUTS_ENGAGEMENT = {
  en_cours: 'En cours',
  finalise: 'Finalisé',
  suspendu: 'Suspendu',
  annule: 'Annulé',
};

/** Statuts d'un versement. */
export const STATUTS_VERSEMENT = {
  attendu: 'Attendu',
  recu: 'Reçu',
  en_retard: 'En retard',
  annule: 'Annulé',
};

/** Teinte de la pastille d'un statut de versement. */
export const TEINTES_VERSEMENT = {
  recu: 'vert',
  attendu: 'bleu',
  en_retard: 'ambre',
  annule: 'gris',
};

/** Libelles des types de document. */
export const TYPES_DOCUMENT = {
  rapport_impact: 'Rapport d’impact',
  justificatif_financier: 'Justificatif financier',
  certificat: 'Certificat',
  convention: 'Convention',
};

/** Une pastille de statut. */
export function Pastille({ children, teinte = 'gris' }) {
  return <span className={`jeton jeton--${teinte}`}>{children}</span>;
}

/**
 * La chaine d'un engagement : promis, recu, affecte.
 *
 * C'est l'element signature de cet espace, et il repond a la seule
 * confusion qui compte ici. Trois notions se ressemblent et ne veulent
 * pas dire la meme chose :
 *
 *   promis   ce que la convention engage      -> le rail entier
 *   recu     ce qui est arrive en banque      -> le remplissage
 *   affecte  ce qui est attribue a des projets -> le repere sous le rail
 *
 * Les poser sur un seul axe rend l'ecart lisible d'un coup d'oeil :
 * un rail a moitie rempli mais entierement repere signifie que HOPE a
 * deja tout attribue et attend l'argent.
 */
export function ChaineEngagement({ promis, recu, affecte, devise = 'MGA', compact = false }) {
  const total = Number(promis) || 0;
  const partRecue = total > 0 ? Math.min(100, (Number(recu) || 0) * 100 / total) : 0;
  const partAffectee = total > 0 ? Math.min(100, (Number(affecte) || 0) * 100 / total) : 0;

  return (
    <div className={`triade${compact ? ' triade--compacte' : ''}`}>
      {!compact && (
        <div className="triade__legende">
          <Mesure libelle="Promis" valeur={fmt.montant(promis, devise)} teinte="neutre" />
          <Mesure libelle="Reçu" valeur={fmt.montant(recu, devise)} teinte="plein" />
          <Mesure libelle="Affecté" valeur={fmt.montant(affecte, devise)} teinte="repere" />
        </div>
      )}

      <div
        className="triade__rail"
        role="progressbar"
        aria-valuenow={Math.round(partRecue)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Part du montant promis deja recue"
      >
        <span className="triade__recu" style={{ width: `${partRecue}%` }} />
        <span
          className="triade__repere"
          style={{ left: `${partAffectee}%` }}
          aria-hidden="true"
        />
      </div>

      {!compact && (
        <p className="triade__note">
          {partRecue >= 99.5
            ? 'Le montant promis est intégralement versé.'
            : `${fmt.pourcent(Math.round(partRecue * 10) / 10)} versés — le repère marque ce que HOPE a déjà attribué à des projets.`}
        </p>
      )}
    </div>
  );
}

/** Une des trois mesures de la chaine. */
function Mesure({ libelle, valeur, teinte }) {
  return (
    <div className={`triade__mesure triade__mesure--${teinte}`}>
      <span className="triade__libelle">{libelle}</span>
      <strong className="triade__valeur">{valeur}</strong>
    </div>
  );
}

/**
 * Barre de repartition : une part par segment.
 *
 * Sert la repartition par domaine et l'origine des fonds. Les couleurs
 * tournent sur une suite fixe : deux relectures de la meme page doivent
 * donner les memes teintes.
 */
export function BarreRepartition({ lignes, cleLibelle = 'domaine', clePart = 'part' }) {
  if (!lignes || lignes.length === 0) {
    return <p className="vide-bailleur">Aucune affectation pour l’instant.</p>;
  }

  return (
    <div className="repartition">
      <div className="repartition__barre">
        {lignes.map((ligne, index) => (
          <span
            key={ligne[cleLibelle]}
            className={`repartition__part repartition__part--${(index % 5) + 1}`}
            style={{ flexGrow: Math.max(0.5, Number(ligne[clePart]) || 0) }}
            title={`${ligne[cleLibelle]} — ${ligne[clePart]} %`}
          />
        ))}
      </div>

      <ul className="repartition__legende">
        {lignes.map((ligne, index) => (
          <li key={ligne[cleLibelle]}>
            <span className={`repartition__puce repartition__puce--${(index % 5) + 1}`} />
            <span className="repartition__nom">{ligne[cleLibelle]}</span>
            <strong className="repartition__chiffre">{ligne[clePart]} %</strong>
            {ligne.montant !== undefined && (
              <span className="repartition__montant">{fmt.montant(ligne.montant)}</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** En-tete d'une page de l'espace. */
export function EntetePage({ titre, accroche, actions }) {
  return (
    <header className="page-bailleur__entete">
      <div>
        <h1 className="page-bailleur__titre">{titre}</h1>
        {accroche && <p className="page-bailleur__accroche">{accroche}</p>}
      </div>
      {actions && <div className="page-bailleur__actions">{actions}</div>}
    </header>
  );
}

/** Un panneau de contenu. */
export function Panneau({ titre, sousTitre, actions, children }) {
  return (
    <section className="panneau-bailleur">
      {(titre || actions) && (
        <div className="panneau-bailleur__entete">
          <div>
            {titre && <h2 className="panneau-bailleur__titre">{titre}</h2>}
            {sousTitre && <p className="panneau-bailleur__sous-titre">{sousTitre}</p>}
          </div>
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}
