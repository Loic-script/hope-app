import { useState } from 'react';
import { Link } from 'react-router-dom';

import {
  Champ,
  ChampSelection,
  ChampTexte,
  ChampTexteLong,
  ModaleConfirmation,
} from '../../components/admin/forms.jsx';
import { Alerte, Badge, Chargement, EntetePage, EtatVide, Panneau } from '../../components/admin/ui.jsx';
import VignettePreuve from '../../components/admin/VignettePreuve.jsx';
import { useChargement, useSoumission } from '../../hooks/useChargement.js';
import * as catalogService from '../../services/catalog.service.js';
import * as fieldProofService from '../../services/fieldProof.service.js';
import * as projectService from '../../services/project.service.js';
import * as fmt from '../../utils/format.js';

/** Un temoignage se suffit de son texte ; les trois autres portent un fichier. */
const TYPES_AVEC_FICHIER = new Set(['PHOTO', 'VIDEO', 'DOCUMENT']);

const FORMULAIRE_VIDE = {
  projectId: '',
  proofType: 'PHOTO',
  description: '',
  occurredOn: fmt.aujourdhui(),
  files: [],
};

/**
 * Ecran Preuves terrain.
 *
 * Le principe tient dans la phrase des maquettes : "une photo et deux
 * lignes suffisent". Le formulaire est donc pose a gauche, en permanence,
 * plutot que cache derriere une modale : publier doit prendre quelques
 * secondes depuis le terrain.
 */
