import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { IconeCroix, IconePlus } from '../../components/admin/AdminIcons.jsx';
import {
  Champ,
  ChampMontant,
  ChampSelection,
  ChampTexte,
  ChampTexteLong,
} from '../../components/admin/forms.jsx';
import ChampMedia from '../../components/admin/ChampMedia.jsx';
import { Alerte, Chargement, EntetePage, Panneau } from '../../components/admin/ui.jsx';
import { useChargement, useSoumission } from '../../hooks/useChargement.js';
import * as catalogService from '../../services/catalog.service.js';
import * as projectService from '../../services/project.service.js';

/**
 * Nombre d'objectifs specifiques acceptes, comme cote serveur.
 *
 * Dix : au-dela, ce ne sont plus des objectifs mais un plan d'action, et
 * la liste cesse de se relire d'un coup d'oeil.
 */
const MAX_OBJECTIFS = 10;

const FORMULAIRE_VIDE = {
  name: '',
  description: '',
  // Une ligne vide au depart : le champ doit se voir sans qu'il faille
  // deviner qu'un bouton l'ouvre.
  objectives: [''],
  categoryId: '',
  location: '',
  managerName: '',
  requiredBudget: '',
  currency: 'MGA',
  beneficiaryProfile: '',
  beneficiaryTarget: '',
  mediaUrl: '',
  mediaType: 'PHOTO',
};

/**
 * Creation et modification d'un projet.
 *
 * Action complexe : elle occupe une page dediee plutot qu'une modale. Le
 * statut n'est pas saisissable — un projet nait toujours en cours et se
 * termine depuis sa fiche, avec son resultat.
 */
