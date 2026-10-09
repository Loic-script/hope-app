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
import * as fmt from '../../utils/format.js';

const MAX_OBJECTIFS = 10;

const MAX_POSTES_DEVIS = 30;

function totalDevisEnCentimes(postes) {
  let total = 0;
  for (const poste of postes) {
    const texte = String(poste.amount ?? '').trim().replace(/\s/g, '').replace(',', '.');
    if (texte === '') return null;
    if (!/^\d+(\.\d{1,2})?$/.test(texte)) return null;
    const [entiere, decimale = ''] = texte.split('.');
    total += Number(entiere) * 100 + Number(decimale.padEnd(2, '0'));
  }
  return total;
}

const TYPES_PROJET = [
  {
    valeur: 'HOPE',
    libelle: 'Projet HOPE',
    aide: 'La mission de HOPE, pour ses bénéficiaires.',
  },
  {
    valeur: 'INTERNAL',
    libelle: 'Projet interne',
    aide: 'Faire évoluer HOPE : outils, formation de l’équipe, organisation.',
  },
];

const FORMULAIRE_VIDE = {
  projectType: 'HOPE',
  name: '',
  descriptionTitre: '',
  description: '',
  objectives: [''],
  categoryName: '',
  location: '',
  managerName: '',
  requiredBudget: '',
  quoteItems: [],
  currency: 'MGA',
  beneficiaryProfile: '',
  beneficiaryTarget: '',
  mediaUrl: '',
  mediaType: 'PHOTO',
};

