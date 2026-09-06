/**
 * Modales de l'espace administrateur.
 *
 * Petites actions en modale, actions complexes sur page dediee : la
 * creation d'un projet a sa propre page, tout le reste passe par ici.
 */
import { useEffect, useMemo, useState } from 'react';

import {
  Champ,
  ChampMontant,
  ChampSelection,
  ChampTexte,
  ChampTexteLong,
  ModaleFormulaire,
  optionsDepuisLibelles,
} from './forms.jsx';
import { useSoumission } from '../../hooks/useChargement.js';
import * as beneficiaryService from '../../services/beneficiary.service.js';
import * as documentService from '../../services/document.service.js';
import * as donationService from '../../services/donation.service.js';
import * as donorService from '../../services/donor.service.js';
import * as expenseService from '../../services/expense.service.js';
import * as fundService from '../../services/fund.service.js';
import * as impactService from '../../services/impact.service.js';
import * as messageService from '../../services/message.service.js';
import * as projectService from '../../services/project.service.js';
import * as fmt from '../../utils/format.js';

/* ==================================================================
   Investir le fonds HOPE dans un projet
   ================================================================== */

/**
 * @param {{ ouverte, projets: object[], disponible: string,
 *           projetVerrouille?: object|null, onFermer, onEnregistre }} props
 */
export function InvestirModale({
  ouverte,
  projets = [],
  disponible = '0',
  projetVerrouille = null,
  onFermer,
  onEnregistre,
}) {
  const [projectId, setProjectId] = useState('');
  const [montant, setMontant] = useState('');
  const [justification, setJustification] = useState('');
  const { envoi, erreur, setErreur, soumettre } = useSoumission();

  useEffect(() => {
    if (!ouverte) return;
    setErreur('');
    setProjectId(projetVerrouille?.id ?? '');
    setMontant('');
    setJustification('');
  }, [ouverte, projetVerrouille, setErreur]);

  const projetChoisi = useMemo(
    () => projets.find((projet) => String(projet.id) === String(projectId)) ?? projetVerrouille,
    [projets, projectId, projetVerrouille]
  );

  // Le plafond, c'est le plus petit des deux : le fonds ou le besoin du projet.
  const plafond = projetChoisi
    ? Math.min(Number(disponible), Number(projetChoisi.remainingNeed ?? disponible))
    : Number(disponible);

  async function enregistrer() {
    await soumettre(
      () =>
        fundService.investir({
          projectId: Number(projectId),
          amount: montant,
          justification,
        }),
      { onSucces: onEnregistre }
    );
  }

  return (
    <ModaleFormulaire
      ouverte={ouverte}
      titre="Investir le fonds HOPE"
      sousTitre={`Fonds disponible : ${fmt.montant(disponible)}. Chaque investissement doit être justifié.`}
      onFermer={onFermer}
      onSoumettre={enregistrer}
      envoi={envoi}
      erreur={erreur}
      libelleValider="Investir dans ce projet"
      large
    >
      <div className="formulaire-grille">
        {projetVerrouille ? (
          <ChampTexte
            label="Projet"
            id="investir-projet-fige"
            value={projetVerrouille.name}
            disabled
            obligatoire
            pleineLargeur
          />
        ) : (
          <ChampSelection
            label="Projet à financer"
            id="investir-projet"
            obligatoire
            required
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            options={projets.map((projet) => ({
              valeur: projet.id,
              label: `${projet.name} — besoin restant ${fmt.montant(projet.remainingNeed, projet.currency)}`,
            }))}
            vide={
              projets.length === 0
                ? 'Aucun projet en cours ne cherche de financement'
                : 'Choisir un projet'
            }
            disabled={envoi || projets.length === 0}
            pleineLargeur
          />
        )}

        <ChampMontant
          label="Montant à investir"
          id="investir-montant"
          obligatoire
          required
          value={montant}
          onChange={(e) => setMontant(e.target.value)}
          disabled={envoi}
          aide={
            projetChoisi
              ? `Au maximum ${fmt.montant(plafond)} : le plus petit du fonds disponible et du besoin restant.`
              : `Fonds disponible : ${fmt.montant(disponible)}`
          }
        />

        {projetChoisi && (
          <ChampTexte
            label="Besoin restant du projet"
            id="investir-besoin"
            value={fmt.montant(projetChoisi.remainingNeed, projetChoisi.currency)}
            disabled
          />
        )}

        <ChampTexteLong
          label="Justification"
          id="investir-justification"
          obligatoire
          required
          value={justification}
          onChange={(e) => setJustification(e.target.value)}
          placeholder="Pourquoi ce projet, pourquoi ce montant, à quoi servira cet argent."
          disabled={envoi}
        />
      </div>
    </ModaleFormulaire>
  );
}

/* ==================================================================
   Terminer un projet
   ================================================================== */

