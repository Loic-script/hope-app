import { useState } from 'react';

import { useChargement } from '../../hooks/useChargement.js';
import { urlMedia } from '../../services/api.js';
import * as service from '../../services/bailleur.service.js';
import * as fmt from '../../utils/format.js';
import { EntetePage, Pastille } from './composants.jsx';
import FenetreRapportProjet from './RapportProjet.jsx';

/** Statuts d'un projet, et la teinte de leur pastille. */
export const STATUTS_PROJET = {
  IN_PROGRESS: { libelle: 'En cours', teinte: 'bleu' },
  COMPLETED: { libelle: 'Terminé', teinte: 'vert' },
  ARCHIVED: { libelle: 'Archivé', teinte: 'gris' },
};

/** Les filtres du haut de page. */
const FILTRES = [
  { cle: 'tous', label: 'Tous', garde: () => true },
  { cle: 'en_cours', label: 'En cours', garde: (p) => p.status === 'IN_PROGRESS' },
  { cle: 'termines', label: 'Terminés', garde: (p) => p.status === 'COMPLETED' },
  { cle: 'finances', label: 'Que vous financez', garde: (p) => p.financeParMoi },
];

/**
 * Les projets de HOPE, vus par un partenaire.
 *
 * Tous les projets HOPE en cours et termines, et ceux qu'il finance
 * quels qu'ils soient. Chaque carte dit ou en est le financement du
 * projet, ce que le partenaire y a mis, et ouvre le rapport a jour.
 */
export default function Projets() {
  const { donnees, chargement, erreur } = useChargement(() => service.projets(), []);
  const [filtre, setFiltre] = useState('tous');
  const [rapportDe, setRapportDe] = useState(null);

  const projets = donnees ?? [];
  const actif = FILTRES.find((f) => f.cle === filtre) ?? FILTRES[0];
  const affiches = projets.filter(actif.garde);

  return (
    <>
      <EntetePage
        titre="Projets"
        accroche="Les projets menés par HOPE, où en est leur financement, et le rapport à jour de chacun."
      />

      {erreur && <p className="alerte-bailleur">{erreur}</p>}

      <div className="onglets-bailleur" role="tablist">
        {FILTRES.map((f) => (
          <button
            key={f.cle}
            type="button"
            role="tab"
            aria-selected={filtre === f.cle}
            className={`onglets-bailleur__bouton${
              filtre === f.cle ? ' onglets-bailleur__bouton--actif' : ''
            }`}
            onClick={() => setFiltre(f.cle)}
          >
            {f.label}
            <span className="onglets-bailleur__compte">{projets.filter(f.garde).length}</span>
          </button>
        ))}
      </div>

      {chargement && projets.length === 0 ? (
        <p className="vide-bailleur">Chargement des projets…</p>
      ) : affiches.length === 0 ? (
        <p className="vide-bailleur">
          {filtre === 'finances'
            ? 'Aucun de vos financements n’est encore affecté à un projet.'
            : 'Aucun projet dans cette catégorie pour l’instant.'}
        </p>
      ) : (
        <div className="projets-bailleur">
          {affiches.map((projet) => (
            <CarteProjet key={projet.id} projet={projet} onRapport={() => setRapportDe(projet)} />
          ))}
        </div>
      )}

      <FenetreRapportProjet projet={rapportDe} onFermer={() => setRapportDe(null)} />
    </>
  );
}

/** Un projet : ce qu'il fait, ou en est son financement, et son rapport. */
function CarteProjet({ projet, onRapport }) {
  const statut = STATUTS_PROJET[projet.status] ?? STATUTS_PROJET.IN_PROGRESS;
  const devise = projet.currency ?? 'MGA';
  const photo = projet.photoUrl ? urlMedia(projet.photoUrl) : null;

  const lieu = [projet.categorie, projet.location].filter(Boolean).join(' · ');
  const periode =
    projet.status === 'IN_PROGRESS'
      ? `Depuis le ${fmt.date(projet.startDate)}`
      : `Du ${fmt.date(projet.startDate)} au ${fmt.date(projet.completedAt)}`;

  return (
    <article className={`projet-bailleur${projet.financeParMoi ? ' projet-bailleur--finance' : ''}`}>
      {photo && (
        <div className="projet-bailleur__visuel">
          <img src={photo} alt="" loading="lazy" />
        </div>
      )}

      <div className="projet-bailleur__haut">
        <div className="projet-bailleur__jetons">
          <Pastille teinte={statut.teinte}>{statut.libelle}</Pastille>
          {projet.financeParMoi && <Pastille teinte="violet">Vous financez</Pastille>}
          {projet.projectType === 'INTERNAL' && <Pastille teinte="gris">Projet interne</Pastille>}
        </div>
        {projet.reference && <span className="projet-bailleur__reference">{projet.reference}</span>}
      </div>

      <h2 className="projet-bailleur__titre">{projet.name}</h2>
      {lieu && <p className="projet-bailleur__lieu">{lieu}</p>}

      {(projet.descriptionTitre || projet.description) && (
        <div className="projet-bailleur__description">
          {projet.descriptionTitre && <strong>{projet.descriptionTitre}</strong>}
          {projet.description && <p>{fmt.tronquer(projet.description, 240)}</p>}
        </div>
      )}

      {/*
        La "somme investie" de la fiche projet et du rapport : dons recus
        et fonds de HOPE. Les affectations des partenaires n'y entrent pas
        -- le rapport les montre a part -- et le libelle le dit, sans quoi
        un partenaire lirait 3,8 millions finances sous ses 9 millions
        affectes.
      */}
      <div className="collecte">
        <div className="collecte__chiffres">
          <strong>{fmt.montant(projet.montantFinance, devise)}</strong>
          <span>
            de dons et de fonds HOPE, sur un budget de {fmt.montant(projet.requiredBudget, devise)}{' '}
            · {fmt.pourcent(projet.tauxFinancement)}
          </span>
        </div>
        <div
          className="collecte__rail"
          role="progressbar"
          aria-valuenow={Math.round(Math.min(100, projet.tauxFinancement ?? 0))}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Part du budget couverte par les dons et les fonds HOPE"
        >
          <span
            className="collecte__plein"
            style={{ width: `${Math.min(100, projet.tauxFinancement ?? 0)}%` }}
          />
        </div>
      </div>

      <dl className="projet-bailleur__chiffres">
        <div>
          <dt>Période</dt>
          <dd>{periode}</dd>
        </div>
        {projet.beneficiaryTarget ? (
          <div>
            <dt>Bénéficiaires visés</dt>
            <dd>{fmt.nombre(projet.beneficiaryTarget)}</dd>
          </div>
        ) : null}
        {projet.financeParMoi && (
          <div>
            <dt>Votre affectation</dt>
            <dd>
              <strong>{fmt.montant(projet.montantAffecte, devise)}</strong>
            </dd>
          </div>
        )}
      </dl>

      <div className="projet-bailleur__actions">
        <button type="button" className="bouton-bailleur bouton-bailleur--discret" onClick={onRapport}>
          Lire le rapport
        </button>
      </div>
    </article>
  );
}
