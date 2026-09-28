import { useEffect, useState } from 'react';

import { ChampSelection, ChampTexte, ModaleFormulaire } from './forms.jsx';
import { useSoumission } from '../../hooks/useChargement.js';
import { api } from '../../services/api.js';

/**
 * Creer un benevole ou un bailleur depuis l'administration.
 *
 * Le compte est ouvert d'emblee ; un mot de passe est genere et part par
 * courriel avec un lien vers la connexion. Le bailleur arrive avec son
 * organisation ; le benevole remplira sa fiche a sa premiere connexion.
 */
const VIDE = { prenom: '', nom: '', email: '', telephone: '', organisation: '', typeOrganisation: '', fonction: '' };

export default function CompteParEquipeModale({ type, ouverte, onFermer, onCree }) {
  const [champs, setChamps] = useState(VIDE);
  const [types, setTypes] = useState([]);
  const { envoi, erreur, setErreur, soumettre } = useSoumission();
  const bailleur = type === 'bailleur';

  useEffect(() => {
    if (!ouverte) return;
    setChamps(VIDE);
    setErreur('');
    if (bailleur && types.length === 0) {
      api
        .get('/bailleur/types-organisation')
        .then(({ data }) => setTypes(data.items ?? []))
        .catch(() => {});
    }
  }, [ouverte, bailleur, types.length, setErreur]);

  const modifier = (champ) => (e) => setChamps((c) => ({ ...c, [champ]: e.target.value }));

  async function enregistrer() {
    await soumettre(
      async () => {
        const { data } = await api.post('/admin/utilisateurs/comptes', {
          type: bailleur ? 'BAILLEUR' : 'BENEVOLE',
          prenom: champs.prenom,
          nom: champs.nom,
          email: champs.email,
          telephone: champs.telephone || null,
          ...(bailleur
            ? { organisation: champs.organisation, typeOrganisation: champs.typeOrganisation || null, fonction: champs.fonction || null }
            : {}),
        });
        return data;
      },
      { onSucces: onCree }
    );
  }

  return (
    <ModaleFormulaire
      ouverte={ouverte}
      titre={bailleur ? 'Nouveau bailleur' : 'Nouveau bénévole'}
      sousTitre="Le compte est ouvert tout de suite. Un mot de passe est généré et envoyé par courriel, avec un lien vers la connexion."
      onFermer={onFermer}
      onSoumettre={enregistrer}
      envoi={envoi}
      erreur={erreur}
      libelleValider="Créer et envoyer les accès"
      large={bailleur}
    >
      <div className="formulaire-grille">
        <ChampTexte label="Prénom" id="compte-prenom" obligatoire required value={champs.prenom} onChange={modifier('prenom')} disabled={envoi} />
        <ChampTexte label="Nom" id="compte-nom" obligatoire required value={champs.nom} onChange={modifier('nom')} disabled={envoi} />
        <ChampTexte
          label="Adresse électronique"
          id="compte-email"
          type="email"
          obligatoire
          required
          value={champs.email}
          onChange={modifier('email')}
          placeholder="prenom@exemple.mg"
          aide="Elle sert d’identifiant et reçoit le mot de passe."
          disabled={envoi}
        />
        <ChampTexte
          label="Téléphone"
          id="compte-telephone"
          type="tel"
          value={champs.telephone}
          onChange={modifier('telephone')}
          placeholder="+261 34 00 000 00"
          disabled={envoi}
        />
        {bailleur && (
          <>
            <ChampTexte
              label="Organisation"
              id="compte-organisation"
              obligatoire
              required
              value={champs.organisation}
              onChange={modifier('organisation')}
              placeholder="Ex. Fondation Mada Avenir"
              disabled={envoi}
            />
            <ChampSelection
              label="Type d’organisation"
              id="compte-type-organisation"
              value={champs.typeOrganisation}
              onChange={modifier('typeOrganisation')}
              options={types.filter((t) => t.cle !== 'autre').map((t) => ({ valeur: t.cle, label: t.libelle }))}
              vide="À préciser"
              disabled={envoi}
            />
            <ChampTexte
              label="Fonction dans l’organisation"
              id="compte-fonction"
              value={champs.fonction}
              onChange={modifier('fonction')}
              placeholder="Ex. Chargée de partenariats"
              disabled={envoi}
              pleineLargeur
            />
          </>
        )}
      </div>
    </ModaleFormulaire>
  );
}