export function TerminerProjetModale({ ouverte, projet, onFermer, onEnregistre }) {
  const [resultat, setResultat] = useState('');
  const { envoi, erreur, setErreur, soumettre } = useSoumission();

  useEffect(() => {
    if (!ouverte) return;
    setErreur('');
    setResultat('');
  }, [ouverte, setErreur]);

  async function enregistrer() {
    await soumettre(() => projectService.terminer(projet.id, resultat), { onSucces: onEnregistre });
  }

  return (
    <ModaleFormulaire
      ouverte={ouverte}
      titre="Terminer ce projet"
      sousTitre={
        projet
          ? `« ${projet.name} » passera au statut Terminé et rejoindra l’écran Impact.`
          : undefined
      }
      onFermer={onFermer}
      onSoumettre={enregistrer}
      envoi={envoi}
      erreur={erreur}
      libelleValider="Terminer le projet"
    >
      <div className="formulaire-grille">
        <ChampTexteLong
          label="Résultat obtenu"
          id="terminer-resultat"
          obligatoire
          required
          value={resultat}
          onChange={(e) => setResultat(e.target.value)}
          placeholder="Ce que le projet a concrètement changé : combien de personnes aidées, ce qui a été construit ou distribué, ce qui reste à faire."
          disabled={envoi}
          rows={6}
        />
      </div>
    </ModaleFormulaire>
  );
}

/* ==================================================================
   Donateur
   ================================================================== */

const DONATEUR_VIDE = {
  firstName: '',
  lastName: '',
  organizationName: '',
  email: '',
  phone: '',
  city: '',
  country: 'Madagascar',
  origin: 'LOCAL',
};

export function DonateurModale({ ouverte, donateur = null, libelles = {}, onFermer, onEnregistre }) {
  const edition = Boolean(donateur);
  const [formulaire, setFormulaire] = useState(DONATEUR_VIDE);
  const { envoi, erreur, setErreur, soumettre } = useSoumission();

  useEffect(() => {
    if (!ouverte) return;
    setErreur('');
    setFormulaire(
      donateur
        ? {
            firstName: donateur.firstName ?? '',
            lastName: donateur.lastName ?? '',
            organizationName: donateur.organizationName ?? '',
            email: donateur.email ?? '',
            phone: donateur.phone ?? '',
            city: donateur.city ?? '',
            country: donateur.country ?? 'Madagascar',
            origin: donateur.origin ?? 'LOCAL',
          }
        : DONATEUR_VIDE
    );
  }, [ouverte, donateur, setErreur]);

  function modifier(champ, valeur) {
    setFormulaire((actuel) => {
      const suivant = { ...actuel, [champ]: valeur };
      // L'origine suit le pays tant que l'utilisateur ne la force pas.
      if (champ === 'country') {
        suivant.origin = valeur.trim().toLowerCase() === 'madagascar' ? 'LOCAL' : 'INTERNATIONAL';
      }
      return suivant;
    });
  }

  async function enregistrer() {
    await soumettre(
      () =>
        edition
          ? donorService.mettreAJour(donateur.id, formulaire)
          : donorService.creer(formulaire),
      { onSucces: onEnregistre }
    );
  }

  return (
    <ModaleFormulaire
      ouverte={ouverte}
      titre={edition ? 'Modifier le donateur' : 'Nouveau donateur'}
      sousTitre="Renseignez un nom de personne ou une organisation."
      onFermer={onFermer}
      onSoumettre={enregistrer}
      envoi={envoi}
      erreur={erreur}
      libelleValider={edition ? 'Enregistrer' : 'Ajouter le donateur'}
      large
    >
      <div className="formulaire-grille">
        <ChampTexte
          label="Prénom"
          id="donateur-prenom"
          value={formulaire.firstName}
          onChange={(e) => modifier('firstName', e.target.value)}
          disabled={envoi}
        />
        <ChampTexte
          label="Nom"
          id="donateur-nom"
          value={formulaire.lastName}
          onChange={(e) => modifier('lastName', e.target.value)}
          disabled={envoi}
        />
        <ChampTexte
          label="Organisation"
          id="donateur-organisation"
          value={formulaire.organizationName}
          onChange={(e) => modifier('organizationName', e.target.value)}
          placeholder="Pour un don d’entreprise ou de fondation"
          disabled={envoi}
          pleineLargeur
        />
        <ChampTexte
          label="Courriel"
          id="donateur-email"
          type="email"
          value={formulaire.email}
          onChange={(e) => modifier('email', e.target.value)}
          disabled={envoi}
        />
        <ChampTexte
          label="Téléphone"
          id="donateur-telephone"
          value={formulaire.phone}
          onChange={(e) => modifier('phone', e.target.value)}
          disabled={envoi}
        />
        <ChampTexte
          label="Ville"
          id="donateur-ville"
          value={formulaire.city}
          onChange={(e) => modifier('city', e.target.value)}
          disabled={envoi}
        />
        <ChampTexte
          label="Pays"
          id="donateur-pays"
          value={formulaire.country}
          onChange={(e) => modifier('country', e.target.value)}
          disabled={envoi}
        />
        <ChampSelection
          label="Localisation"
          id="donateur-origine"
          obligatoire
          value={formulaire.origin}
          onChange={(e) => modifier('origin', e.target.value)}
          options={optionsDepuisLibelles(libelles.donorOrigin ?? {})}
          disabled={envoi}
          aide="Détermine les moyens de paiement proposés pour ses dons."
        />
      </div>
    </ModaleFormulaire>
  );
}

/* ==================================================================
   Ouverture d'un compte donateur
   ================================================================== */

