import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { Modale } from './forms.jsx';
import { Badge } from './ui.jsx';
import Visage from './Visage.jsx';
import { Carrousel } from '../preuves/MediasPreuve.jsx';
import { messageErreur } from '../../services/api.js';
import * as taskService from '../../services/task.service.js';
import * as fmt from '../../utils/format.js';

export const STATUTS_TACHE = { a_faire: 'À faire', en_cours: 'En cours', livree: 'Livrée' };
export const COULEURS_TACHE = { a_faire: 'ambre', en_cours: 'violet', livree: 'vert' };

const nomDe = (personne) => `${personne.prenom ?? ''} ${personne.nom ?? ''}`.trim() || personne.email;

/**
 * La fenetre d'une tache, cote administration.
 *
 * Tout ce que l'equipe a besoin de savoir et de faire sur une tache, au
 * meme endroit : ce qu'elle demande, qui y travaille, qui a demande a la
 * prendre ou a la rejoindre, et la preuve une fois livree.
 *
 * Elle se charge elle-meme a l'ouverture : la ligne qui l'ouvre peut
 * dater, une demande a pu arriver depuis. Chaque geste rend la tache a
 * jour, et previent le parent pour qu'il rafraichisse sa liste.
 *
 * @param {{ tacheId: string, onFermer: () => void, onChange?: () => void,
 *           lienProjet?: boolean }} props
 *   lienProjet : propose d'ouvrir la fiche du projet (inutile depuis
 *   l'onglet du projet lui-meme).
 */