export default function ProjectFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const edition = Boolean(id);

  const [formulaire, setFormulaire] = useState(FORMULAIRE_VIDE);

  const { donnees: catalogue, chargement: chargementCatalogue } = useChargement(
    () => catalogService.recuperer(),
    []
  );

  const { donnees: projet, chargement: chargementProjet, erreur: erreurProjet } = useChargement(
    () => (edition ? projectService.recuperer(id) : Promise.resolve(null)),
    [id]
  );

  useEffect(() => {
    if (!projet) return;
    setFormulaire({
      name: projet.name ?? '',
      description: projet.description ?? '',
      objectives:
        projet.objectives?.length > 0 ? projet.objectives.map((o) => o.label) : [''],
      categoryId: projet.categoryId ?? '',
      location: projet.location ?? '',
      managerName: projet.managerName ?? '',
      requiredBudget: projet.requiredBudget ?? '',
      currency: (projet.currency ?? 'MGA').trim(),
      beneficiaryProfile: projet.beneficiaryProfile ?? '',
      beneficiaryTarget: projet.beneficiaryTarget ?? '',
      mediaUrl: projet.mediaUrl ?? '',
      mediaType: projet.mediaType ?? 'PHOTO',
    });
  }, [projet]);

  const { envoi, erreur, soumettre } = useSoumission();

  function modifier(champ, valeur) {
    setFormulaire((actuel) => ({ ...actuel, [champ]: valeur }));
  }

  /* ---------- Les objectifs specifiques, ligne a ligne ---------- */

  function modifierObjectif(rang, valeur) {
    setFormulaire((actuel) => ({
      ...actuel,
      objectives: actuel.objectives.map((libelle, index) => (index === rang ? valeur : libelle)),
    }));
  }

  function ajouterObjectif() {
    setFormulaire((actuel) =>
      actuel.objectives.length >= MAX_OBJECTIFS
        ? actuel
        : { ...actuel, objectives: [...actuel.objectives, ''] }
    );
  }

  /** Retirer la derniere ligne la vide au lieu de la supprimer : le champ
      ne doit jamais disparaitre completement. */
  function retirerObjectif(rang) {
    setFormulaire((actuel) => {
      const restant = actuel.objectives.filter((_, index) => index !== rang);
      return { ...actuel, objectives: restant.length > 0 ? restant : [''] };
    });
  }

  async function enregistrer(evenement) {
    evenement.preventDefault();

    const charge = {
      ...formulaire,
      categoryId: formulaire.categoryId === '' ? null : Number(formulaire.categoryId),
      description: formulaire.description || null,
      location: formulaire.location || null,
      managerName: formulaire.managerName || null,
      beneficiaryProfile: formulaire.beneficiaryProfile || null,
      beneficiaryTarget: formulaire.beneficiaryTarget === '' ? null : Number(formulaire.beneficiaryTarget),
      mediaUrl: formulaire.mediaUrl || null,
      mediaType: formulaire.mediaUrl ? formulaire.mediaType : null,
      // Le serveur ecarte lui aussi les lignes vides ; on les retire ici
      // pour ne pas envoyer du vide qu'il devra nettoyer.
      objectives: formulaire.objectives.map((o) => o.trim()).filter(Boolean),
    };

    await soumettre(
      () => (edition ? projectService.mettreAJour(id, charge) : projectService.creer(charge)),
      { onSucces: (resultat) => navigate(`/admin/projects/${resultat.id}`) }
    );
  }

  const categories = (catalogue?.categories ?? []).map((categorie) => ({
    valeur: categorie.id,
    label: categorie.name,
  }));

  if (edition && chargementProjet) return <Chargement texte="Chargement du projet…" />;
  if (edition && erreurProjet) return <Alerte>{erreurProjet}</Alerte>;

  return (
    <>
      <EntetePage
        fil={[
          { label: 'Projets', to: '/admin/projects' },
          { label: edition ? (projet?.name ?? 'Projet') : 'Nouveau projet' },
        ]}
        titre={edition ? 'Modifier le projet' : 'Créer un projet'}
        accroche={
          edition
            ? 'Mettez à jour les informations du projet.'
            : 'Le projet démarrera en cours. Son financement, ses dépenses et ses bénéficiaires s’ajouteront depuis sa fiche.'
        }
      />

      <Panneau>
        <form onSubmit={enregistrer} noValidate>
          {erreur && <Alerte>{erreur}</Alerte>}

          <div className="formulaire-grille" style={{ marginTop: erreur ? '18px' : 0 }}>
            <ChampTexte
              label="Nom du projet"
              id="name"
              obligatoire
              required
              value={formulaire.name}
              onChange={(e) => modifier('name', e.target.value)}
              placeholder="Soutien scolaire Antananarivo"
              maxLength={200}
              disabled={envoi}
              pleineLargeur
            />

            <ChampTexteLong
              label="Description"
              id="description"
              value={formulaire.description}
              onChange={(e) => modifier('description', e.target.value)}
              placeholder="Ce que le projet va faire, pour qui, et pourquoi il est nécessaire."
              maxLength={5000}
              disabled={envoi}
            />

            {/*
              Les objectifs specifiques : ce que le projet doit avoir
              accompli. "Ouvrir une cantine" est le projet ; "servir un
              repas chaud a 200 eleves" en est un objectif.

              Une ligne par objectif plutot qu'un texte libre : on les
              relit point par point, et chacun pourra plus tard porter
              son indicateur.
            */}
            <Champ
              label="Objectifs spécifiques"
              id="objective-0"
              aide={`Un objectif par ligne, ${MAX_OBJECTIFS} au maximum. Ce que le projet doit avoir accompli, pas ce qu’il est.`}
              pleineLargeur
            >
              <ul className="liste-champs">
                {formulaire.objectives.map((libelle, rang) => (
                  // L'index sert de cle faute de mieux : ces lignes n'ont
                  // pas d'identite tant qu'elles ne sont pas enregistrees,
                  // et elles ne se reordonnent pas.
                  // eslint-disable-next-line react/no-array-index-key
                  <li className="liste-champs__ligne" key={rang}>
                    <input
                      id={`objective-${rang}`}
                      type="text"
                      value={libelle}
                      onChange={(e) => modifierObjectif(rang, e.target.value)}
                      placeholder={
                        rang === 0
                          ? 'Servir un repas chaud par jour à 200 élèves'
                          : 'Objectif suivant…'
                      }
                      maxLength={300}
                      disabled={envoi}
                      aria-label={`Objectif spécifique ${rang + 1}`}
                    />
                    <button
                      type="button"
                      className="liste-champs__retirer"
                      onClick={() => retirerObjectif(rang)}
                      disabled={envoi}
                      aria-label={`Retirer l’objectif ${rang + 1}`}
                    >
                      <IconeCroix />
                    </button>
                  </li>
                ))}
              </ul>

              <button
                type="button"
                className="btn btn--neutre btn--petit"
                onClick={ajouterObjectif}
                disabled={envoi || formulaire.objectives.length >= MAX_OBJECTIFS}
              >
                <IconePlus />
                Ajouter un objectif
              </button>
            </Champ>

            <ChampSelection
              label="Catégorie"
              id="categoryId"
              value={formulaire.categoryId}
              onChange={(e) => modifier('categoryId', e.target.value)}
              options={categories}
              vide={chargementCatalogue ? 'Chargement…' : 'Aucune catégorie'}
              disabled={envoi}
            />

            <ChampTexte
              label="Localisation"
              id="location"
              value={formulaire.location}
              onChange={(e) => modifier('location', e.target.value)}
              placeholder="Antananarivo"
              maxLength={160}
              disabled={envoi}
            />

            <ChampTexte
              label="Responsable"
              id="managerName"
              value={formulaire.managerName}
              onChange={(e) => modifier('managerName', e.target.value)}
              placeholder="Nom du responsable de terrain"
              maxLength={160}
              disabled={envoi}
            />

            <ChampMontant
              label="Budget nécessaire"
              id="requiredBudget"
              obligatoire
              required
              value={formulaire.requiredBudget}
              onChange={(e) => modifier('requiredBudget', e.target.value)}
              disabled={envoi}
              aide="Ce dont le projet a besoin au total. Les dons affectés et les investissements du fonds HOPE viendront le couvrir."
            />

            <ChampSelection
              label="Devise"
              id="currency"
              obligatoire
              value={formulaire.currency}
              onChange={(e) => modifier('currency', e.target.value)}
              options={(catalogue?.currencies ?? ['MGA']).map((devise) => ({
                valeur: devise,
                label: devise,
              }))}
              disabled={envoi}
            />

            <ChampTexte
              label="Public bénéficiaire"
              id="beneficiaryProfile"
              value={formulaire.beneficiaryProfile}
              onChange={(e) => modifier('beneficiaryProfile', e.target.value)}
              placeholder="Enfants orphelins de 6 à 14 ans"
              maxLength={200}
              disabled={envoi}
              aide="Qui ce projet doit aider. Les personnes précises se nomment depuis la fiche."
            />

            <ChampTexte
              label="Nombre de bénéficiaires visés"
              id="beneficiaryTarget"
              type="number"
              min="0"
              value={formulaire.beneficiaryTarget}
              onChange={(e) => modifier('beneficiaryTarget', e.target.value)}
              placeholder="100"
              disabled={envoi}
            />

            <ChampMedia
              valeur={formulaire.mediaUrl}
              type={formulaire.mediaType}
              desactive={envoi}
              onChange={(adresse, type) =>
                setFormulaire((actuel) => ({ ...actuel, mediaUrl: adresse, mediaType: type }))
              }
            />
          </div>

          <div className="formulaire-actions">
            <button
              type="button"
              className="btn btn--neutre"
              onClick={() => navigate(edition ? `/admin/projects/${id}` : '/admin/projects')}
              disabled={envoi}
            >
              Annuler
            </button>
            <button type="submit" className="btn btn--principal" disabled={envoi}>
              {envoi
                ? 'Enregistrement…'
                : edition
                  ? 'Enregistrer les modifications'
                  : 'Créer le projet'}
            </button>
          </div>
        </form>
      </Panneau>
    </>
  );
}