export function CompteDonateurModale({ ouverte, donateur, onFermer, onEnregistre }) {
  const [email, setEmail] = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const { envoi, erreur, setErreur, soumettre } = useSoumission();

  useEffect(() => {
    if (!ouverte) return;
    setErreur('');
    setEmail(donateur?.email ?? '');
    setMotDePasse('');
  }, [ouverte, donateur, setErreur]);

  async function enregistrer() {
    await soumettre(
      () => donorService.ouvrirCompte(donateur.id, { email, password: motDePasse }),
      { onSucces: onEnregistre }
    );
  }

  return (
    <ModaleFormulaire
      ouverte={ouverte}
      titre="Ouvrir un compte donateur"
      sousTitre={
        donateur
          ? `${donateur.displayName} pourra suivre ses dons, ses projets soutenus et écrire à HOPE.`
          : undefined
      }
      onFermer={onFermer}
      onSoumettre={enregistrer}
      envoi={envoi}
      erreur={erreur}
      libelleValider="Ouvrir le compte"
    >
      <div className="formulaire-grille">
        <ChampTexte
          label="Adresse e-mail de connexion"
          id="compte-email"
          type="email"
          obligatoire
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={envoi}
          pleineLargeur
        />
        <ChampTexte
          label="Mot de passe provisoire"
          id="compte-mot-de-passe"
          type="text"
          obligatoire
          required
          value={motDePasse}
          onChange={(e) => setMotDePasse(e.target.value)}
          disabled={envoi}
          pleineLargeur
          aide="8 caractères minimum. Il est stocké haché : communiquez-le au donateur maintenant."
        />
      </div>
    </ModaleFormulaire>
  );
}

/* ==================================================================
   Don
   ================================================================== */

const DON_VIDE = {
  donorId: '',
  amount: '',
  currency: 'MGA',
  allocation: 'HOPE',
  projectId: '',
  frequency: 'ONE_TIME',
  paymentMethod: '',
  paymentReference: '',
  receivedAt: '',
  message: '',
};

/**
 * Saisie d'un don recu.
 *
 * Le formulaire suit la logique metier : on choisit d'abord si le don est
 * affecte a un projet ou destine au fonds HOPE, et les moyens de paiement
 * proposes dependent de la localisation du donateur.
 */
