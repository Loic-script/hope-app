import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';

import ChampPhotoProfil from '../../components/ChampPhotoProfil.jsx';
import { useChargement } from '../../hooks/useChargement.js';
import { messageErreur } from '../../services/api.js';
import * as service from '../../services/bailleur.service.js';
import * as fmt from '../../utils/format.js';
import { EntetePage, Panneau, Pastille } from './composants.jsx';

/**
 * Mon organisation.
 *
 * Presque tout est en lecture : la raison sociale, le pays, le niveau
 * de partenariat et les distinctions relevent de HOPE. La seule chose
 * que le bailleur modifie ici est sa propre fonction -- c'est la seule
 * ecriture que l'espace lui autorise sur ses donnees.
 */
export default function Organisation() {
  const { bailleur, rafraichirBailleur } = useOutletContext();
  const { donnees, chargement, erreur, recharger } = useChargement(() => service.profil(), []);

  const [fonction, setFonction] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const [refus, setRefus] = useState('');
  const [succes, setSucces] = useState('');

  useEffect(() => {
    setFonction(bailleur?.fonction ?? '');
    setPhotoUrl(bailleur?.photoUrl ?? '');
  }, [bailleur?.fonction, bailleur?.photoUrl]);

  async function enregistrer(evenement) {
    evenement.preventDefault();
    setEnvoi(true);
    setRefus('');
    setSucces('');
    try {
      // La photo part avec le reste : televersee, elle n'est rattachee
      // au compte qu'ici. Sans ce champ, elle disparaitrait au
      // rechargement.
      await service.mettreAJourContact({ fonction, photoUrl });
      setSucces('Votre fiche est à jour.');
      // Le bandeau porte la photo : il doit relire la fiche.
      rafraichirBailleur?.();
      recharger();
    } catch (echec) {
      setRefus(messageErreur(echec, 'La modification n’a pas pu être enregistrée.'));
    } finally {
      setEnvoi(false);
    }
  }

  const contacts = donnees?.contacts ?? [];
  const distinctions = donnees?.distinctions ?? [];

  return (
    <>
      <EntetePage
        titre="Mon organisation"
        accroche="La fiche de votre organisation chez HOPE, et les personnes qui y ont accès."
      />

      {erreur && <p className="alerte-bailleur">{erreur}</p>}

      <div className="deux-colonnes">
        <Panneau titre="Identité" sousTitre="Ces informations sont tenues par l’équipe HOPE">
          <dl className="fiche-part">
            <Ligne terme="Raison sociale" valeur={bailleur?.raisonSociale} />
            <Ligne terme="Type d’organisation" valeur={bailleur?.typeLibelle} />
            <Ligne terme="Secteur" valeur={bailleur?.secteur} />
            <Ligne terme="Pays" valeur={bailleur?.pays} />
            <Ligne terme="Adresse" valeur={bailleur?.adresse} />
            <Ligne terme="Site web" valeur={bailleur?.siteWeb} lien />
            <Ligne terme="Numéro fiscal (NIF)" valeur={bailleur?.nif} />
            <Ligne
              terme="Partenaire depuis"
              valeur={bailleur?.partenaireDepuis ? fmt.date(bailleur.partenaireDepuis) : null}
            />
          </dl>

          {distinctions.length > 0 && (
            <div className="distinctions">
              <p className="distinctions__titre">Distinctions</p>
              {distinctions.map((distinction) => (
                <span key={distinction.code} className="distinction" title={distinction.regle ?? ''}>
                  {distinction.libelle}
                  <span className="distinction__date">{fmt.date(distinction.obtenueLe)}</span>
                </span>
              ))}
            </div>
          )}
        </Panneau>

        <Panneau titre="Ma fiche de contact">
          <form className="formulaire-bailleur" onSubmit={enregistrer}>
            {/* La photo se voit partout ou ce contact prend la parole :
                l'en-tete de l'espace, et ses messages. */}
            <ChampPhotoProfil
              valeur={photoUrl}
              nom={`${bailleur?.prenom ?? ''} ${bailleur?.nom ?? ''}`.trim()}
              televerser={service.televerserPhoto}
              onChange={setPhotoUrl}
              disabled={envoi}
              aide="Une image — JPEG, PNG ou WebP. Elle accompagne vos messages à l’équipe."
            />

            <dl className="fiche-part">
              <Ligne terme="Nom" valeur={`${bailleur?.prenom ?? ''} ${bailleur?.nom ?? ''}`.trim()} />
              <Ligne terme="Adresse électronique" valeur={bailleur?.email} />
            </dl>

            <div className="champ-bailleur">
              <label htmlFor="fonction">Fonction</label>
              <input
                id="fonction"
                name="fonction"
                type="text"
                value={fonction}
                onChange={(e) => setFonction(e.target.value)}
                placeholder="Responsable partenariats"
                disabled={envoi}
              />
              <span className="champ-bailleur__aide">
                Le reste de la fiche est tenu par l’équipe HOPE.
              </span>
            </div>

            {refus && <p className="alerte-bailleur">{refus}</p>}
            {succes && <p className="succes-bailleur">{succes}</p>}

            <button type="submit" className="bouton-bailleur" disabled={envoi}>
              {envoi ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          </form>
        </Panneau>
      </div>

      <Panneau
        titre="Personnes ayant accès"
        sousTitre="Pour ajouter ou retirer un accès, contactez l’équipe HOPE"
      >
        {chargement && contacts.length === 0 ? (
          <p className="vide-bailleur">Chargement…</p>
        ) : (
          <ul className="lignes">
            {contacts.map((contact) => (
              <li key={contact.id} className="ligne">
                <div className="ligne__gauche">
                  <strong>
                    {`${contact.prenom ?? ''} ${contact.nom ?? ''}`.trim() || 'Compte non ouvert'}
                  </strong>
                  <span className="ligne__meta">
                    {contact.fonction ?? 'Fonction non renseignée'}
                    {contact.email && ` · ${contact.email}`}
                  </span>
                </div>
                <div className="ligne__droite">
                  {contact.contactPrincipal && <Pastille teinte="violet">Contact principal</Pastille>}
                  <Pastille teinte={contact.actif ? 'vert' : 'gris'}>
                    {contact.actif ? 'Actif' : 'Désactivé'}
                  </Pastille>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panneau>
    </>
  );
}

/** Une ligne de fiche en lecture. */
function Ligne({ terme, valeur, lien = false }) {
  return (
    <div className="fiche-part__ligne">
      <dt>{terme}</dt>
      <dd>
        {!valeur ? (
          <span className="fiche-part__vide">Non renseigné</span>
        ) : lien ? (
          <a href={valeur} target="_blank" rel="noopener noreferrer">
            {valeur}
          </a>
        ) : (
          valeur
        )}
      </dd>
    </div>
  );
}
