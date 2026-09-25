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

/**
 * Nombre d'objectifs specifiques acceptes, comme cote serveur.
 *
 * Dix : au-dela, ce ne sont plus des objectifs mais un plan d'action, et
 * la liste cesse de se relire d'un coup d'oeil.
 */
const MAX_OBJECTIFS = 10;

/** Nombre de postes acceptes dans un devis, comme cote serveur. */
const MAX_POSTES_DEVIS = 30;

/**
 * Somme des postes du devis, en centimes.
 *
 * On travaille en centimes entiers et non en nombres a virgule : 0,1 +
 * 0,2 ne fait pas 0,3 en flottant, et un total de budget ne doit pas
 * deriver d'un centime. La saisie francaise est toleree -- espaces de
 * milliers, virgule decimale -- comme cote serveur.
 *
 * @returns {number|null} null si un poste porte un montant illisible :
 *          le total n'a alors pas de sens, et c'est le serveur qui dira
 *          lequel est en cause.
 */
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

/**
 * Les deux types de projet, avec ce qu'ils recouvrent.
 *
 * La phrase compte autant que le nom : "interne" seul ne dit pas si l'on
 * parle d'un projet de l'equipe ou d'un projet discret.
 */
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
  // Projet HOPE par defaut : c'est le cas le plus courant, et celui de
  // tous les projets crees avant que le choix n'existe.
  projectType: 'HOPE',
  name: '',
  descriptionTitre: '',
  description: '',
  // Une ligne vide au depart : le champ doit se voir sans qu'il faille
  // deviner qu'un bouton l'ouvre.
  objectives: [''],
  categoryId: '',
  location: '',
  managerName: '',
  requiredBudget: '',
  // Vide au depart : le devis est facultatif, et le budget se saisit
  // directement tant qu'aucun poste n'est ouvert.
  quoteItems: [],
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
      projectType: projet.projectType ?? 'HOPE',
      name: projet.name ?? '',
      descriptionTitre: projet.descriptionTitre ?? '',
      description: projet.description ?? '',
      objectives:
        projet.objectives?.length > 0 ? projet.objectives.map((o) => o.label) : [''],
      categoryId: projet.categoryId ?? '',
      location: projet.location ?? '',
      managerName: projet.managerName ?? '',
      requiredBudget: projet.requiredBudget ?? '',
      quoteItems: (projet.quoteItems ?? []).map((poste) => ({
        // L'intitule n'a plus de champ, mais il est renvoye tel quel :
        // un devis saisi avant garde le sien plutot que de le perdre a
        // la premiere modification du projet.
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

  /* ---------- Le devis, poste a poste ---------- */

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

  /* Retirer le dernier poste rend la main a la saisie directe : le
     budget redevient modifiable, avec la derniere valeur calculee. */
  function retirerPoste(rang) {
    setFormulaire((actuel) => ({
      ...actuel,
      quoteItems: actuel.quoteItems.filter((_, index) => index !== rang),
    }));
  }

  /*
   * Des qu'un poste existe, le budget n'est plus saisi mais calcule.
   * C'est le meme arbitrage que cote serveur, et le champ passe en
   * lecture seule pour qu'aucun des deux chiffres ne puisse contredire
   * l'autre.
   */
  const devisOuvert = formulaire.quoteItems.length > 0;
  const totalDevis = devisOuvert ? totalDevisEnCentimes(formulaire.quoteItems) : null;
  /* En lecture seule, le montant est mis en forme comme le total juste
     au-dessus : c'est un affichage, plus une saisie. Modifiable, il
     reste la chaine brute que l'on tape. */
  const budgetAffiche = devisOuvert
    ? (totalDevis === null ? '' : fmt.montant((totalDevis / 100).toFixed(2), formulaire.currency))
    : formulaire.requiredBudget;

  async function enregistrer(evenement) {
    evenement.preventDefault();

    const charge = {
      ...formulaire,
      categoryId: formulaire.categoryId === '' ? null : Number(formulaire.categoryId),
      descriptionTitre: formulaire.descriptionTitre || null,
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
      // Le serveur recalcule le total a partir des postes : le montant
      // envoye ci-dessus ne sert que lorsqu'il n'y en a aucun.
      quoteItems: formulaire.quoteItems,
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
            {/*
              Le type d'abord : il dit a quoi sert le projet, avant meme
              son nom. Deux cartes plutot qu'une liste : le choix se lit
              d'un coup d'oeil, avec ce que chaque type recouvre.
            */}
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

            {/*
              Le titre de la description, et non un second nom de projet :
              le nom designe, ce titre annonce ce que le paragraphe
              raconte. Facultatif -- une fiche sans lui reste lisible.
            */}
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

            {/*
              Le devis : d'ou vient le budget necessaire.

              Il est facultatif. Sans poste, le montant se saisit
              directement -- celui qui le connait deja n'a pas a le
              detailler. Des qu'un poste existe, c'est la somme qui fait
              foi, et le champ du dessous passe en lecture seule : deux
              chiffres modifiables pour la meme chose finiraient par se
              contredire.
            */}
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
                    // L'index sert de cle faute de mieux : ces lignes n'ont
                    // pas d'identite tant qu'elles ne sont pas enregistrees.
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