export function DonModale({
  ouverte,
  donateurs = [],
  projets = [],
  libelles = {},
  moyensPaiement = {},
  devises = ['MGA'],
  donateurVerrouille = null,
  onFermer,
  onEnregistre,
}) {
  const [formulaire, setFormulaire] = useState(DON_VIDE);
  const { envoi, erreur, setErreur, soumettre } = useSoumission();

  useEffect(() => {
    if (!ouverte) return;
    setErreur('');
    setFormulaire({
      ...DON_VIDE,
      donorId: donateurVerrouille?.id ?? '',
      receivedAt: fmt.aujourdhui(),
    });
  }, [ouverte, donateurVerrouille, setErreur]);

  const donateurChoisi = useMemo(
    () =>
      donateurVerrouille ??
      donateurs.find((donateur) => String(donateur.id) === String(formulaire.donorId)) ??
      null,
    [donateurs, formulaire.donorId, donateurVerrouille]
  );

  // Les moyens de paiement dependent de la localisation du donateur.
  const moyensDisponibles = donateurChoisi ? (moyensPaiement[donateurChoisi.origin] ?? []) : [];

  function modifier(champ, valeur) {
    setFormulaire((actuel) => {
      const suivant = { ...actuel, [champ]: valeur };
      if (champ === 'allocation' && valeur === 'HOPE') suivant.projectId = '';
      // Changer de donateur peut invalider le moyen de paiement choisi.
      if (champ === 'donorId') suivant.paymentMethod = '';
      return suivant;
    });
  }

  async function enregistrer() {
    await soumettre(
      () =>
        donationService.creer({
          donorId: Number(donateurVerrouille?.id ?? formulaire.donorId),
          amount: formulaire.amount,
          currency: formulaire.currency,
          allocation: formulaire.allocation,
          projectId: formulaire.allocation === 'PROJECT' ? Number(formulaire.projectId) : null,
          frequency: formulaire.frequency,
          paymentMethod: formulaire.paymentMethod || null,
          paymentReference: formulaire.paymentReference || null,
          receivedAt: formulaire.receivedAt || null,
          message: formulaire.message || null,
        }),
      { onSucces: onEnregistre }
    );
  }

  const affecte = formulaire.allocation === 'PROJECT';

  return (
    <ModaleFormulaire
      ouverte={ouverte}
      titre="Enregistrer un don reçu"
      sousTitre="Un don affecté va directement au projet choisi ; un don non affecté alimente le fonds HOPE."
      onFermer={onFermer}
      onSoumettre={enregistrer}
      envoi={envoi}
      erreur={erreur}
      libelleValider="Enregistrer le don"
      large
    >
      <div className="formulaire-grille">
        {donateurVerrouille ? (
          <ChampTexte
            label="Donateur"
            id="don-donateur-fige"
            value={donateurVerrouille.displayName}
            disabled
            obligatoire
            pleineLargeur
          />
        ) : (
          <ChampSelection
            label="Donateur"
            id="don-donateur"
            obligatoire
            required
            value={formulaire.donorId}
            onChange={(e) => modifier('donorId', e.target.value)}
            options={donateurs.map((donateur) => ({
              valeur: donateur.id,
              label: `${donateur.displayName}${donateur.city ? ` — ${donateur.city}` : ''}`,
            }))}
            vide="Choisir un donateur"
            disabled={envoi}
            pleineLargeur
          />
        )}

        <ChampSelection
          label="Destination du don"
          id="don-allocation"
          obligatoire
          value={formulaire.allocation}
          onChange={(e) => modifier('allocation', e.target.value)}
          options={optionsDepuisLibelles(libelles.donationAllocation ?? {})}
          disabled={envoi}
        />

        <ChampSelection
          label="Fréquence"
          id="don-frequence"
          obligatoire
          value={formulaire.frequency}
          onChange={(e) => modifier('frequency', e.target.value)}
          options={optionsDepuisLibelles(libelles.donationFrequency ?? {})}
          disabled={envoi}
        />

        {affecte && (
          <ChampSelection
            label="Projet choisi par le donateur"
            id="don-projet"
            obligatoire
            required
            value={formulaire.projectId}
            onChange={(e) => modifier('projectId', e.target.value)}
            options={projets.map((projet) => ({
              valeur: projet.id,
              label: `${projet.name} — besoin restant ${fmt.montant(projet.remainingNeed, projet.currency)}`,
            }))}
            vide="Choisir un projet en cours"
            disabled={envoi}
            pleineLargeur
          />
        )}

        <ChampMontant
          label="Montant reçu"
          id="don-montant"
          obligatoire
          required
          value={formulaire.amount}
          onChange={(e) => modifier('amount', e.target.value)}
          disabled={envoi}
        />

        <ChampSelection
          label="Devise"
          id="don-devise"
          obligatoire
          value={formulaire.currency}
          onChange={(e) => modifier('currency', e.target.value)}
          options={devises.map((devise) => ({ valeur: devise, label: devise }))}
          disabled={envoi}
        />

        <ChampSelection
          label="Moyen de paiement"
          id="don-moyen"
          value={formulaire.paymentMethod}
          onChange={(e) => modifier('paymentMethod', e.target.value)}
          options={moyensDisponibles.map((moyen) => ({ valeur: moyen, label: moyen }))}
          vide={donateurChoisi ? 'Non précisé' : 'Choisissez d’abord un donateur'}
          disabled={envoi || !donateurChoisi}
          aide={
            donateurChoisi
              ? `Moyens proposés pour un donateur ${
                  donateurChoisi.origin === 'LOCAL' ? 'à Madagascar' : "à l'étranger"
                }.`
              : undefined
          }
        />

        <ChampTexte
          label="Référence du paiement"
          id="don-reference"
          value={formulaire.paymentReference}
          onChange={(e) => modifier('paymentReference', e.target.value)}
          placeholder="MVOLA-884213"
          disabled={envoi}
        />

        <ChampTexte
          label="Date de réception"
          id="don-date"
          type="date"
          value={formulaire.receivedAt}
          onChange={(e) => modifier('receivedAt', e.target.value)}
          disabled={envoi}
        />

        <ChampTexteLong
          label="Message du donateur"
          id="don-message"
          value={formulaire.message}
          onChange={(e) => modifier('message', e.target.value)}
          placeholder="Souhait exprimé, mot d’accompagnement…"
          disabled={envoi}
        />
      </div>
    </ModaleFormulaire>
  );
}

/* ==================================================================
   Depense
   ================================================================== */

const DEPENSE_VIDE = {
  amount: '',
  description: '',
  category: '',
  supplier: '',
  expenseDate: '',
};

