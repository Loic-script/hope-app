import { useEffect, useMemo, useRef, useState } from 'react';

import { messageErreur } from '../../services/api.js';
import * as service from '../../services/messagerie.service.js';
import { Section } from './ActionsFil.jsx';
import Dialogue from './Dialogue.jsx';
import { correspond, initiales } from './outils.js';

/** Participants d'un groupe, createur compris. */
const MAX_PARTICIPANTS = 50;
const NOM_MAX = 80;
const PHOTO_MAX = 8 * 1024 * 1024;

/**
 * La liste des personnes a cocher, avec sa recherche et ses etiquettes.
 *
 * @param {{ personnes: object[]|null, choisis: object[], onChange: (choisis: object[]) => void,
 *           maximum: number, desactive: boolean }} props
 */
function ChoixPersonnes({ personnes, choisis, onChange, maximum, desactive }) {
  const [recherche, setRecherche] = useState('');

  const visibles = useMemo(
    () => (personnes ?? []).filter((p) => correspond(recherche, p.nom, p.sousTitre)),
    [personnes, recherche]
  );

  const basculer = (element) =>
    onChange(
      choisis.some((c) => c.cle === element.cle)
        ? choisis.filter((c) => c.cle !== element.cle)
        : choisis.length >= maximum
          ? choisis
          : [...choisis, element]
    );

  return (
    <>
      <label className="msg-recherche msg-transfert__recherche">
        <span className="sr-only">Rechercher une personne</span>
        <input
          type="search"
          value={recherche}
          onChange={(evenement) => setRecherche(evenement.target.value)}
          placeholder="Rechercher une personne…"
          disabled={desactive}
        />
      </label>

      {choisis.length > 0 && (
        <ul className="msg-etiquettes msg-transfert__choisis" aria-label="Personnes choisies">
          {choisis.map((choix) => (
            <li key={choix.cle} className="msg-etiquette">
              <span className="msg-etiquette__nom">{choix.nom}</span>
              <button
                type="button"
                className="msg-etiquette__retirer"
                onClick={() => basculer(choix)}
                disabled={desactive}
                aria-label={`Retirer ${choix.nom}`}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="msg-transfert__liste">
        {personnes === null ? (
          <p className="msg-liste__vide">Chargement…</p>
        ) : visibles.length === 0 ? (
          <p className="msg-liste__vide">
            {personnes.length === 0 ? 'Personne à ajouter.' : `Rien ne correspond à « ${recherche} ».`}
          </p>
        ) : (
          <Section
            titre="Personnes"
            elements={visibles.map((p) => ({
              cle: `${p.type}:${p.id}`,
              type: p.type,
              id: p.id,
              nom: p.nom,
              sousTitre: p.sousTitre,
              photoUrl: p.photoUrl,
            }))}
            estChoisi={(cle) => choisis.some((c) => c.cle === cle)}
            plein={choisis.length >= maximum}
            onBasculer={basculer}
            desactive={desactive}
          />
        )}
      </div>
    </>
  );
}

/**
 * Creer un groupe : un nom, une photo facultative, des participants.
 *
 * @param {{ api: object, racine: string, onCree: (id: number) => void }} props
 */
export function BoutonCreerGroupe({ api, racine, onCree }) {
  const [ouvert, setOuvert] = useState(false);
  const [nom, setNom] = useState('');
  const [photo, setPhoto] = useState(null);
  const [apercu, setApercu] = useState(null);
  const [personnes, setPersonnes] = useState(null);
  const [choisis, setChoisis] = useState([]);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState('');
  const champPhoto = useRef(null);

  useEffect(() => {
    if (!ouvert) return undefined;
    setNom('');
    setPhoto(null);
    setChoisis([]);
    setErreur('');
    setPersonnes(null);
    let annule = false;
    service
      .joignables(api, racine)
      // L'equipe en bloc n'est pas une personne : elle ne se met pas dans un groupe.
      .then((items) => !annule && setPersonnes(items.filter((p) => p.type !== 'equipe')))
      .catch((echec) => !annule && setErreur(messageErreur(echec, 'La liste des personnes n’a pas pu être chargée.')));
    return () => {
      annule = true;
    };
  }, [ouvert, api, racine]);

  // L'apercu de la photo, libere quand il change.
  useEffect(() => {
    if (!photo) {
      setApercu(null);
      return undefined;
    }
    const url = URL.createObjectURL(photo);
    setApercu(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);

  function choisirPhoto(fichier) {
    if (!fichier) return;
    if (!fichier.type.startsWith('image/')) {
      setErreur('La photo du groupe doit être une image.');
      return;
    }
    if (fichier.size > PHOTO_MAX) {
      setErreur('La photo dépasse 8 Mo.');
      return;
    }
    setErreur('');
    setPhoto(fichier);
  }

  const nomPropre = nom.replace(/\s+/g, ' ').trim();
  const pret = nomPropre !== '' && choisis.length > 0 && !envoi;

  async function creer() {
    if (!pret) return;
    setEnvoi(true);
    setErreur('');
    try {
      const id = await service.creerGroupe(api, racine, {
        nom: nomPropre,
        participants: choisis.map((c) => ({ type: c.type, id: c.id })),
        photo,
      });
      setOuvert(false);
      onCree(id);
    } catch (echec) {
      setErreur(messageErreur(echec, 'Le groupe n’a pas pu être créé.'));
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <>
      <button type="button" className="btn btn--principal btn--petit msg-liste__groupe" onClick={() => setOuvert(true)}>
        Créer un groupe
      </button>

      <Dialogue
        ouvert={ouvert}
        titre="Créer un groupe"
        onFermer={() => setOuvert(false)}
        bloque={envoi}
        large
        pied={
          <>
            <span className="msg-transfert__compteur">
              {choisis.length + 1} participant{choisis.length > 0 ? 's' : ''} avec vous · {MAX_PARTICIPANTS} au plus
            </span>
            <button type="button" className="btn btn--neutre" onClick={() => setOuvert(false)} disabled={envoi}>
              Annuler
            </button>
            <button type="button" className="btn btn--principal" onClick={creer} disabled={!pret}>
              {envoi ? 'Création…' : 'Créer le groupe'}
            </button>
          </>
        }
      >
        <div className="msg-groupe__entete">
          <button
            type="button"
            className="msg-groupe__photo"
            onClick={() => champPhoto.current?.click()}
            disabled={envoi}
            aria-label={photo ? 'Changer la photo du groupe' : 'Ajouter une photo au groupe'}
          >
            {apercu ? <img src={apercu} alt="" /> : <span aria-hidden="true">{nomPropre ? initiales(nomPropre) : '📷'}</span>}
          </button>
          <input
            ref={champPhoto}
            type="file"
            accept="image/*"
            hidden
            onChange={(evenement) => {
              choisirPhoto(evenement.target.files?.[0]);
              evenement.target.value = '';
            }}
          />
          <label className="msg-groupe__nom">
            <span className="msg-groupe__libelle">Nom du groupe</span>
            <input
              type="text"
              value={nom}
              maxLength={NOM_MAX}
              onChange={(evenement) => setNom(evenement.target.value)}
              placeholder="Comité du jardin potager"
              disabled={envoi}
              required
            />
            <span className="msg-groupe__aide">
              {nom.length}/{NOM_MAX} · photo facultative : à défaut, les initiales
            </span>
          </label>
        </div>

        {erreur && (
          <p className="msg-dialogue__erreur" role="alert">
            {erreur}
          </p>
        )}

        <ChoixPersonnes
          personnes={personnes}
          choisis={choisis}
          onChange={setChoisis}
          maximum={MAX_PARTICIPANTS - 1}
          desactive={envoi}
        />
      </Dialogue>
    </>
  );
}

/**
 * Les actions d'un groupe, dans le panneau : ajouter des participants,
 * quitter le groupe.
 *
 * @param {{ api: object, racine: string, conversation: object,
 *           onAjoutes: () => void, onQuitte: (nom: string) => void }} props
 */
export function ActionsGroupe({ api, racine, conversation, onAjoutes, onQuitte }) {
  const [ajout, setAjout] = useState(false);
  const [depart, setDepart] = useState(false);
  const [personnes, setPersonnes] = useState(null);
  const [choisis, setChoisis] = useState([]);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState('');

  const places = MAX_PARTICIPANTS - conversation.participants.length;

  useEffect(() => {
    if (!ajout) return undefined;
    setChoisis([]);
    setErreur('');
    setPersonnes(null);
    let annule = false;
    const presents = new Set(conversation.participants.map((p) => `${p.type}:${p.id}`));
    service
      .joignables(api, racine)
      // Seulement ceux qui ne sont pas deja dans le groupe.
      .then((items) => !annule && setPersonnes(items.filter((p) => p.type !== 'equipe' && !presents.has(`${p.type}:${p.id}`))))
      .catch((echec) => !annule && setErreur(messageErreur(echec, 'La liste des personnes n’a pas pu être chargée.')));
    return () => {
      annule = true;
    };
  }, [ajout, api, racine, conversation.participants]);

  async function ajouter() {
    setEnvoi(true);
    setErreur('');
    try {
      await service.ajouterAuGroupe(api, racine, conversation.id, choisis.map((c) => ({ type: c.type, id: c.id })));
      setAjout(false);
      onAjoutes();
    } catch (echec) {
      setErreur(messageErreur(echec, 'Les participants n’ont pas pu être ajoutés.'));
    } finally {
      setEnvoi(false);
    }
  }

  async function quitter() {
    setEnvoi(true);
    setErreur('');
    try {
      await service.quitterGroupe(api, racine, conversation.id);
      setDepart(false);
      onQuitte(conversation.nom);
    } catch (echec) {
      setErreur(messageErreur(echec, 'Vous n’avez pas pu quitter le groupe.'));
      setEnvoi(false);
    }
  }

  return (
    <div className="msg-panneau__actions">
      <button type="button" className="btn btn--neutre" onClick={() => setAjout(true)} disabled={places <= 0}>
        Ajouter des participants
      </button>
      <button type="button" className="btn btn--neutre msg-panneau__quitter" onClick={() => setDepart(true)}>
        Quitter le groupe
      </button>

      <Dialogue
        ouvert={ajout}
        titre="Ajouter des participants"
        onFermer={() => setAjout(false)}
        bloque={envoi}
        large
        pied={
          <>
            <span className="msg-transfert__compteur">
              {choisis.length} sélectionné{choisis.length > 1 ? 's' : ''} · {places} place{places > 1 ? 's' : ''} restante{places > 1 ? 's' : ''}
            </span>
            <button type="button" className="btn btn--neutre" onClick={() => setAjout(false)} disabled={envoi}>
              Annuler
            </button>
            <button type="button" className="btn btn--principal" onClick={ajouter} disabled={envoi || choisis.length === 0}>
              {envoi ? 'Ajout…' : `Ajouter (${choisis.length})`}
            </button>
          </>
        }
      >
        {erreur && (
          <p className="msg-dialogue__erreur" role="alert">
            {erreur}
          </p>
        )}
        <ChoixPersonnes personnes={personnes} choisis={choisis} onChange={setChoisis} maximum={places} desactive={envoi} />
      </Dialogue>

      <Dialogue
        ouvert={depart}
        titre="Quitter le groupe ?"
        onFermer={() => setDepart(false)}
        bloque={envoi}
        pied={
          <>
            <button type="button" className="btn btn--neutre" onClick={() => setDepart(false)} disabled={envoi}>
              Annuler
            </button>
            <button type="button" className="btn btn--danger" onClick={quitter} disabled={envoi}>
              {envoi ? 'Départ…' : 'Quitter'}
            </button>
          </>
        }
      >
        <p className="msg-dialogue__texte">
          Vous ne verrez plus « {conversation.nom} ». Vos messages y restent pour les autres participants.
        </p>
        {erreur && (
          <p className="msg-dialogue__erreur" role="alert">
            {erreur}
          </p>
        )}
      </Dialogue>
    </div>
  );
}
