import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { useChargement } from '../../hooks/useChargement.js';
import { messageErreur } from '../../services/api.js';
import * as service from '../../services/espaceBenevole.service.js';
import * as fmt from '../../utils/format.js';
import {
  EtiquetteFormat,
  Pastille,
  STATUTS_INSCRIPTION,
  STATUTS_MISSION,
  teinteInscription,
} from './composants.jsx';

/** Les statuts d'inscription qui occupent une place. */
const OCCUPANTS = ['inscrit', 'confirme', 'present'];

/**
 * Detail d'une mission, et le geste qui va avec.
 *
 * C'est l'ecran ou l'on s'inscrit, ou l'on se retire, et ou l'on donne
 * son avis une fois la mission faite. Le bouton dit toujours ce qui va
 * se passer, et pourquoi il est parfois indisponible.
 */
export default function MissionDetail() {
  const { id } = useParams();
  const { donnees: mission, chargement, erreur, recharger } = useChargement(
    () => service.recupererMission(id),
    [id]
  );

  const [envoi, setEnvoi] = useState(false);
  const [message, setMessage] = useState('');
  const [refus, setRefus] = useState('');

  async function agir(action) {
    setEnvoi(true);
    setMessage('');
    setRefus('');
    try {
      await action();
      recharger();
    } catch (echec) {
      setRefus(messageErreur(echec, 'Action impossible pour le moment.'));
    } finally {
      setEnvoi(false);
    }
  }

  if (chargement && !mission) {
    return <p className="bloc__vide">Chargement de la mission…</p>;
  }
  if (erreur) {
    return (
      <>
        <p className="alerte-benevole">{erreur}</p>
        <Link className="bloc__lien" to="/benevole/missions">
          Retour aux missions
        </Link>
      </>
    );
  }
  if (!mission) return null;

  const monStatut = mission.monInscriptionStatut;
  const inscrit = OCCUPANTS.includes(monStatut);
  const passee = new Date(mission.dateDebut) < new Date();
  const complete = mission.placesRestantes <= 0;
  const fermee = ['annulee', 'terminee'].includes(mission.statut);

  /** Ce qui empeche de s'inscrire, formule pour un humain. */
  const empechement = inscrit
    ? null
    : mission.statut === 'annulee'
      ? 'Cette mission a été annulée.'
      : passee || mission.statut === 'terminee'
        ? 'Cette mission est passée : les inscriptions sont closes.'
        : complete
          ? 'Toutes les places sont prises.'
          : null;

  return (
    <>
      <Link className="fil-retour" to="/benevole/missions">
        ← Toutes les missions
      </Link>

      <header className="mission__entete">
        <div className="mission__etiquettes">
          <EtiquetteFormat format={mission.format} />
          <Pastille valeur={mission.statut} libelles={STATUTS_MISSION} teinte="gris" />
          {monStatut && (
            <Pastille
              valeur={monStatut}
              libelles={STATUTS_INSCRIPTION}
              teinte={teinteInscription(monStatut)}
            />
          )}
        </div>

        <h1 className="mission__titre">{mission.titre}</h1>
        {mission.projetNom && (
          <p className="mission__projet">
            Projet : <strong>{mission.projetNom}</strong>
            {mission.projetReference && ` · ${mission.projetReference}`}
          </p>
        )}
      </header>

      <div className="mission__corps">
        <div className="mission__principal">
          {mission.description && <p className="mission__description">{mission.description}</p>}

          <dl className="mission__faits">
            <Fait terme="Début" valeur={fmt.dateHeure(mission.dateDebut)} />
            <Fait terme="Horaires" valeur={fmt.plageHoraire(mission.dateDebut, mission.dateFin)} />
            {mission.lieuNom && <Fait terme="Lieu" valeur={mission.lieuNom} />}
            {mission.recurrence && <Fait terme="Récurrence" valeur={mission.recurrence} />}
            {mission.encadreurNom && <Fait terme="Encadrant" valeur={mission.encadreurNom} />}
            <Fait
              terme="Places"
              valeur={
                complete
                  ? `complète (${mission.placesTotal})`
                  : `${mission.placesRestantes} libres sur ${mission.placesTotal}`
              }
            />
          </dl>

          {(mission.besoinsAApporter ?? []).length > 0 && (
            <section className="mission__besoins">
              <h2 className="mission__sous-titre">À apporter</h2>
              <ul>
                {mission.besoinsAApporter.map((besoin) => (
                  <li key={besoin}>{besoin}</li>
                ))}
              </ul>
            </section>
          )}

          <Avis mission={mission} onEnvoye={recharger} />
        </div>

        <aside className="mission__action">
          {mission.noteMoyenne && (
            <p className="mission__note">
              <strong>{mission.noteMoyenne} / 5</strong>
              <span>
                {mission.avisNombre} avis de bénévoles
              </span>
            </p>
          )}

          {refus && <p className="alerte-benevole">{refus}</p>}
          {message && <p className="succes-benevole">{message}</p>}

          {inscrit ? (
            <>
              <p className="mission__etat">
                Vous êtes inscrit à cette mission.
                {monStatut === 'present' && ' Votre présence a été constatée.'}
              </p>
              {monStatut !== 'present' && !fermee && (
                <DesinscriptionParMotif
                  envoi={envoi}
                  onValider={(motif) =>
                    agir(async () => {
                      await service.seDesinscrire(mission.id, motif);
                      setMessage('Votre inscription a été annulée.');
                    })
                  }
                />
              )}
            </>
          ) : (
            <>
              <button
                type="button"
                className="btn btn--principal"
                disabled={envoi || Boolean(empechement)}
                onClick={() =>
                  agir(async () => {
                    await service.sInscrire(mission.id);
                    setMessage('Vous êtes inscrit. Merci !');
                  })
                }
              >
                {envoi ? 'Inscription…' : 'S’inscrire à cette mission'}
              </button>

              {empechement && <p className="mission__empechement">{empechement}</p>}

              {mission.format === 'terrain' && !empechement && (
                <p className="mission__note-terrain">
                  Mission de terrain : votre profil doit être validé par HOPE.
                </p>
              )}
            </>
          )}
        </aside>
      </div>
    </>
  );
}