export function DepenseModale({
  ouverte,
  projet,
  depense = null,
  categories = [],
  onFermer,
  onEnregistre,
}) {
  const edition = Boolean(depense);
  const [formulaire, setFormulaire] = useState(DEPENSE_VIDE);
  const { envoi, erreur, setErreur, soumettre } = useSoumission();

  useEffect(() => {
    if (!ouverte) return;
    setErreur('');
    setFormulaire(
      depense
        ? {
            amount: depense.amount ?? '',
            description: depense.description ?? '',
            category: depense.category ?? '',
            supplier: depense.supplier ?? '',
            expenseDate: depense.expenseDate ? depense.expenseDate.slice(0, 10) : '',
          }
        : { ...DEPENSE_VIDE, expenseDate: fmt.aujourdhui() }
    );
  }, [ouverte, depense, setErreur]);

  function modifier(champ, valeur) {
    setFormulaire((actuel) => ({ ...actuel, [champ]: valeur }));
  }

  async function enregistrer() {
    await soumettre(
      () =>
        edition
          ? expenseService.mettreAJour(depense.id, formulaire)
          : expenseService.creer({ ...formulaire, projectId: projet.id }),
      { onSucces: onEnregistre }
    );
  }

  return (
    <ModaleFormulaire
      ouverte={ouverte}
      titre={edition ? 'Modifier la dépense' : 'Enregistrer une dépense'}
      sousTitre={
        projet
          ? `Fonds disponibles sur « ${projet.name} » : ${fmt.montant(projet.availableFunds, projet.currency)}`
          : undefined
      }
      onFermer={onFermer}
      onSoumettre={enregistrer}
      envoi={envoi}
      erreur={erreur}
      libelleValider={edition ? 'Enregistrer' : 'Enregistrer la dépense'}
      large
    >
      <div className="formulaire-grille">
        <ChampMontant
          label="Montant"
          id="depense-montant"
          obligatoire
          required
          value={formulaire.amount}
          onChange={(e) => modifier('amount', e.target.value)}
          disabled={envoi}
        />
        <ChampTexte
          label="Date de la dépense"
          id="depense-date"
          type="date"
          obligatoire
          required
          value={formulaire.expenseDate}
          onChange={(e) => modifier('expenseDate', e.target.value)}
          disabled={envoi}
        />
        <ChampSelection
          label="Catégorie"
          id="depense-categorie"
          value={formulaire.category}
          onChange={(e) => modifier('category', e.target.value)}
          options={categories.map((categorie) => ({ valeur: categorie, label: categorie }))}
          vide="Non classée"
          disabled={envoi}
        />
        <ChampTexte
          label="Fournisseur ou bénéficiaire du paiement"
          id="depense-fournisseur"
          value={formulaire.supplier}
          onChange={(e) => modifier('supplier', e.target.value)}
          placeholder="Librairie Ambatonakanga"
          disabled={envoi}
        />
        <ChampTexteLong
          label="Description"
          id="depense-description"
          obligatoire
          required
          value={formulaire.description}
          onChange={(e) => modifier('description', e.target.value)}
          placeholder="À quoi a servi cet argent, précisément."
          disabled={envoi}
        />
      </div>
    </ModaleFormulaire>
  );
}

/* ==================================================================
   Justificatif
   ================================================================== */

export function JustificatifModale({ ouverte, depense, libelles = {}, onFermer, onEnregistre }) {
  const [fichier, setFichier] = useState(null);
  const [type, setType] = useState('INVOICE');
  const [reference, setReference] = useState('');
  const [dateEmission, setDateEmission] = useState('');
  const { envoi, erreur, setErreur, soumettre } = useSoumission();

  useEffect(() => {
    if (!ouverte) return;
    setErreur('');
    setFichier(null);
    setType('INVOICE');
    setReference('');
    setDateEmission('');
  }, [ouverte, depense, setErreur]);

  async function enregistrer() {
    if (!fichier) {
      setErreur('Sélectionnez un fichier PDF, JPG ou PNG (10 Mo maximum).');
      return;
    }
    await soumettre(
      () =>
        documentService.televerser(depense.id, {
          file: fichier,
          documentType: type,
          reference: reference || undefined,
          issuedAt: dateEmission || undefined,
        }),
      { onSucces: onEnregistre }
    );
  }

  return (
    <ModaleFormulaire
      ouverte={ouverte}
      titre="Ajouter un justificatif"
      sousTitre={
        depense
          ? `${fmt.tronquer(depense.description, 60)} — ${fmt.montant(depense.amount, depense.currency)}`
          : undefined
      }
      onFermer={onFermer}
      onSoumettre={enregistrer}
      envoi={envoi}
      erreur={erreur}
      libelleValider="Téléverser"
    >
      <div className="formulaire-grille">
        <Champ
          label="Fichier"
          id="justificatif-fichier"
          obligatoire
          aide="Formats acceptés : PDF, JPG, JPEG, PNG. Taille maximale : 10 Mo."
          pleineLargeur
        >
          <input
            id="justificatif-fichier"
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
            onChange={(e) => setFichier(e.target.files?.[0] ?? null)}
            disabled={envoi}
          />
        </Champ>
        <ChampSelection
          label="Type de document"
          id="justificatif-type"
          obligatoire
          value={type}
          onChange={(e) => setType(e.target.value)}
          options={optionsDepuisLibelles(libelles.documentType ?? {})}
          disabled={envoi}
        />
        <ChampTexte
          label="Référence"
          id="justificatif-reference"
          value={reference}
          onChange={(e) => setReference(e.target.value)}
          placeholder="FAC-2026-118"
          disabled={envoi}
        />
        <ChampTexte
          label="Date du document"
          id="justificatif-date"
          type="date"
          value={dateEmission}
          onChange={(e) => setDateEmission(e.target.value)}
          disabled={envoi}
        />
      </div>
    </ModaleFormulaire>
  );
}

/* ==================================================================
   Beneficiaire
   ================================================================== */

const BENEFICIAIRE_VIDE = {
  firstName: '',
  lastName: '',
  beneficiaryType: 'ORPHAN',
  gender: '',
  birthDate: '',
  city: '',
  country: 'Madagascar',
  status: 'ACTIVE',
  notes: '',
};

