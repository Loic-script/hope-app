import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';

import ChampPhotoProfil from '../../components/ChampPhotoProfil.jsx';
import SecuriteCompte from '../../components/compte/SecuriteCompte.jsx';
import { useChargement } from '../../hooks/useChargement.js';
import { messageErreur } from '../../services/api.js';
import * as service from '../../services/bailleur.service.js';
import * as fmt from '../../utils/format.js';
import { EntetePage, Panneau, Pastille } from './composants.jsx';

export default function Organisation() {
  const { bailleur, rafraichirBailleur } = useOutletContext();
  const { donnees, chargement, erreur, recharger } = useChargement(() => service.profil(), []);
  const { donnees: types } = useChargement(() => service.typesOrganisation(), []);

  const [fonction, setFonction] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [identite, setIdentite] = useState({ prenom: '', nom: '', telephone: '' });
  const [envoi, setEnvoi] = useState(false);
  const [refus, setRefus] = useState('');
  const [succes, setSucces] = useState('');

  const [fiche, setFiche] = useState({
    raisonSociale: '',
    typeOrganisation: '',
    secteur: '',
    pays: '',
    adresse: '',
    siteWeb: '',
    nif: '',
  });
  const [envoiFiche, setEnvoiFiche] = useState(false);
  const [refusFiche, setRefusFiche] = useState('');
  const [succesFiche, setSuccesFiche] = useState('');
  const [erreursChamps, setErreursChamps] = useState({});

  useEffect(() => {
    setFonction(bailleur?.fonction ?? '');
    setPhotoUrl(bailleur?.photoUrl ?? '');
    setIdentite({
      prenom: bailleur?.prenom ?? '',
      nom: bailleur?.nom ?? '',
      telephone: bailleur?.telephone ?? '',
    });
  }, [bailleur?.fonction, bailleur?.photoUrl, bailleur?.prenom, bailleur?.nom, bailleur?.telephone]);

  useEffect(() => {
    if (!bailleur) return;
    setFiche({
      raisonSociale: bailleur.raisonSociale ?? '',
      typeOrganisation: bailleur.typeOrganisation ?? '',
      secteur: bailleur.secteur ?? '',
      pays: bailleur.pays ?? '',
      adresse: bailleur.adresse ?? '',
      siteWeb: bailleur.siteWeb ?? '',
      nif: bailleur.nif ?? '',
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bailleur?.bailleurId, bailleur?.raisonSociale, bailleur?.typeOrganisation]);

  function modifier(nom, valeur) {
    setFiche((precedente) => ({ ...precedente, [nom]: valeur }));
    setErreursChamps((precedentes) => ({ ...precedentes, [nom]: undefined }));
  }

  async function enregistrerFiche(evenement) {
    evenement.preventDefault();
    setEnvoiFiche(true);
    setRefusFiche('');
    setSuccesFiche('');
    setErreursChamps({});
    try {
      await service.mettreAJourOrganisation(fiche);
      setSuccesFiche('La fiche de votre organisation est à jour.');
      rafraichirBailleur?.();
    } catch (echec) {
      setErreursChamps(echec?.response?.data?.details ?? {});
      setRefusFiche(messageErreur(echec, 'La fiche n’a pas pu être enregistrée.'));
    } finally {
      setEnvoiFiche(false);
    }
  }

  async function enregistrer(evenement) {
    evenement.preventDefault();
    setEnvoi(true);
    setRefus('');
    setSucces('');
    try {
      const sansNom = (champ) => identite[champ].trim() === '' && !bailleur?.[champ];
      await service.mettreAJourContact({
        fonction,
        photoUrl,
        prenom: sansNom('prenom') ? undefined : identite.prenom,
        nom: sansNom('nom') ? undefined : identite.nom,
        telephone: identite.telephone,
      });
      setSucces('Votre fiche est à jour.');
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
  const aPreciser = bailleur?.typeOrganisation === 'autre';

  return (
    <>
      <EntetePage
        titre="Mon organisation"
        accroche="La fiche de votre organisation chez HOPE, et les personnes qui y ont accès."
      />

      {erreur && <p className="alerte-bailleur">{erreur}</p>}

      <div className="deux-colonnes">
        <Panneau
          titre="Identité"
          sousTitre="Ces informations figurent sur vos conventions et vos certificats"
        >
          {aPreciser && (
            <p className="note-fiche">
              Votre organisation a été créée avec votre compte, sous un nom provisoire.
              Complétez-la ici : c’est ce nom qui apparaîtra sur vos documents.
            </p>
          )}

          <form className="formulaire-bailleur" onSubmit={enregistrerFiche}>
            <ChampFiche
              id="raisonSociale"
              libelle="Raison sociale"
              valeur={fiche.raisonSociale}
              onChange={(v) => modifier('raisonSociale', v)}
              erreur={erreursChamps.raisonSociale}
              disabled={envoiFiche}
              placeholder="Fondation Avenir Océan Indien"
            />

            <div className="champ-bailleur">
              <label htmlFor="typeOrganisation">Type d’organisation</label>
              <select
                id="typeOrganisation"
                name="typeOrganisation"
                value={fiche.typeOrganisation}
                onChange={(e) => modifier('typeOrganisation', e.target.value)}
                disabled={envoiFiche}
                aria-invalid={Boolean(erreursChamps.typeOrganisation)}
              >
                <option value="">Choisir…</option>
                {(types ?? []).map((type) => (
                  <option key={type.cle} value={type.cle}>
                    {type.libelle}
                  </option>
                ))}
              </select>
              {erreursChamps.typeOrganisation && (
                <span className="champ-bailleur__erreur">{erreursChamps.typeOrganisation}</span>
              )}
            </div>

            <ChampFiche
              id="secteur"
              libelle="Secteur"
              valeur={fiche.secteur}
              onChange={(v) => modifier('secteur', v)}
              disabled={envoiFiche}
              placeholder="Éducation, santé, télécommunications…"
            />
            <ChampFiche
              id="pays"
              libelle="Pays"
              valeur={fiche.pays}
              onChange={(v) => modifier('pays', v)}
              disabled={envoiFiche}
              placeholder="Madagascar"
            />

            <div className="champ-bailleur">
              <label htmlFor="adresse">Adresse</label>
              <textarea
                id="adresse"
                name="adresse"
                rows={2}
                value={fiche.adresse}
                onChange={(e) => modifier('adresse', e.target.value)}
                disabled={envoiFiche}
                placeholder="Lot II M 85 Bis, Antananarivo"
              />
            </div>

            <ChampFiche
              id="siteWeb"
              libelle="Site web"
              valeur={fiche.siteWeb}
              onChange={(v) => modifier('siteWeb', v)}
              disabled={envoiFiche}
              placeholder="https://…"
            />
            <ChampFiche
              id="nif"
              libelle="Numéro fiscal (NIF)"
              valeur={fiche.nif}
              onChange={(v) => modifier('nif', v)}
              disabled={envoiFiche}
              aide="Il figure sur les justificatifs que HOPE vous adresse."
            />

            <dl className="fiche-part">
              <Ligne
                terme="Partenaire depuis"
                valeur={bailleur?.partenaireDepuis ? fmt.date(bailleur.partenaireDepuis) : null}
              />
            </dl>

            {refusFiche && <p className="alerte-bailleur">{refusFiche}</p>}
            {succesFiche && <p className="succes-bailleur">{succesFiche}</p>}

            <button type="submit" className="bouton-bailleur" disabled={envoiFiche}>
              {envoiFiche ? 'Enregistrement…' : 'Enregistrer la fiche'}
            </button>
          </form>

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
            <ChampPhotoProfil
              valeur={photoUrl}
              nom={`${bailleur?.prenom ?? ''} ${bailleur?.nom ?? ''}`.trim() || bailleur?.email}
              televerser={service.televerserPhoto}
              onChange={setPhotoUrl}
              disabled={envoi}
              aide="Une image — JPEG, PNG ou WebP. Elle accompagne vos messages à l’équipe."
            />

            <dl className="fiche-part">
              <Ligne terme="Adresse électronique" valeur={bailleur?.email} />
            </dl>

            <ChampFiche
                id="prenomContact"
                libelle="Prénom"
                valeur={identite.prenom}
                onChange={(v) => setIdentite((i) => ({ ...i, prenom: v }))}
                disabled={envoi}
                autoComplete="given-name"
              />
              <ChampFiche
                id="nomContact"
                libelle="Nom"
                valeur={identite.nom}
                onChange={(v) => setIdentite((i) => ({ ...i, nom: v }))}
                disabled={envoi}
                autoComplete="family-name"
              />
            <ChampFiche
              id="telephoneContact"
              libelle="Téléphone"
              type="tel"
              valeur={identite.telephone}
              onChange={(v) => setIdentite((i) => ({ ...i, telephone: v }))}
              disabled={envoi}
              autoComplete="tel"
              placeholder="+261 34 12 345 67"
            />

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
                Votre adresse électronique vient de votre compte.
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

      <SecuriteCompte espace="bailleur" />
    </>
  );
}

function ChampFiche({ id, libelle, valeur, onChange, erreur, aide, ...reste }) {
  return (
    <div className="champ-bailleur">
      <label htmlFor={id}>{libelle}</label>
      <input
        id={id}
        name={id}
        type="text"
        value={valeur}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={Boolean(erreur)}
        {...reste}
      />
      {erreur ? (
        <span className="champ-bailleur__erreur">{erreur}</span>
      ) : (
        aide && <span className="champ-bailleur__aide">{aide}</span>
      )}
    </div>
  );
}

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