/** Une ligne de la fiche mission. */
function Fait({ terme, valeur }) {
  if (!valeur) return null;
  return (
    <div className="mission__fait">
      <dt>{terme}</dt>
      <dd>{valeur}</dd>
    </div>
  );
}

/**
 * Annulation en deux temps.
 *
 * Se retirer d'une mission laisse une place vide que l'equipe doit
 * combler : on demande le motif plutot que de retirer d'un seul clic.
 */
function DesinscriptionParMotif({ envoi, onValider }) {
  const [ouvert, setOuvert] = useState(false);
  const [motif, setMotif] = useState('');

  if (!ouvert) {
    return (
      <button
        type="button"
        className="btn btn--neutre"
        onClick={() => setOuvert(true)}
        disabled={envoi}
      >
        Annuler mon inscription
      </button>
    );
  }

  return (
    <div className="desinscription">
      <label className="desinscription__label" htmlFor="motif">
        Pourquoi vous retirez-vous ? (facultatif)
      </label>
      <textarea
        id="motif"
        className="desinscription__saisie"
        rows={3}
        value={motif}
        onChange={(e) => setMotif(e.target.value)}
        placeholder="Empêchement familial, déplacement…"
      />
      <div className="desinscription__actions">
        <button
          type="button"
          className="btn btn--danger btn--petit"
          disabled={envoi}
          onClick={() => onValider(motif)}
        >
          Confirmer le retrait
        </button>
        <button
          type="button"
          className="btn btn--neutre btn--petit"
          onClick={() => setOuvert(false)}
          disabled={envoi}
        >
          Garder ma place
        </button>
      </div>
    </div>
  );
}

/**
 * Les avis d'une mission, et le formulaire pour en laisser un.
 *
 * Le formulaire n'apparait que si la presence a ete constatee et que
 * l'avis n'a pas deja ete donne : proposer un champ qui sera refuse
 * cote serveur serait une invitation a l'echec.
 */
function Avis({ mission, onEnvoye }) {
  const avis = mission.avis ?? [];
  const peutDonner = mission.monInscriptionStatut === 'present';
  const dejaDonne = Boolean(mission.monAvisDonne);

  const [note, setNote] = useState(5);
  const [commentaire, setCommentaire] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const [refus, setRefus] = useState('');
  const [envoye, setEnvoye] = useState(false);

  async function soumettre(evenement) {
    evenement.preventDefault();
    setEnvoi(true);
    setRefus('');
    try {
      await service.laisserUnAvis(mission.id, { note, commentaire });
      setEnvoye(true);
      onEnvoye();
    } catch (echec) {
      setRefus(messageErreur(echec, 'Votre avis n’a pas pu être enregistré.'));
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <section className="mission__avis">
      <h2 className="mission__sous-titre">Avis des bénévoles</h2>

      {avis.length === 0 ? (
        <p className="mission__avis-vide">Aucun avis pour l’instant.</p>
      ) : (
        <ul className="avis-liste">
          {avis.map((a) => (
            <li key={a.id} className="avis">
              <div className="avis__haut">
                <Etoiles note={a.note} />
                <span className="avis__auteur">
                  {a.auteurPrenom} · {fmt.date(a.creeLe)}
                </span>
              </div>
              {a.commentaire && <p className="avis__texte">{a.commentaire}</p>}
            </li>
          ))}
        </ul>
      )}

      {peutDonner && !dejaDonne && !envoye && (
        <form className="avis-formulaire" onSubmit={soumettre}>
          <h3 className="avis-formulaire__titre">Vous y étiez : donnez votre avis</h3>

          <div className="avis-formulaire__notes" role="radiogroup" aria-label="Note">
            {[1, 2, 3, 4, 5].map((valeur) => (
              <button
                key={valeur}
                type="button"
                role="radio"
                aria-checked={note === valeur}
                aria-label={`${valeur} sur 5`}
                className={`avis-formulaire__note${
                  note >= valeur ? ' avis-formulaire__note--pleine' : ''
                }`}
                onClick={() => setNote(valeur)}
              >
                ★
              </button>
            ))}
          </div>

          <textarea
            className="avis-formulaire__saisie"
            rows={3}
            value={commentaire}
            onChange={(e) => setCommentaire(e.target.value)}
            placeholder="Ce qui s’est bien passé, ce qui pourrait être amélioré…"
          />

          {refus && <p className="alerte-benevole">{refus}</p>}

          <button type="submit" className="btn btn--principal btn--petit" disabled={envoi}>
            {envoi ? 'Envoi…' : 'Publier mon avis'}
          </button>
        </form>
      )}

      {envoye && <p className="succes-benevole">Merci, votre avis est publié.</p>}
    </section>
  );
}

/** Note affichee en etoiles. */
function Etoiles({ note }) {
  return (
    <span className="etoiles" aria-label={`${note} sur 5`}>
      {'★'.repeat(note)}
      <span className="etoiles__vides">{'★'.repeat(5 - note)}</span>
    </span>
  );
}