export function BeneficiaireModale({
  ouverte,
  projet = null,
  beneficiaire = null,
  libelles = {},
  onFermer,
  onEnregistre,
}) {
  const edition = Boolean(beneficiaire);
  const [formulaire, setFormulaire] = useState(BENEFICIAIRE_VIDE);
  const { envoi, erreur, setErreur, soumettre } = useSoumission();

  useEffect(() => {
    if (!ouverte) return;
    setErreur('');
    setFormulaire(
      beneficiaire
        ? {
            firstName: beneficiaire.firstName ?? '',
            lastName: beneficiaire.lastName ?? '',
            beneficiaryType: beneficiaire.beneficiaryType ?? 'ORPHAN',
            gender: beneficiaire.gender ?? '',
            birthDate: beneficiaire.birthDate ? beneficiaire.birthDate.slice(0, 10) : '',
            city: beneficiaire.city ?? '',
            country: beneficiaire.country ?? 'Madagascar',
            status: beneficiaire.status ?? 'ACTIVE',
            notes: beneficiaire.notes ?? '',
          }
        : BENEFICIAIRE_VIDE
    );
  }, [ouverte, beneficiaire, setErreur]);

  function modifier(champ, valeur) {
    setFormulaire((actuel) => ({ ...actuel, [champ]: valeur }));
  }

  async function enregistrer() {
    const charge = {
      ...formulaire,
      gender: formulaire.gender || null,
      birthDate: formulaire.birthDate || null,
      notes: formulaire.notes || null,
      ...(edition || !projet ? {} : { projectId: projet.id }),
    };

    await soumettre(
      () =>
        edition
          ? beneficiaryService.mettreAJour(beneficiaire.id, charge)
          : beneficiaryService.creer(charge),
      { onSucces: onEnregistre }
    );
  }

  return (
    <ModaleFormulaire
      ouverte={ouverte}
      titre={edition ? 'Modifier le bénéficiaire' : 'Ajouter un bénéficiaire'}
      sousTitre="Données personnelles : elles restent internes à l’espace administrateur."
      onFermer={onFermer}
      onSoumettre={enregistrer}
      envoi={envoi}
      erreur={erreur}
      libelleValider={edition ? 'Enregistrer' : 'Ajouter'}
      large
    >
      <div className="formulaire-grille">
        <ChampTexte
          label="Prénom"
          id="beneficiaire-prenom"
          obligatoire
          required
          value={formulaire.firstName}
          onChange={(e) => modifier('firstName', e.target.value)}
          disabled={envoi}
        />
        <ChampTexte
          label="Nom"
          id="beneficiaire-nom"
          obligatoire
          required
          value={formulaire.lastName}
          onChange={(e) => modifier('lastName', e.target.value)}
          disabled={envoi}
        />
        <ChampSelection
          label="Type"
          id="beneficiaire-type"
          obligatoire
          value={formulaire.beneficiaryType}
          onChange={(e) => modifier('beneficiaryType', e.target.value)}
          options={optionsDepuisLibelles(libelles.beneficiaryType ?? {})}
          disabled={envoi}
        />
        <ChampSelection
          label="Genre"
          id="beneficiaire-genre"
          value={formulaire.gender}
          onChange={(e) => modifier('gender', e.target.value)}
          options={optionsDepuisLibelles(libelles.gender ?? {})}
          vide="Non renseigné"
          disabled={envoi}
        />
        <ChampTexte
          label="Date de naissance"
          id="beneficiaire-naissance"
          type="date"
          value={formulaire.birthDate}
          onChange={(e) => modifier('birthDate', e.target.value)}
          disabled={envoi}
        />
        <ChampTexte
          label="Ville"
          id="beneficiaire-ville"
          value={formulaire.city}
          onChange={(e) => modifier('city', e.target.value)}
          disabled={envoi}
        />
        <ChampTexteLong
          label="Notes de suivi"
          id="beneficiaire-notes"
          value={formulaire.notes}
          onChange={(e) => modifier('notes', e.target.value)}
          placeholder="Situation, accompagnement en cours… (confidentiel)"
          disabled={envoi}
        />
      </div>
    </ModaleFormulaire>
  );
}

/* ==================================================================
   Rattachement d'un beneficiaire existant
   ================================================================== */

export function RattachementModale({ ouverte, projet, beneficiaires = [], onFermer, onEnregistre }) {
  const [beneficiaryId, setBeneficiaryId] = useState('');
  const [joinedAt, setJoinedAt] = useState('');
  const { envoi, erreur, setErreur, soumettre } = useSoumission();

  useEffect(() => {
    if (!ouverte) return;
    setErreur('');
    setBeneficiaryId('');
    setJoinedAt(fmt.aujourdhui());
  }, [ouverte, setErreur]);

  async function enregistrer() {
    await soumettre(
      () =>
        beneficiaryService.rattacherAuProjet(projet.id, {
          beneficiaryId: Number(beneficiaryId),
          joinedAt: joinedAt || null,
        }),
      { onSucces: onEnregistre }
    );
  }

  return (
    <ModaleFormulaire
      ouverte={ouverte}
      titre="Rattacher un bénéficiaire"
      sousTitre={projet ? `Projet : ${projet.name}` : undefined}
      onFermer={onFermer}
      onSoumettre={enregistrer}
      envoi={envoi}
      erreur={erreur}
      libelleValider="Rattacher"
    >
      <div className="formulaire-grille">
        <ChampSelection
          label="Bénéficiaire"
          id="rattachement-beneficiaire"
          obligatoire
          required
          value={beneficiaryId}
          onChange={(e) => setBeneficiaryId(e.target.value)}
          options={beneficiaires.map((beneficiaire) => ({
            valeur: beneficiaire.id,
            label: `${beneficiaire.fullName} — ${beneficiaire.typeLabel}${
              beneficiaire.city ? ` (${beneficiaire.city})` : ''
            }`,
          }))}
          vide={
            beneficiaires.length === 0
              ? 'Tous les bénéficiaires connus sont déjà rattachés'
              : 'Choisir un bénéficiaire'
          }
          disabled={envoi || beneficiaires.length === 0}
          pleineLargeur
        />
        <ChampTexte
          label="Date d’entrée"
          id="rattachement-date"
          type="date"
          value={joinedAt}
          onChange={(e) => setJoinedAt(e.target.value)}
          disabled={envoi}
        />
      </div>
    </ModaleFormulaire>
  );
}