export default function FenetreTache({ tacheId, onFermer, onChange, lienProjet = false }) {
  const [tache, setTache] = useState(null);
  const [erreur, setErreur] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const [affectation, setAffectation] = useState(false);
  const [confirmerSuppression, setConfirmerSuppression] = useState(false);
  const [preuve, setPreuve] = useState(null);

  useEffect(() => {
    let annule = false;
    setTache(null);
    setErreur('');
    taskService
      .recuperer(tacheId)
      .then((recue) => !annule && setTache(recue))
      .catch((echec) => !annule && setErreur(messageErreur(echec, 'La tâche n’a pas pu être chargée.')));
    return () => {
      annule = true;
    };
  }, [tacheId]);

  /** Un geste sur la tache : la reponse est la tache a jour. */
  async function agir(action, { apres } = {}) {
    setEnvoi(true);
    setErreur('');
    try {
      const resultat = await action();
      if (resultat?.id) setTache(resultat);
      apres?.(resultat);
      onChange?.();
      return true;
    } catch (echec) {
      setErreur(messageErreur(echec, 'L’action n’a pas abouti.'));
      return false;
    } finally {
      setEnvoi(false);
    }
  }

  async function supprimer() {
    setEnvoi(true);
    setErreur('');
    try {
      await taskService.supprimer(tache.id);
      onChange?.();
      onFermer();
    } catch (echec) {
      setErreur(messageErreur(echec, 'La tâche n’a pas pu être supprimée.'));
      setConfirmerSuppression(false);
    } finally {
      setEnvoi(false);
    }
  }

  const livree = tache?.statut === 'livree';
  const archive = tache?.projetStatut === 'ARCHIVED';
  const modifiable = tache && !livree && !archive;
  const enRetard = tache?.echeance && !livree && new Date(tache.echeance) < new Date();

  return (
    <>
      <Modale
        ouverte
        large
        titre={tache?.titre ?? 'Tâche'}
        sousTitre={tache ? [tache.projetNom, tache.projetReference].filter(Boolean).join(' · ') : ''}
        onFermer={onFermer}
        erreur={erreur}
        pied={
          tache && (
            <div className="fenetre-tache__pied">
              {confirmerSuppression ? (
                <span className="fenetre-tache__confirmer">
                  Supprimer définitivement cette tâche ?
                  <button type="button" className="btn btn--danger btn--petit" onClick={supprimer} disabled={envoi}>
                    Oui, supprimer
                  </button>
                  <button
                    type="button"
                    className="btn btn--neutre btn--petit"
                    onClick={() => setConfirmerSuppression(false)}
                    disabled={envoi}
                  >
                    Non
                  </button>
                </span>
              ) : (
                !archive &&
                tache.equipe.length === 0 && (
                  <button
                    type="button"
                    className="lien-action lien-action--danger"
                    onClick={() => setConfirmerSuppression(true)}
                    disabled={envoi}
                  >
                    Supprimer la tâche
                  </button>
                )
              )}
              <span className="fenetre-tache__espace" />
              {lienProjet && (
                <Link className="btn btn--neutre" to={`/admin/projects/${tache.projetId}`}>
                  Ouvrir le projet
                </Link>
              )}
              <button type="button" className="btn btn--principal" onClick={onFermer}>
                Fermer
              </button>
            </div>
          )
        }
      >
        {!tache ? (
          !erreur && <p className="fenetre-tache__attente">Chargement de la tâche…</p>
        ) : (
          <div className="fenetre-tache">
            {/* ---------- L'essentiel ---------- */}
            <div className="fenetre-tache__faits">
              <Badge valeur={tache.statut} libelles={STATUTS_TACHE} couleur={COULEURS_TACHE[tache.statut]} />
              <span className={enRetard ? 'fenetre-tache__retard' : ''}>
                {tache.echeance
                  ? `${enRetard ? 'En retard depuis le' : 'À rendre le'} ${fmt.date(tache.echeance)}`
                  : 'Sans échéance'}
              </span>
              <span>Créée le {fmt.date(tache.creeLe)}</span>
              {tache.priseLe && <span>En cours depuis le {fmt.date(tache.priseLe)}</span>}
              {livree && (
                <span>
                  Livrée le {fmt.date(tache.livreeLe)}
                  {tache.livreeParNom && ` par ${tache.livreeParNom}`}
                </span>
              )}
            </div>

            {tache.description ? (
              <p className="fenetre-tache__description">{tache.description}</p>
            ) : (
              <p className="fenetre-tache__description fenetre-tache__description--vide">
                Pas de consigne détaillée.
              </p>
            )}

            {/* Ce que la tache demande de savoir faire : les memes
                intitules que les fiches des benevoles. */}
            {(tache.competencesRequises ?? []).length > 0 && (
              <p className="tache-competences">
                <span className="tache-competences__intitule">Expérience requise</span>
                {tache.competencesRequises.map((competence) => (
                  <span className="tache-competences__puce" key={competence}>
                    {competence}
                  </span>
                ))}
              </p>
            )}

            {/* ---------- Les demandes, d'abord : elles attendent ---------- */}
            {tache.demandes.length > 0 && (
              <section className="fenetre-tache__bloc fenetre-tache__bloc--demandes">
                <h3 className="fenetre-tache__titre">
                  Demandes à valider
                  <span className="fenetre-tache__compte">{tache.demandes.length}</span>
                </h3>
                <p className="fenetre-tache__aide">
                  {tache.equipe.length > 0
                    ? 'Ces bénévoles demandent à rejoindre l’équipe.'
                    : 'Ces bénévoles demandent à prendre la tâche.'}{' '}
                  Ils sont prévenus de votre décision.
                </p>
                <ul className="personnes-tache">
                  {tache.demandes.map((personne) => (
                    <li key={personne.benevoleId} className="personne-tache">
                      <Visage src={personne.photoUrl} nom={nomDe(personne)} />
                      <span className="personne-tache__qui">
                        <strong>{nomDe(personne)}</strong>
                        <span>Demandé le {fmt.date(personne.le)}</span>
                      </span>
                      <span className="personne-tache__actions">
                        <button
                          type="button"
                          className="btn btn--principal btn--petit"
                          disabled={envoi || !modifiable}
                          onClick={() => agir(() => taskService.accepter(tache.id, personne.benevoleId))}
                        >
                          Accepter
                        </button>
                        <button
                          type="button"
                          className="btn btn--neutre btn--petit"
                          disabled={envoi}
                          onClick={() => agir(() => taskService.refuser(tache.id, personne.benevoleId))}
                        >
                          Refuser
                        </button>
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* ---------- L'equipe ---------- */}
            <section className="fenetre-tache__bloc">
              <h3 className="fenetre-tache__titre">
                Équipe
                <span className="fenetre-tache__compte">{tache.equipe.length}</span>
              </h3>

              {tache.equipe.length === 0 ? (
                <p className="fenetre-tache__aide">
                  Personne pour l’instant. Affectez des bénévoles, ou attendez leurs demandes.
                </p>
              ) : (
                <ul className="personnes-tache">
                  {tache.equipe.map((personne) => (
                    <li key={personne.benevoleId} className="personne-tache">
                      <Visage src={personne.photoUrl} nom={nomDe(personne)} />
                      <span className="personne-tache__qui">
                        <strong>{nomDe(personne)}</strong>
                        <span>
                          {personne.origine === 'equipe' ? 'Affecté par l’équipe' : 'À sa demande'}
                          {personne.le && ` · depuis le ${fmt.date(personne.le)}`}
                        </span>
                      </span>
                      {modifiable && (
                        <span className="personne-tache__actions">
                          <button
                            type="button"
                            className="lien-action lien-action--danger"
                            disabled={envoi}
                            onClick={() => agir(() => taskService.retirer(tache.id, personne.benevoleId))}
                          >
                            Retirer
                          </button>
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}

              {modifiable &&
                (affectation ? (
                  <ChoixBenevoles
                    exclus={tache.equipe.map((p) => p.benevoleId)}
                    envoi={envoi}
                    onAnnuler={() => setAffectation(false)}
                    onValider={(ids) =>
                      agir(() => taskService.affecter(tache.id, ids), {
                        apres: () => setAffectation(false),
                      })
                    }
                  />
                ) : (
                  <button
                    type="button"
                    className="btn btn--neutre btn--petit fenetre-tache__affecter"
                    onClick={() => setAffectation(true)}
                    disabled={envoi}
                  >
                    Affecter des bénévoles
                  </button>
                ))}
            </section>

            {/* ---------- La preuve ---------- */}
            {tache.files.length > 0 && (
              <section className="fenetre-tache__bloc">
                <h3 className="fenetre-tache__titre">Preuve de livraison</h3>
                <button
                  type="button"
                  className="btn btn--neutre btn--petit"
                  onClick={() => setPreuve({ rang: 0 })}
                >
                  Voir la preuve ({tache.files.length})
                </button>
              </section>
            )}
          </div>
        )}
      </Modale>

      {preuve && tache && (
        <Carrousel
          preuve={{ ...tache, description: tache.titre }}
          charger={taskService.urlDuFichier}
          rang={preuve.rang}
          onRang={(rang) => setPreuve({ rang })}
          onFermer={() => setPreuve(null)}
        />
      )}
    </>
  );
}

/**
 * Le choix des benevoles a affecter : une liste a cocher, avec une
 * recherche -- l'equipe peut compter des dizaines de benevoles.
 */
function ChoixBenevoles({ exclus, envoi, onAnnuler, onValider }) {
  const [tous, setTous] = useState(null);
  const [erreur, setErreur] = useState('');
  const [recherche, setRecherche] = useState('');
  const [choisis, setChoisis] = useState(() => new Set());

  useEffect(() => {
    taskService
      .benevoles()
      .then(setTous)
      .catch((echec) => setErreur(messageErreur(echec, 'La liste des bénévoles n’a pas pu être chargée.')));
  }, []);

  const proposes = useMemo(() => {
    const deja = new Set(exclus);
    const cle = recherche.trim().toLowerCase();
    return (tous ?? []).filter(
      (b) =>
        !deja.has(b.benevoleId) &&
        (!cle ||
          `${b.prenom} ${b.nom} ${b.email} ${(b.competences ?? []).join(' ')}`.toLowerCase().includes(cle))
    );
  }, [tous, exclus, recherche]);

  function basculer(id) {
    setChoisis((actuels) => {
      const suivants = new Set(actuels);
      if (suivants.has(id)) suivants.delete(id);
      else suivants.add(id);
      return suivants;
    });
  }

  return (
    <div className="choix-benevoles">
      <input
        type="search"
        className="choix-benevoles__recherche"
        placeholder="Rechercher un nom, une compétence…"
        value={recherche}
        onChange={(e) => setRecherche(e.target.value)}
        aria-label="Rechercher un bénévole"
      />

      {erreur ? (
        <p className="champ-admin__message">{erreur}</p>
      ) : !tous ? (
        <p className="fenetre-tache__aide">Chargement des bénévoles…</p>
      ) : proposes.length === 0 ? (
        <p className="fenetre-tache__aide">Aucun autre bénévole actif ne correspond.</p>
      ) : (
        <ul className="choix-benevoles__liste">
          {proposes.map((b) => {
            const nom = `${b.prenom ?? ''} ${b.nom ?? ''}`.trim() || b.email;
            return (
              <li key={b.benevoleId}>
                <label className="choix-benevoles__ligne">
                  <input
                    type="checkbox"
                    checked={choisis.has(b.benevoleId)}
                    onChange={() => basculer(b.benevoleId)}
                  />
                  <Visage src={b.photoUrl} nom={nom} />
                  <span className="personne-tache__qui">
                    <strong>{nom}</strong>
                    {b.competences?.length > 0 && <span>{b.competences.join(' · ')}</span>}
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      )}

      <div className="choix-benevoles__actions">
        <button type="button" className="btn btn--neutre btn--petit" onClick={onAnnuler} disabled={envoi}>
          Annuler
        </button>
        <button
          type="button"
          className="btn btn--principal btn--petit"
          disabled={envoi || choisis.size === 0}
          onClick={() => onValider([...choisis])}
        >
          {choisis.size > 1 ? `Affecter les ${choisis.size} bénévoles` : 'Affecter'}
        </button>
      </div>
    </div>
  );
}
