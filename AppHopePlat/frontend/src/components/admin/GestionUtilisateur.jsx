import { useEffect, useState } from 'react';

import { useSoumission } from '../../hooks/useChargement.js';
import { messageErreur } from '../../services/api.js';
import * as funderService from '../../services/funder.service.js';
import * as utilisateursService from '../../services/utilisateurs.service.js';
import * as volunteerService from '../../services/volunteer.service.js';
import { ChampTexte, ModaleConfirmation, ModaleFormulaire } from './forms.jsx';
import { DonateurModale } from './modales.jsx';

export const STATUTS_UTILISATEUR = {
  en_attente: { libelle: 'En attente', couleur: 'ambre' },
  actif: { libelle: 'Actif', couleur: 'vert' },
  suspendu: { libelle: 'Désactivé', couleur: 'rouge' },
  fiche: { libelle: 'Sans compte', couleur: 'gris' },
  fiche_compte: { libelle: 'Compte donateur', couleur: 'bleu' },
  fiche_suspendue: { libelle: 'Compte suspendu', couleur: 'rouge' },
};

export const LIBELLES_STATUT = Object.fromEntries(
  Object.entries(STATUTS_UTILISATEUR).map(([cle, { libelle }]) => [cle, libelle])
);

export const ROLE_DE_L_ONGLET = { donateurs: 'donateur', benevoles: 'benevole', bailleurs: 'bailleur' };

export const ONGLET_DU_ROLE = { donateur: 'donateurs', benevole: 'benevoles', bailleur: 'bailleurs' };

export function lienProfil(ligne, onglet) {
  const suite = onglet ? `?depuis=${onglet}` : '';
  return `/admin/utilisateurs/${ligne.genre}/${ligne.id}${suite}`;
}

const COMPTE_VIDE = {
  prenom: '',
  nom: '',
  email: '',
  telephone: '',
  nomStructure: '',
  raisonSociale: '',
};

function ModifierCompteModale({ ouverte, profil, onFermer, onEnregistre }) {
  const [formulaire, setFormulaire] = useState(COMPTE_VIDE);
  const { envoi, erreur, setErreur, soumettre } = useSoumission();
  const roles = profil?.roles ?? [];
  const donateur = roles.includes('donateur');
  const bailleur = roles.includes('bailleur');

  useEffect(() => {
    if (!ouverte || !profil) return;
    setErreur('');
    setFormulaire({
      prenom: profil.compte.prenom ?? '',
      nom: profil.compte.nom ?? '',
      email: profil.compte.email ?? '',
      telephone: profil.compte.telephone ?? '',
      nomStructure: profil.donateur?.parcours?.nomStructure ?? '',
      raisonSociale: profil.bailleur?.organisation?.raisonSociale ?? '',
    });
  }, [ouverte, profil, setErreur]);

  const modifier = (champ) => (evenement) =>
    setFormulaire((actuel) => ({ ...actuel, [champ]: evenement.target.value }));

  async function enregistrer() {
    await soumettre(
      () =>
        utilisateursService.modifierCompte(profil.compte.id, {
          prenom: formulaire.prenom,
          nom: formulaire.nom,
          email: formulaire.email,
          telephone: formulaire.telephone,
          ...(donateur ? { nomStructure: formulaire.nomStructure } : {}),
          ...(bailleur ? { raisonSociale: formulaire.raisonSociale } : {}),
        }),
      { onSucces: onEnregistre }
    );
  }

  return (
    <ModaleFormulaire
      ouverte={ouverte}
      titre="Modifier l’utilisateur"
      sousTitre="Ses coordonnées. L’adresse électronique est celle qui lui sert à se connecter."
      onFermer={onFermer}
      onSoumettre={enregistrer}
      envoi={envoi}
      erreur={erreur}
    >
      <div className="formulaire-grille">
        {bailleur && (
          <ChampTexte
            label="Nom de l’entreprise"
            id="utilisateur-raison-sociale"
            obligatoire
            required
            maxLength={200}
            value={formulaire.raisonSociale}
            onChange={modifier('raisonSociale')}
            disabled={envoi}
            pleineLargeur
          />
        )}
        {donateur && (
          <ChampTexte
            label="Nom de la structure"
            id="utilisateur-structure"
            maxLength={200}
            value={formulaire.nomStructure}
            onChange={modifier('nomStructure')}
            disabled={envoi}
            aide="Pour une entreprise, une fondation ou une organisation. Vide pour un particulier."
            pleineLargeur
          />
        )}
        <ChampTexte
          label="Prénom"
          id="utilisateur-prenom"
          obligatoire
          maxLength={80}
          value={formulaire.prenom}
          onChange={modifier('prenom')}
          disabled={envoi}
        />
        <ChampTexte
          label="Nom"
          id="utilisateur-nom"
          obligatoire
          maxLength={80}
          value={formulaire.nom}
          onChange={modifier('nom')}
          disabled={envoi}
        />
        <ChampTexte
          label="Adresse électronique"
          id="utilisateur-email"
          type="email"
          obligatoire
          required
          maxLength={160}
          value={formulaire.email}
          onChange={modifier('email')}
          disabled={envoi}
        />
        <ChampTexte
          label="Téléphone"
          id="utilisateur-telephone"
          type="tel"
          maxLength={20}
          value={formulaire.telephone}
          onChange={modifier('telephone')}
          disabled={envoi}
        />
      </div>
    </ModaleFormulaire>
  );
}