/* ==================================================================
   Impact
   ================================================================== */

const IMPACT_VIDE = {
  title: '',
  description: '',
  indicator: '',
  value: '',
  unit: '',
  measuredAt: '',
  beneficiaryId: '',
};

export function ImpactModale({
  ouverte,
  projet = null,
  projets = [],
  impact = null,
  indicateurs = [],
  beneficiaires = [],
  onFermer,
  onEnregistre,
}) {
  const edition = Boolean(impact);
  const [formulaire, setFormulaire] = useState(IMPACT_VIDE);
  const [projectId, setProjectId] = useState('');
  const { envoi, erreur, setErreur, soumettre } = useSoumission();

  useEffect(() => {
    if (!ouverte) return;
    setErreur('');
    setProjectId(projet?.id ?? impact?.projectId ?? '');
    setFormulaire(
      impact
        ? {
            title: impact.title ?? '',
            description: impact.description ?? '',
            indicator: impact.indicator ?? '',
            value: impact.value ?? '',
            unit: impact.unit ?? '',
            measuredAt: impact.measuredAt ? impact.measuredAt.slice(0, 10) : '',
            beneficiaryId: impact.beneficiaryId ?? '',
          }
        : { ...IMPACT_VIDE, measuredAt: fmt.aujourdhui() }
    );
  }, [ouverte, impact, projet, setErreur]);

  function modifier(champ, valeur) {
    setFormulaire((actuel) => ({ ...actuel, [champ]: valeur }));
  }

  /** Choisir un indicateur suggere preremplit son unite et son titre. */
  function choisirIndicateur(code) {
    const suggere = indicateurs.find((element) => element.code === code);
    setFormulaire((actuel) => ({
      ...actuel,
      indicator: code,
      unit: suggere?.unit ?? actuel.unit,
      title: actuel.title || (suggere?.label ?? ''),
    }));
  }

  async function enregistrer() {
    const charge = {
      ...formulaire,
      projectId: Number(projectId),
      description: formulaire.description || null,
      unit: formulaire.unit || null,
      beneficiaryId: formulaire.beneficiaryId === '' ? null : Number(formulaire.beneficiaryId),
    };

    await soumettre(
      () => (edition ? impactService.mettreAJour(impact.id, charge) : impactService.creer(charge)),
      { onSucces: onEnregistre }
    );
  }

  return (
    <ModaleFormulaire
      ouverte={ouverte}
      titre={edition ? 'Modifier l’impact' : 'Enregistrer un impact'}
      sousTitre="Un impact chiffre ce que le projet a permis de changer."
      onFermer={onFermer}
      onSoumettre={enregistrer}
      envoi={envoi}
      erreur={erreur}
      libelleValider={edition ? 'Enregistrer' : 'Enregistrer l’impact'}
      large
    >
      <div className="formulaire-grille">
        {projet ? (
          <ChampTexte
            label="Projet"
            id="impact-projet-fige"
            value={projet.name}
            disabled
            obligatoire
            pleineLargeur
          />
        ) : (
          <ChampSelection
            label="Projet"
            id="impact-projet"
            obligatoire
            required
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            options={projets.map((element) => ({ valeur: element.id, label: element.name }))}
            vide="Choisir un projet"
            disabled={envoi || edition}
            pleineLargeur
          />
        )}

        <ChampTexte
          label="Titre"
          id="impact-titre"
          obligatoire
          required
          value={formulaire.title}
          onChange={(e) => modifier('title', e.target.value)}
          placeholder="Habitants desservis en eau potable"
          disabled={envoi}
          pleineLargeur
        />

        <ChampSelection
          label="Indicateur courant"
          id="impact-indicateur-suggere"
          value={
            indicateurs.some((element) => element.code === formulaire.indicator)
              ? formulaire.indicator
              : ''
          }
          onChange={(e) => choisirIndicateur(e.target.value)}
          options={indicateurs.map((element) => ({
            valeur: element.code,
            label: `${element.label} (${element.code})`,
          }))}
          vide="Indicateur personnalisé"
          disabled={envoi}
          aide="Sélectionnez un indicateur courant ou saisissez le vôtre ci-dessous."
        />

        <ChampTexte
          label="Code de l’indicateur"
          id="impact-indicateur"
          obligatoire
          required
          value={formulaire.indicator}
          onChange={(e) => modifier('indicator', e.target.value)}
          placeholder="children_enrolled"
          disabled={envoi}
        />

        <ChampTexte
          label="Valeur"
          id="impact-valeur"
          type="text"
          inputMode="decimal"
          obligatoire
          required
          value={formulaire.value}
          onChange={(e) => modifier('value', e.target.value)}
          placeholder="25"
          disabled={envoi}
        />

        <ChampTexte
          label="Unité"
          id="impact-unite"
          value={formulaire.unit}
          onChange={(e) => modifier('unit', e.target.value)}
          placeholder="enfants"
          disabled={envoi}
        />

        <ChampTexte
          label="Date de mesure"
          id="impact-date"
          type="date"
          value={formulaire.measuredAt}
          onChange={(e) => modifier('measuredAt', e.target.value)}
          disabled={envoi}
        />

        {beneficiaires.length > 0 && (
          <ChampSelection
            label="Bénéficiaire concerné"
            id="impact-beneficiaire"
            value={formulaire.beneficiaryId}
            onChange={(e) => modifier('beneficiaryId', e.target.value)}
            options={beneficiaires.map((beneficiaire) => ({
              valeur: beneficiaire.beneficiaryId ?? beneficiaire.id,
              label: beneficiaire.fullName,
            }))}
            vide="Impact collectif"
            disabled={envoi}
          />
        )}

        <ChampTexteLong
          label="Description"
          id="impact-description"
          value={formulaire.description}
          onChange={(e) => modifier('description', e.target.value)}
          placeholder="Méthode de mesure, contexte, précisions."
          disabled={envoi}
        />
      </div>
    </ModaleFormulaire>
  );
}

