import { useState } from 'react';
import { useOutletContext } from 'react-router-dom';

import HopeLogo from '../../components/HopeLogo.jsx';
import { useChargement } from '../../hooks/useChargement.js';
import { messageErreur } from '../../services/api.js';
import { apiBailleur } from '../../services/apiBailleur.js';
import * as service from '../../services/bailleur.service.js';

/**
 * Declaration de l'organisation, a la premiere connexion d'un bailleur.
 *
 * Deux champs sont obligatoires en base -- raison sociale et type
 * d'organisation -- et l'inscription commune aux trois types ne peut
 * pas les demander : elle serait illisible pour un donateur. Ils sont
 * donc demandes ici, et tant qu'ils manquent l'espace n'a pas
 * d'organisation sur quoi filtrer.
 */
export default function DeclarerOrganisation() {
  // La garde nous a laisses passer : c'est elle qui nous renverra vers
  // l'espace des qu'elle aura relu l'organisation.
  const { rafraichir } = useOutletContext();
  const { donnees: types } = useChargement(() => service.typesOrganisation(), []);

  const [champs, setChamps] = useState({
    raisonSociale: '',
    typeOrganisation: '',
    secteur: '',
    pays: 'Madagascar',
    siteWeb: '',
    adresse: '',
    nif: '',
    fonction: '',
  });
  const [erreursChamps, setErreursChamps] = useState({});
  const [erreur, setErreur] = useState('');
  const [envoi, setEnvoi] = useState(false);

  function modifier(nom) {
    return (evenement) => {
      const valeur = evenement.target.value;
      setChamps((precedents) => ({ ...precedents, [nom]: valeur }));
      setErreursChamps((precedentes) => ({ ...precedentes, [nom]: undefined }));
    };
  }

  async function soumettre(evenement) {
    evenement.preventDefault();
    setErreur('');

    const details = {};
    if (champs.raisonSociale.trim() === '') details.raisonSociale = 'Champ obligatoire';
    if (champs.typeOrganisation === '') details.typeOrganisation = 'Champ obligatoire';
    if (Object.keys(details).length > 0) {
      setErreursChamps(details);
      setErreur('Le formulaire comporte des erreurs.');
      return;
    }

    setEnvoi(true);
    try {
      await apiBailleur.post('/bailleur/organisation', {
        ...champs,
        raisonSociale: champs.raisonSociale.trim(),
      });
      // La garde relit l'organisation et route d'elle-meme vers
      // l'espace : naviguer ici la trouverait avec l'ancien etat.
      await rafraichir();
    } catch (echec) {
      setErreursChamps(echec?.response?.data?.details ?? {});
      setErreur(messageErreur(echec, 'L’organisation n’a pas pu être enregistrée.'));
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <div className="completion">
      <div className="completion__carte">
        <header className="completion__entete">
          <HopeLogo />
          <h1 className="completion__titre">Votre organisation</h1>
          <p className="completion__accroche">
            Décrivez l’organisation que vous représentez. C’est elle, et non votre compte
            personnel, qui portera les engagements et les versements.
          </p>
        </header>

        <form className="completion__formulaire" onSubmit={soumettre} noValidate>
          <fieldset className="completion__groupe">
            <legend>Identité</legend>

            <Champ
              id="raisonSociale"
              libelle="Raison sociale"
              valeur={champs.raisonSociale}
              onChange={modifier('raisonSociale')}
              erreur={erreursChamps.raisonSociale}
              disabled={envoi}
              autoFocus
            />

            <div className="completion__champ">
              <label htmlFor="typeOrganisation">Type d’organisation</label>
              <select
                id="typeOrganisation"
                name="typeOrganisation"
                value={champs.typeOrganisation}
                onChange={modifier('typeOrganisation')}
                disabled={envoi}
                aria-invalid={Boolean(erreursChamps.typeOrganisation)}
              >
                <option value="">Choisissez…</option>
                {(types ?? []).map((type) => (
                  <option key={type.cle} value={type.cle}>
                    {type.libelle}
                  </option>
                ))}
              </select>
              {erreursChamps.typeOrganisation && (
                <span className="completion__erreur-champ">
                  {erreursChamps.typeOrganisation}
                </span>
              )}
            </div>

            <div className="completion__paire">
              <Champ
                id="secteur"
                libelle="Secteur"
                valeur={champs.secteur}
                onChange={modifier('secteur')}
                disabled={envoi}
                placeholder="Éducation, santé…"
              />
              <Champ
                id="pays"
                libelle="Pays"
                valeur={champs.pays}
                onChange={modifier('pays')}
                disabled={envoi}
              />
            </div>
          </fieldset>

          <fieldset className="completion__groupe">
            <legend>Coordonnées</legend>

            <Champ
              id="adresse"
              libelle="Adresse"
              valeur={champs.adresse}
              onChange={modifier('adresse')}
              disabled={envoi}
            />
            <div className="completion__paire">
              <Champ
                id="siteWeb"
                libelle="Site web"
                valeur={champs.siteWeb}
                onChange={modifier('siteWeb')}
                disabled={envoi}
                placeholder="https://…"
              />
              <Champ
                id="nif"
                libelle="Numéro fiscal (NIF)"
                valeur={champs.nif}
                onChange={modifier('nif')}
                disabled={envoi}
                aide="Utile pour vos justificatifs."
              />
            </div>
          </fieldset>

          <fieldset className="completion__groupe">
            <legend>Votre rôle</legend>

            <Champ
              id="fonction"
              libelle="Fonction"
              valeur={champs.fonction}
              onChange={modifier('fonction')}
              disabled={envoi}
              placeholder="Responsable partenariats"
              aide="Vous serez enregistré comme contact principal de l’organisation."
            />
          </fieldset>

          <p className="completion__note">
            Aucun versement ne se fait dans cette application. Les financements arrivent par
            virement et l’équipe HOPE les enregistre ensuite.
          </p>

          {erreur && (
            <p className="completion__erreur" role="alert">
              {erreur}
            </p>
          )}

          <div className="completion__pied">
            <button type="submit" className="completion__bouton" disabled={envoi}>
              {envoi ? 'Enregistrement…' : 'Accéder à mon espace'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/** Un champ de saisie du formulaire de completion. */
function Champ({ id, libelle, valeur, onChange, aide, erreur, type = 'text', ...reste }) {
  return (
    <div className="completion__champ">
      <label htmlFor={id}>{libelle}</label>
      <input
        id={id}
        name={id}
        type={type}
        value={valeur}
        onChange={onChange}
        aria-invalid={Boolean(erreur)}
        {...reste}
      />
      {erreur && <span className="completion__erreur-champ">{erreur}</span>}
      {!erreur && aide && <span className="completion__aide">{aide}</span>}
    </div>
  );
}
