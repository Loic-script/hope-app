import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import {
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

const FORMULAIRE_VIDE = {
  name: '',
  description: '',
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