/* ==================================================================
   Reponse a un message
   ================================================================== */

export function ReponseModale({ ouverte, message, onFermer, onEnregistre }) {
  const [reponse, setReponse] = useState('');
  const { envoi, erreur, setErreur, soumettre } = useSoumission();

  useEffect(() => {
    if (!ouverte) return;
    setErreur('');
    setReponse(message?.reply ?? '');
  }, [ouverte, message, setErreur]);

  async function enregistrer() {
    // Une reponse existante est remplacee : on le signale au backend.
    await soumettre(
      () => messageService.repondre(message.id, reponse, { force: Boolean(message.reply) }),
      { onSucces: onEnregistre }
    );
  }

  return (
    <ModaleFormulaire
      ouverte={ouverte}
      titre="Répondre au donateur"
      sousTitre={message ? `${message.donorName} — « ${message.subject} »` : undefined}
      onFermer={onFermer}
      onSoumettre={enregistrer}
      envoi={envoi}
      erreur={erreur}
      libelleValider="Envoyer la réponse"
      large
    >
      {message && (
        <div className="message__corps" style={{ marginBottom: '18px' }}>
          {message.body}
        </div>
      )}
      <div className="formulaire-grille">
        <ChampTexteLong
          label="Votre réponse"
          id="reponse-corps"
          obligatoire
          required
          value={reponse}
          onChange={(e) => setReponse(e.target.value)}
          placeholder="La réponse apparaîtra dans l’espace du donateur."
          disabled={envoi}
          rows={7}
        />
      </div>
    </ModaleFormulaire>
  );
}

/* ==================================================================
   Saisie d'un message recu par un autre canal
   ================================================================== */

export function NouveauMessageModale({ ouverte, comptes = [], onFermer, onEnregistre }) {
  const [donorAccountId, setDonorAccountId] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const { envoi, erreur, setErreur, soumettre } = useSoumission();

  useEffect(() => {
    if (!ouverte) return;
    setErreur('');
    setDonorAccountId('');
    setSubject('');
    setBody('');
  }, [ouverte, setErreur]);

  async function enregistrer() {
    await soumettre(
      () => messageService.creer({ donorAccountId: Number(donorAccountId), subject, body }),
      { onSucces: onEnregistre }
    );
  }

  return (
    <ModaleFormulaire
      ouverte={ouverte}
      titre="Enregistrer un message reçu"
      sousTitre="Pour garder trace d’un échange arrivé par téléphone ou en personne."
      onFermer={onFermer}
      onSoumettre={enregistrer}
      envoi={envoi}
      erreur={erreur}
      libelleValider="Enregistrer"
      large
    >
      <div className="formulaire-grille">
        <ChampSelection
          label="Donateur"
          id="message-compte"
          obligatoire
          required
          value={donorAccountId}
          onChange={(e) => setDonorAccountId(e.target.value)}
          options={comptes.map((compte) => ({
            valeur: compte.id,
            label: `${compte.displayName} — ${compte.email}`,
          }))}
          vide={
            comptes.length === 0
              ? 'Aucun donateur ne dispose encore d’un compte'
              : 'Choisir un donateur'
          }
          disabled={envoi || comptes.length === 0}
          pleineLargeur
        />
        <ChampTexte
          label="Sujet"
          id="message-sujet"
          obligatoire
          required
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          disabled={envoi}
          pleineLargeur
        />
        <ChampTexteLong
          label="Message"
          id="message-corps"
          obligatoire
          required
          value={body}
          onChange={(e) => setBody(e.target.value)}
          disabled={envoi}
          rows={6}
        />
      </div>
    </ModaleFormulaire>
  );
}