export default function ProjectFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const edition = Boolean(id);

  const [formulaire, setFormulaire] = useState(FORMULAIRE_VIDE);

  const { donnees: catalogue } = useChargement(
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
      projectType: projet.projectType ?? 'HOPE',
      name: projet.name ?? '',
      descriptionTitre: projet.descriptionTitre ?? '',
      description: projet.description ?? '',
      objectives:
        projet.objectives?.length > 0 ? projet.objectives.map((o) => o.label) : [''],
      categoryName: projet.categoryName ?? '',
      location: projet.location ?? '',
      managerName: projet.managerName ?? '',
      requiredBudget: projet.requiredBudget ?? '',
      quoteItems: (projet.quoteItems ?? []).map((poste) => ({
        label: poste.label ?? '',
        category: poste.category ?? '',
        amount: poste.amount ?? '',
      })),
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

  function retirerObjectif(rang) {
    setFormulaire((actuel) => {
      const restant = actuel.objectives.filter((_, index) => index !== rang);
      return { ...actuel, objectives: restant.length > 0 ? restant : [''] };
    });
  }

  function modifierPoste(rang, champ, valeur) {
    setFormulaire((actuel) => ({
      ...actuel,
      quoteItems: actuel.quoteItems.map((poste, index) =>
        index === rang ? { ...poste, [champ]: valeur } : poste
      ),
    }));
  }

  function ajouterPoste() {
    setFormulaire((actuel) =>
      actuel.quoteItems.length >= MAX_POSTES_DEVIS
        ? actuel
        : { ...actuel, quoteItems: [...actuel.quoteItems, { category: '', amount: '' }] }
    );
  }

  function retirerPoste(rang) {
    setFormulaire((actuel) => ({
      ...actuel,
      quoteItems: actuel.quoteItems.filter((_, index) => index !== rang),
    }));
  }

  const devisOuvert = formulaire.quoteItems.length > 0;
  const totalDevis = devisOuvert ? totalDevisEnCentimes(formulaire.quoteItems) : null;
  const budgetAffiche = devisOuvert
    ? (totalDevis === null ? '' : fmt.montant((totalDevis / 100).toFixed(2), formulaire.currency))
    : formulaire.requiredBudget;

  async function enregistrer(evenement) {
    evenement.preventDefault();

    const charge = {
      ...formulaire,
      categoryName: formulaire.categoryName.trim() || null,
      descriptionTitre: formulaire.descriptionTitre || null,
      description: formulaire.description || null,
      location: formulaire.location || null,
      managerName: formulaire.managerName || null,
      beneficiaryProfile: formulaire.beneficiaryProfile || null,
      beneficiaryTarget: formulaire.beneficiaryTarget === '' ? null : Number(formulaire.beneficiaryTarget),
      mediaUrl: formulaire.mediaUrl || null,
      mediaType: formulaire.mediaUrl ? formulaire.mediaType : null,
      objectives: formulaire.objectives.map((o) => o.trim()).filter(Boolean),
      quoteItems: formulaire.quoteItems,
    };

    await soumettre(
      () => (edition ? projectService.mettreAJour(id, charge) : projectService.creer(charge)),
      { onSucces: (resultat) => navigate(`/admin/projects/${resultat.id}`) }
    );
  }

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
            <fieldset className="choix-type" disabled={envoi}>
              <legend className="champ-admin__label">Type de projet</legend>
              <div className="choix-type__options">
                {TYPES_PROJET.map((type) => (
                  <label
                    key={type.valeur}
                    className={
                      'choix-type__option' +
                      (formulaire.projectType === type.valeur ? ' choix-type__option--actif' : '')
                    }
                  >
                    <input
                      type="radio"
                      name="projectType"
                      value={type.valeur}
                      checked={formulaire.projectType === type.valeur}
                      onChange={() => modifier('projectType', type.valeur)}
                    />
                    <span className="choix-type__libelle">{type.libelle}</span>
                    <span className="choix-type__aide">{type.aide}</span>
                  </label>
                ))}
              </div>
            </fieldset>

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

            <ChampTexte
              label="Titre de la description"
              id="descriptionTitre"
              value={formulaire.descriptionTitre}
              onChange={(e) => modifier('descriptionTitre', e.target.value)}
              placeholder="Des soins gratuits pour 350 familles"
              maxLength={160}
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

            <Champ
              label="Objectifs spécifiques"
              id="objective-0"
              aide={`Un objectif par ligne, ${MAX_OBJECTIFS} au maximum. Ce que le projet doit avoir accompli, pas ce qu’il est.`}
              pleineLargeur
            >
              <ul className="liste-champs">
                {formulaire.objectives.map((libelle, rang) => (
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

            <ChampTexte
              label="Catégorie"
              id="categoryName"
              value={formulaire.categoryName}
              onChange={(e) => modifier('categoryName', e.target.value)}
              placeholder="Ex. Scolarité, Santé, Agriculture…"
              maxLength={120}
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

            <Champ
              label="Devis"
              id="poste-0-label"
              aide={
                devisOuvert
                  ? `${formulaire.quoteItems.length} poste(s) sur ${MAX_POSTES_DEVIS}. Une catégorie par poste, sans doublon : c'est elle qui le nomme, et qui permettra de comparer le prévu au réel.`
                  : 'Détaillez le budget poste par poste, ou saisissez directement le montant ci-dessous.'
              }
              pleineLargeur
            >
              {devisOuvert && (
                <ul className="devis">
                  {formulaire.quoteItems.map((poste, rang) => (
                    <li className="devis__ligne" key={rang}>
                      <select
                        className="devis__categorie"
                        value={poste.category}
                        onChange={(e) => modifierPoste(rang, 'category', e.target.value)}
                        disabled={envoi}
                        aria-label={`Catégorie du poste ${rang + 1}`}
                      >
                        <option value="">Catégorie…</option>
                        {(catalogue?.expenseCategories ?? []).map((categorie) => (
                          <option value={categorie} key={categorie}>
                            {categorie}
                          </option>
                        ))}
                      </select>
                      <input
                        type="text"
                        inputMode="decimal"
                        className="devis__montant"
                        value={poste.amount}
                        onChange={(e) => modifierPoste(rang, 'amount', e.target.value)}
                        placeholder="0"
                        disabled={envoi}
                        aria-label={`Montant du poste ${rang + 1}`}
                      />
                      <button
                        type="button"
                        className="liste-champs__retirer"
                        onClick={() => retirerPoste(rang)}
                        disabled={envoi}
                        aria-label={`Retirer le poste ${rang + 1}`}
                      >
                        <IconeCroix />
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              <div className="devis__pied">
                <button
                  type="button"
                  className="btn btn--neutre btn--petit"
                  onClick={ajouterPoste}
                  disabled={envoi || formulaire.quoteItems.length >= MAX_POSTES_DEVIS}
                >
                  <IconePlus />
                  {devisOuvert ? 'Ajouter un poste' : 'Détailler en postes'}
                </button>

                {devisOuvert && (
                  <p className="devis__total">
                    Total du devis
                    <strong>
                      {totalDevis === null
                        ? '—'
                        : fmt.montant((totalDevis / 100).toFixed(2), formulaire.currency)}
                    </strong>
                  </p>
                )}
              </div>
            </Champ>

            <ChampMontant
              label="Budget nécessaire"
              id="requiredBudget"
              obligatoire
              required={!devisOuvert}
              readOnly={devisOuvert}
              value={budgetAffiche}
              onChange={(e) => modifier('requiredBudget', e.target.value)}
              disabled={envoi}
              aide={
                devisOuvert
                  ? `Calculé à partir de ${formulaire.quoteItems.length} poste(s). Retirez-les tous pour le saisir directement.`
                  : 'Ce dont le projet a besoin au total. Les dons affectés et les investissements du fonds HOPE viendront le couvrir.'
              }
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