export function useGestionUtilisateur({ onModifie, onSupprime, onStatut, libelles = {} } = {}) {
  const [demande, setDemande] = useState({ action: null, cible: null, profil: null });
  const { envoi, erreur, setErreur, soumettre } = useSoumission();
  const [erreurFenetre, setErreurFenetre] = useState('');
  const [enCours, setEnCours] = useState(false);
  const [donsRattaches, setDonsRattaches] = useState(false);

  const fermer = () => {
    setDemande({ action: null, cible: null, profil: null });
    setErreurFenetre('');
    setDonsRattaches(false);
  };

  async function demander(action, cible) {
    setErreur('');
    setErreurFenetre('');

    if (action === 'activer') {
      const service = cible.onglet === 'bailleurs' ? funderService : volunteerService;
      await soumettre(() => service.activer(cible.id), { onSucces: onStatut });
      return;
    }

    if (action === 'modifier' && !cible.profil) {
      try {
        const profil =
          cible.genre === 'fiche'
            ? await utilisateursService.profilFiche(cible.id)
            : await utilisateursService.profilCompte(cible.id);
        setDemande({ action, cible, profil });
      } catch (echec) {
        setErreur(messageErreur(echec, 'Le profil n’a pas pu être chargé.'));
      }
      return;
    }

    setDemande({ action, cible, profil: cible.profil ?? null });
  }

  async function confirmer(options = {}) {
    const { action, cible } = demande;
    setErreurFenetre('');
    setEnCours(true);
    try {
      if (action === 'supprimer') {
        const reponse = await (cible.genre === 'fiche'
          ? utilisateursService.supprimerFiche(cible.id, {
              forcer: Boolean(options.forcer),
              avecDons: Boolean(options.avecDons),
            })
          : utilisateursService.supprimerCompte(cible.id));
        fermer();
        onSupprime?.(reponse?.message ?? null);
      } else if (action === 'desactiver') {
        const service = cible.onglet === 'bailleurs' ? funderService : volunteerService;
        await service.changerStatut(cible.id, 'suspendu');
        fermer();
        onStatut?.();
      }
    } catch (echec) {
      if (echec?.response?.data?.code === 'DONATEUR_AVEC_DONS') setDonsRattaches(true);
      setErreurFenetre(messageErreur(echec, 'L’action n’a pas abouti.'));
    } finally {
      setEnCours(false);
    }
  }

  const { action, cible, profil } = demande;
  const nom = cible?.nom || 'cet utilisateur';

  const fenetres = (
    <>
      <ModifierCompteModale
        ouverte={action === 'modifier' && cible?.genre === 'compte'}
        profil={profil}
        onFermer={fermer}
        onEnregistre={() => {
          fermer();
          onModifie?.();
        }}
      />

      <DonateurModale
        ouverte={action === 'modifier' && cible?.genre === 'fiche'}
        donateur={profil?.fiche ?? null}
        libelles={libelles}
        onFermer={fermer}
        onEnregistre={() => {
          fermer();
          onModifie?.();
        }}
      />

      <ModaleConfirmation
        ouverte={action === 'supprimer'}
        titre={`Supprimer ${nom} ?`}
        message={
          cible?.genre !== 'fiche'
            ? 'Le compte ne pourra plus se connecter et quittera la liste. Ce qu’il a fait — dons, tâches, engagements — reste dans l’historique des projets.'
            : donsRattaches
              ? 'Ses dons font partie des sommes reçues par les projets. Effacer son identité retire son nom, son adresse, son téléphone et sa ville, et garde ses dons. Tout supprimer efface aussi ses dons : les sommes reçues par les projets qu’il a soutenus diminueront d’autant, et c’est irréversible.'
              : 'La fiche de ce donateur sera effacée. C’est impossible s’il a des dons enregistrés : ils font partie de l’historique des projets.'
        }
        onFermer={fermer}
        onConfirmer={() => confirmer({ forcer: donsRattaches })}
        envoi={enCours}
        erreur={donsRattaches ? '' : erreurFenetre}
        libelleConfirmer={donsRattaches ? 'Effacer son identité' : 'Supprimer'}
        danger={!donsRattaches}
        actionSecondaire={
          donsRattaches
            ? { libelle: 'Tout supprimer, dons compris', onAction: () => confirmer({ avecDons: true }) }
            : null
        }
      />

      <ModaleConfirmation
        ouverte={action === 'desactiver'}
        titre={`Désactiver le compte de ${nom} ?`}
        message="Il ne pourra plus se connecter à son espace tant que vous ne l’aurez pas réactivé. Rien n’est effacé."
        onFermer={fermer}
        onConfirmer={confirmer}
        envoi={enCours}
        erreur={erreurFenetre}
        libelleConfirmer="Désactiver"
        danger
      />
    </>
  );

  return { demander, envoi, erreur, fenetres };
}