export default function ProofsPage() {
  const [formulaire, setFormulaire] = useState(FORMULAIRE_VIDE);
  const [aSupprimer, setASupprimer] = useState(null);

  const { donnees, chargement, erreur, recharger } = useChargement(
    () => fieldProofService.lister(),
    []
  );
  const { donnees: projets } = useChargement(() => projectService.lister({ pageSize: 200 }), []);
  // Les libelles des trois natures de preuve viennent du catalogue,
  // comme ceux de tous les autres enums.
  const { donnees: catalogue } = useChargement(() => catalogService.recuperer(), []);
  const TYPES = catalogue?.labels?.proofType ?? {};

  const { envoi, erreur: erreurAction, soumettre } = useSoumission();

  const preuves = donnees?.items ?? [];
  const stats = donnees?.stats;
  const silencieux = donnees?.silentProjects ?? [];
  const seuil = donnees?.silenceThresholdDays ?? 15;

  /** Pre-remplit le formulaire avec le projet a documenter en priorite. */
  function documenter(projet) {
    setFormulaire((precedent) => ({ ...precedent, projectId: String(projet.id) }));
    document.getElementById('description')?.focus();
  }

  // Un projet archive refuse les preuves : autant ne pas le proposer.
  const optionsProjets = (projets?.items ?? [])
    .filter((projet) => projet.status !== 'ARCHIVED')
    .map((projet) => ({ valeur: projet.id, label: `${projet.reference} · ${projet.name}` }));

  const fichierRequis = TYPES_AVEC_FICHIER.has(formulaire.proofType);

  function modifier(champ, valeur) {
    setFormulaire((precedent) => ({ ...precedent, [champ]: valeur }));
  }

  async function publier(evenement) {
    evenement.preventDefault();
    await soumettre(() => fieldProofService.publier(formulaire), {
      onSucces: () => {
        setFormulaire({ ...FORMULAIRE_VIDE, occurredOn: fmt.aujourdhui() });
        recharger();
      },
    });
  }

  async function supprimer() {
    await soumettre(() => fieldProofService.supprimer(aSupprimer.id), {
      onSucces: () => {
        setASupprimer(null);
        recharger();
      },
    });
  }

  return (
    <>
      <EntetePage
        fil={[{ label: 'Back-office' }]}
        titre="Preuves terrain"
        accroche="Une photo et deux lignes suffisent — c’est ce qui alimentera le suivi de don de chaque donateur et de chaque bailleur."
      />

      {erreur && <Alerte>{erreur}</Alerte>}

      {stats && (
        <div className="cartes-chiffres">
          <div className="carte-chiffre">
            <p className="carte-chiffre__libelle">Preuves ce mois-ci</p>
            <p className="carte-chiffre__valeur">{fmt.nombre(stats.preuvesCeMois)}</p>
          </div>
          <div className="carte-chiffre">
            <p className="carte-chiffre__libelle">Contributeurs actifs</p>
            <p className="carte-chiffre__valeur">{fmt.nombre(stats.contributeursActifs)}</p>
          </div>
          <div className="carte-chiffre">
            <p className="carte-chiffre__libelle">Projets sans preuve · 15 j</p>
            <p className="carte-chiffre__valeur">{fmt.nombre(stats.projetsSansPreuve)}</p>
          </div>
          <div className="carte-chiffre">
            <p className="carte-chiffre__libelle">Délai moyen de publication</p>
            <p className="carte-chiffre__valeur">
              {stats.delaiMoyenJours === null ? '—' : `${stats.delaiMoyenJours} j`}
            </p>
          </div>
        </div>
      )}

      {/*
        L'alerte precede le formulaire : elle dit par ou commencer.
        Un simple compteur ne le dirait pas -- d'ou la liste, et le bouton
        qui pre-remplit le projet a documenter.
      */}
      {silencieux.length > 0 && (
        <Panneau
          titre={`${silencieux.length} projet(s) sans preuve depuis plus de ${seuil} jours`}
          sousTitre="Un donateur qui revient voir son projet n’y trouverait rien de neuf."
        >
          <ul className="silence">
            {silencieux.map((projet) => (
              <li className="silence__ligne" key={projet.id}>
                <span className="silence__projet">
                  <Link to={`/admin/projects/${projet.id}`}>{projet.name}</Link>
                  <span className="silence__reference">{projet.reference}</span>
                </span>
                <span className="silence__duree">
                  {projet.lastProofAt
                    ? `dernière preuve il y a ${projet.daysSinceProof} jours`
                    : `aucune preuve depuis ${projet.daysSinceProof} jours`}
                </span>
                <button
                  type="button"
                  className="btn btn--neutre btn--petit"
                  onClick={() => documenter(projet)}
                >
                  Documenter
                </button>
              </li>
            ))}
          </ul>
        </Panneau>
      )}

      <div className="preuves__colonnes">
        {/* ---------- Publier ---------- */}
        <Panneau titre="Ajouter une preuve">
          <form onSubmit={publier}>
            {erreurAction && <Alerte>{erreurAction}</Alerte>}

            <ChampSelection
              label="Projet concerné"
              id="projectId"
              obligatoire
              vide="Choisir un projet…"
              options={optionsProjets}
              value={formulaire.projectId}
              onChange={(e) => modifier('projectId', e.target.value)}
            />

            <ChampSelection
              label="Type de preuve"
              id="proofType"
              obligatoire
              options={Object.entries(TYPES).map(([valeur, label]) => ({ valeur, label }))}
              value={formulaire.proofType}
              onChange={(e) => modifier('proofType', e.target.value)}
            />

            <ChampTexteLong
              label="Description courte"
              id="description"
              obligatoire
              rows={3}
              placeholder="Ex. Fournitures scolaires remises à Tsinjo ce matin."
              value={formulaire.description}
              onChange={(e) => modifier('description', e.target.value)}
            />

            <ChampTexte
              label="Date de l’action"
              id="occurredOn"
              type="date"
              max={fmt.aujourdhui()}
              aide="Le jour où l’action a eu lieu, pas celui de la publication."
              value={formulaire.occurredOn}
              onChange={(e) => modifier('occurredOn', e.target.value)}
            />

            <Champ
              label={fichierRequis ? 'Fichiers' : 'Fichiers (facultatif)'}
              id="file"
              obligatoire={fichierRequis}
              aide="Plusieurs fichiers possibles, douze au plus. Photos : JPG, PNG, WEBP (10 Mo). Vidéos : MP4, MOV, WEBM (50 Mo). Document : PDF."
            >
              <input
                id="file"
                name="files"
                type="file"
                multiple
                accept=".jpg,.jpeg,.png,.webp,.mp4,.mov,.webm,.pdf"
                onChange={(e) => modifier('files', [...(e.target.files ?? [])])}
              />
            </Champ>

            <div className="formulaire-actions">
              <button type="submit" className="btn btn--principal" disabled={envoi}>
                {envoi ? 'Publication…' : 'Publier la preuve'}
              </button>
            </div>
          </form>
        </Panneau>

        {/* ---------- Ce qui a deja ete publie ---------- */}
        <Panneau titre="Preuves publiées récemment" sousTitre={`${preuves.length} preuve(s)`}>
          {chargement && !donnees ? (
            <Chargement texte="Chargement des preuves…" />
          ) : preuves.length === 0 ? (
            <EtatVide
              titre="Aucune preuve publiée"
              texte="Publiez la première : c’est elle qui montrera au donateur ce que son don a permis."
            />
          ) : (
            <ul className="preuves">
              {preuves.map((preuve) => (
                <li className="preuve preuve--cliquable" key={preuve.id}>
                  <VignettePreuve preuve={preuve} />

                  <div className="preuve__corps">
                    <p className="preuve__projet">
                      <Link to={`/admin/projects/${preuve.projectId}`}>{preuve.projectName}</Link>
                      <Badge valeur={preuve.proofType} libelles={TYPES} />
                    </p>
                    {/* Le lien s'etire sur toute la ligne via son ::after :
                        la vignette ouvre la lecture, et le bouton
                        Supprimer garde son propre clic. */}
                    <p className="preuve__description">
                      <Link className="preuve__lien" to={`/admin/proofs/${preuve.id}`}>
                        {preuve.description}
                      </Link>
                    </p>
                    <p className="preuve__signature">
                      {fmt.date(preuve.occurredOn)} · ajouté par {preuve.authorLog ?? 'compte supprimé'}
                    </p>
                  </div>

                  <button
                    type="button"
                    className="btn btn--neutre btn--petit preuve__action"
                    onClick={() => setASupprimer(preuve)}
                  >
                    Supprimer
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Panneau>
      </div>

      <ModaleConfirmation
        ouverte={aSupprimer !== null}
        titre="Supprimer cette preuve ?"
        message={
          aSupprimer
            ? `« ${fmt.tronquer(aSupprimer.description, 90)} » sera retirée, ainsi que son fichier.`
            : ''
        }
        libelleConfirmer="Supprimer"
        danger
        envoi={envoi}
        erreur={erreurAction}
        onFermer={() => setASupprimer(null)}
        onConfirmer={supprimer}
      />
    </>
  );
}
