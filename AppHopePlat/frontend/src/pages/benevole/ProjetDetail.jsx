import { useCallback, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';

import { ModaleConfirmation } from '../../components/admin/forms.jsx';
import { LigneFiche, Onglets } from '../../components/admin/ui.jsx';
import { PleineCalendrier, PleineLieu, PleineTaches } from '../../components/IconesPleines.jsx';
import { Carrousel, Vignette } from '../../components/preuves/MediasPreuve.jsx';
import { PhotoAgrandissable } from '../../components/VisionneuseImage.jsx';
import { useChargement } from '../../hooks/useChargement.js';
import { messageErreur, urlMedia } from '../../services/api.js';
import * as service from '../../services/espaceBenevole.service.js';
import * as fmt from '../../utils/format.js';
import AjoutPreuveModale from './AjoutPreuveModale.jsx';
import { ActionDemande, EquipeTache, STATUTS_TACHE } from './composants.jsx';

const ONGLETS = ['general', 'taches', 'impact'];

const STATUTS_PROJET = { IN_PROGRESS: 'En cours', COMPLETED: 'Terminé' };
const TYPES_PREUVE = { PHOTO: 'Photo', VIDEO: 'Vidéo', DOCUMENT: 'Document', TESTIMONY: 'Témoignage' };

/**
 * Un projet, et tout ce qu'un benevole peut y faire.
 *
 * La tete du projet -- sa photo, son nom, son lieu -- puis trois onglets :
 *   - Vue generale : ce qu'il est, ce qu'il vise, pour qui, qui le mene.
 *     Rien d'argent : ni budget, ni financement, ni dons -- ils ne
 *     regardent pas le benevole, et le serveur ne les envoie meme pas ;
 *   - Taches : ce qu'il y a a faire, et la place du benevole dans chacune ;
 *   - Impact : ce que le projet a produit, comme dans la fiche du projet
 *     de l'administration. Le benevole y lit les mesures, et y ajoute ses
 *     preuves terrain -- il est souvent celui qui a la photo.
 *
 * L'onglet ouvert se lit dans l'adresse (?onglet=taches) : une
 * notification peut y mener directement.
 */
export default function ProjetDetail() {
  const { id } = useParams();
  const [parametres, setParametres] = useSearchParams();
  const onglet = ONGLETS.includes(parametres.get('onglet')) ? parametres.get('onglet') : 'general';

  const { donnees, chargement, erreur, recharger } = useChargement(
    () => service.recupererProjet(id),
    [id]
  );

  const [envoi, setEnvoi] = useState(false);
  const [refus, setRefus] = useState('');
  // La preuve dont on feuillette les fichiers, et le rang du fichier montre.
  const [carrousel, setCarrousel] = useState(null);
  // Ajouter une preuve, et celle qu'on s'apprete a retirer.
  const [ajoutPreuve, setAjoutPreuve] = useState(false);
  const [aRetirer, setARetirer] = useState(null);
  const [retrait, setRetrait] = useState({ envoi: false, erreur: '' });
  const [annonce, setAnnonce] = useState('');

  // Un chargeur stable : les vignettes rechargeraient leur fichier a
  // chaque rendu s'il changeait.
  const chargerFichier = useCallback(
    (preuve, fichier) => service.urlDuFichierPreuve(id, preuve, fichier),
    [id]
  );

  async function agir(action) {
    setEnvoi(true);
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

  async function retirerPreuve() {
    setRetrait({ envoi: true, erreur: '' });
    try {
      await service.supprimerPreuve(id, aRetirer.id);
      setARetirer(null);
      setRetrait({ envoi: false, erreur: '' });
      setAnnonce('Votre preuve a été retirée.');
      recharger();
    } catch (echec) {
      setRetrait({ envoi: false, erreur: messageErreur(echec, 'La preuve n’a pas pu être retirée.') });
    }
  }

  function changerOnglet(cle) {
    setAnnonce('');
    setParametres(cle === 'general' ? {} : { onglet: cle }, { replace: true });
  }

  if (chargement && !donnees) return <p className="bloc__vide">Chargement du projet…</p>;
  if (erreur) return <p className="alerte-benevole">{erreur}</p>;
  if (!donnees) return null;

  const { project: projet, tasks: taches } = donnees;
  const impacts = donnees.impacts ?? [];
  const synthese = donnees.impactSummary ?? [];
  const preuves = donnees.proofs ?? [];
  const indicateurs = donnees.indicators ?? [];
  const libres = taches.filter((t) => t.statut === 'a_faire');

  return (
    <div className="accueil-benevole projet-benevole">
      <p className="fil-retour">
        <Link to="/benevole/projets">← Tous les projets</Link>
      </p>

      {/* ---------- La tete du projet ---------- */}
      <section className="tete-projet">
        {projet.mediaUrl && (
          <div className="tete-projet__image">
            {/* Une video se regarde, elle ne s'agrandit pas comme une
                photo : rendue en image, elle s'affichait cassee. */}
            {projet.mediaType === 'VIDEO' ? (
              <video
                src={urlMedia(projet.mediaUrl)}
                controls
                playsInline
                preload="metadata"
                aria-label={`Vidéo du projet ${projet.name}`}
              />
            ) : (
              <PhotoAgrandissable
                src={urlMedia(projet.mediaUrl)}
                alt={projet.name}
                legende={projet.name}
              />
            )}
          </div>
        )}
        <div className="tete-projet__corps">
          <p className="surtitre">
            <span className="trait-hope surtitre__trait" aria-hidden="true" />
            {projet.categoryName ?? 'Projet'}
          </p>
          <h1 className="accueil-benevole__titre">{projet.name}</h1>
          {projet.location && (
            <p className="tete-projet__lieu">
              <PleineLieu />
              {projet.location}
            </p>
          )}
          {projet.descriptionTitre && (
            <p className="tete-projet__annonce">{projet.descriptionTitre}</p>
          )}
        </div>
      </section>

      <Onglets
        onglets={[
          { cle: 'general', label: 'Vue générale' },
          { cle: 'taches', label: 'Tâches', compteur: taches.length },
          { cle: 'impact', label: 'Impact', compteur: impacts.length },
        ]}
        actif={onglet}
        onChange={changerOnglet}
      />

      {refus && <p className="alerte-benevole">{refus}</p>}
      {/* Annonce aux lecteurs d'ecran, et confirmation visible. */}
      <p className="confirmation-benevole" role="status" hidden={!annonce}>
        {annonce}
      </p>

      {/* ================= Vue generale ================= */}
      {onglet === 'general' && (
        <>
          {projet.description && (
            <section className="bloc">
              <h2 className="bloc__titre">Le projet</h2>
              <p className="projet-benevole__texte">{projet.description}</p>
            </section>
          )}

          <section className="bloc">
            <h2 className="bloc__titre">En bref</h2>
            <dl className="fiche projet-benevole__fiche">
              <LigneFiche terme="Catégorie">{projet.categoryName}</LigneFiche>
              <LigneFiche terme="Lieu">{projet.location}</LigneFiche>
              <LigneFiche terme="Responsable">{projet.managerName}</LigneFiche>
              <LigneFiche terme="Début">{projet.startDate ? fmt.date(projet.startDate) : null}</LigneFiche>
              <LigneFiche terme="Statut">{STATUTS_PROJET[projet.status] ?? projet.status}</LigneFiche>
              <LigneFiche terme="Pour qui">{projet.beneficiaryProfile}</LigneFiche>
              <LigneFiche terme="Bénéficiaires accompagnés">
                {fmt.nombre(projet.beneficiariesCount)}
                {projet.beneficiaryTarget ? ` sur ${fmt.nombre(projet.beneficiaryTarget)} visés` : ''}
              </LigneFiche>
              <LigneFiche terme="Tâches">
                {taches.length > 0
                  ? `${libres.length} à prendre sur ${taches.length}`
                  : 'Aucune pour l’instant'}
              </LigneFiche>
            </dl>
          </section>

          <section className="bloc">
            <h2 className="bloc__titre">Objectifs spécifiques</h2>
            {projet.objectives?.length > 0 ? (
              <ol className="objectifs">
                {projet.objectives.map((objectif) => (
                  <li className="objectifs__ligne" key={objectif.id}>
                    {objectif.label}
                  </li>
                ))}
              </ol>
            ) : (
              <p className="bloc__vide">L’équipe n’a pas encore fixé d’objectifs à ce projet.</p>
            )}
          </section>

          {projet.outcome && (
            <section className="bloc">
              <h2 className="bloc__titre">Résultat du projet</h2>
              <p className="projet-benevole__texte">{projet.outcome}</p>
            </section>
          )}
        </>
      )}

      {/* ================= Taches ================= */}
      {onglet === 'taches' && (
        <section className="bloc">
          <div className="bloc__entete">
            <h2 className="bloc__titre">Tâches à faire</h2>
            <p className="bloc__sous-titre">
              {libres.length > 0
                ? `${libres.length} à prendre sur ${taches.length}`
                : `${taches.length} au total`}
            </p>
          </div>

          {taches.length === 0 ? (
            <p className="bloc__vide">
              Aucune tâche sur ce projet pour l’instant. L’équipe en publiera au fil des
              besoins.
            </p>
          ) : (
            <ul className="taches-projet">
              {[...libres, ...taches.filter((t) => t.statut !== 'a_faire')].map((tache) => (
                <li
                  key={tache.id}
                  className={`tache-projet${tache.statut !== 'a_faire' ? ' tache-projet--prise' : ''}`}
                >
                  <span className="carre-icone carre-icone--bleu" aria-hidden="true">
                    <PleineTaches />
                  </span>

                  <div className="tache-projet__corps">
                    <p className="tache-projet__titre">{tache.titre}</p>
                    {tache.description && (
                      <p className="tache-projet__texte">{tache.description}</p>
                    )}
                    <EquipeTache tache={tache} className="tache-projet__equipe" />
                    <p className="tache-projet__faits">
                      <span
                        className={`pastille pastille--${
                          { a_faire: 'orange', en_cours: 'bleu', livree: 'valide' }[tache.statut]
                        }`}
                      >
                        {STATUTS_TACHE[tache.statut]}
                      </span>
                      {tache.echeance && (
                        <span className="tache-projet__echeance">
                          <PleineCalendrier />À rendre le {fmt.date(tache.echeance)}
                        </span>
                      )}
                    </p>
                  </div>

                  {/*
                    Toute tache non livree se demande : libre, pour la
                    prendre ; commencee, pour rejoindre son equipe. L'equipe
                    HOPE valide. "Mes tâches" est l'ecran ou l'on agit
                    ensuite sur les siennes.
                  */}
                  <div className="tache-projet__action">
                    <ActionDemande
                      tache={tache}
                      envoi={envoi}
                      onDemander={(t) => agir(() => service.demanderTache(t.id))}
                      onAnnuler={(t) => agir(() => service.annulerDemandeTache(t.id))}
                      classeBouton="bouton-hope bouton-hope--creux"
                      classeSecondaire="lien-hope"
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {/* ================= Impact ================= */}
      {onglet === 'impact' && (
        <OngletImpact
          impacts={impacts}
          synthese={synthese}
          preuves={preuves}
          indicateurs={indicateurs}
          onOuvrirPreuve={(preuve) => setCarrousel({ preuve, rang: 0 })}
          onAjouter={() => {
            setAnnonce('');
            setAjoutPreuve(true);
          }}
          onRetirer={(preuve) => {
            setRetrait({ envoi: false, erreur: '' });
            setARetirer(preuve);
          }}
          chargerFichier={chargerFichier}
        />
      )}

      {ajoutPreuve && (
        <AjoutPreuveModale
          projet={projet}
          onFermer={() => setAjoutPreuve(false)}
          onAjoutee={() => {
            setAjoutPreuve(false);
            setAnnonce('Merci ! Votre preuve a été ajoutée à l’impact du projet.');
            recharger();
          }}
        />
      )}

      <ModaleConfirmation
        ouverte={aRetirer !== null}
        titre="Retirer cette preuve ?"
        message="Elle disparaîtra de l’impact du projet, avec ses fichiers."
        onFermer={() => setARetirer(null)}
        onConfirmer={retirerPreuve}
        envoi={retrait.envoi}
        erreur={retrait.erreur}
        libelleConfirmer="Retirer"
        danger
      />

      {carrousel && (
        <Carrousel
          preuve={carrousel.preuve}
          charger={chargerFichier}
          rang={carrousel.rang}
          onRang={(rang) => setCarrousel((actuel) => ({ ...actuel, rang }))}
          onFermer={() => setCarrousel(null)}
        />
      )}
    </div>
  );
}

/**
 * L'impact du projet, comme dans la fiche de l'administration : les totaux
 * mesures, l'impact general en phrases, les mesures objectif par objectif
 * -- en lecture seule --, et les preuves terrain, auxquelles le benevole
 * ajoute les siennes et dont il peut retirer celles qu'il a deposees.
 *
 * Aucun nom de beneficiaire : une mesure individuelle dit seulement
 * qu'elle porte sur une personne.
 */
function OngletImpact({
  impacts,
  synthese,
  preuves,
  indicateurs,
  onOuvrirPreuve,
  onAjouter,
  onRetirer,
  chargerFichier,
}) {
  const generaux = impacts.filter((impact) => !impact.objectiveId);
  const parObjectif = impacts.filter((impact) => impact.objectiveId);

  return (
    <>
      {synthese.length > 0 && (
        <div className="cartes-chiffres">
          {synthese.map((ligne) => (
            <div className="carte-chiffre carte-chiffre--impact" key={`${ligne.indicator}|${ligne.unit ?? ''}`}>
              <p className="carte-chiffre__libelle">{fmt.libelleIndicateur(ligne.indicator, indicateurs)}</p>
              <p className="carte-chiffre__valeur">
                {fmt.nombre(ligne.total)}
                {ligne.unit && <span className="carte-chiffre__unite">{ligne.unit}</span>}
              </p>
              <p className="carte-chiffre__variation">{fmt.nombre(ligne.entriesCount)} mesure(s)</p>
            </div>
          ))}
        </div>
      )}

      <section className="bloc">
        <div className="bloc__entete">
          <h2 className="bloc__titre">Impact général du projet</h2>
          <p className="bloc__sous-titre">Ce que le projet a produit dans son ensemble</p>
        </div>
        {generaux.length > 0 ? (
          <div className="impact-texte">
            {generaux.map((impact) => (
              <p className="impact-texte__paragraphe" key={impact.id}>
                <strong className="impact-texte__titre">{impact.title}</strong>
                {' : '}
                <strong className="impact-texte__valeur">
                  {fmt.nombre(impact.value)}
                  {impact.unit ? ` ${impact.unit}` : ''}
                </strong>
                {impact.collectif === false ? ' pour un bénéficiaire' : ''}
                <span className="impact-texte__date">, mesuré le {fmt.date(impact.measuredAt)}.</span>
                {impact.description && ` ${impact.description}`}
              </p>
            ))}
          </div>
        ) : (
          <p className="bloc__vide">Aucun impact général n’a encore été mesuré.</p>
        )}
      </section>

      <section className="bloc">
        <div className="bloc__entete">
          <h2 className="bloc__titre">Mesures par objectif</h2>
          <p className="bloc__sous-titre">Chaque mesure, et l’objectif qu’elle documente</p>
        </div>
        {parObjectif.length > 0 ? (
          <div className="table-enveloppe">
            <table className="table table--empilable">
              <thead>
                <tr>
                  <th className="table__centre">Impact</th>
                  <th className="table__centre">Objectif</th>
                  <th className="table__centre">Valeur</th>
                  <th className="table__centre">Mesuré le</th>
                </tr>
              </thead>
              <tbody>
                {parObjectif.map((impact) => (
                  <tr key={impact.id}>
                    <td className="table__centre" data-libelle="Impact">
                      <div className="table__principal">{impact.title}</div>
                      {impact.description && (
                        <div className="table__secondaire">{fmt.tronquer(impact.description, 70)}</div>
                      )}
                    </td>
                    <td className="table__centre" data-libelle="Objectif">
                      {impact.objectiveLabel}
                    </td>
                    <td className="table__centre" data-libelle="Valeur">
                      <strong>
                        {fmt.nombre(impact.value)} {impact.unit ?? ''}
                      </strong>
                    </td>
                    <td className="table__centre" data-libelle="Mesuré le">
                      {fmt.date(impact.measuredAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="bloc__vide">Aucune mesure n’est encore rattachée à un objectif.</p>
        )}
      </section>

      <section className="bloc">
        <div className="bloc__entete bloc__entete--action">
          <div>
            <h2 className="bloc__titre">Preuves terrain</h2>
            <p className="bloc__sous-titre">Les photos, vidéos et témoignages du terrain</p>
          </div>
          {/* Le benevole est sur le terrain : c'est souvent lui qui a la photo. */}
          <button type="button" className="bouton-hope" onClick={onAjouter}>
            + Ajouter une preuve
          </button>
        </div>
        {preuves.length > 0 ? (
          <ul className="preuves">
            {preuves.map((preuve) => (
              <li className="preuve" key={preuve.id}>
                <Vignette preuve={preuve} charger={chargerFichier} />
                <div className="preuve__corps">
                  <p className="preuve__projet">
                    <span className="pastille pastille--bleu">
                      {TYPES_PREUVE[preuve.proofType] ?? preuve.proofType}
                    </span>
                  </p>
                  <p className="preuve__description">{preuve.description}</p>
                  <p className="preuve__signature">
                    {fmt.date(preuve.occurredOn)} ·{' '}
                    {preuve.mienne
                      ? 'ajoutée par vous'
                      : preuve.auteurBenevole
                        ? `ajoutée par ${preuve.auteurBenevole}`
                        : 'ajoutée par l’équipe HOPE'}
                  </p>
                </div>
                <div className="preuve__actions">
                  {preuve.files?.length > 0 && (
                    <button
                      type="button"
                      className="bouton-hope bouton-hope--creux"
                      onClick={() => onOuvrirPreuve(preuve)}
                    >
                      Voir {preuve.files.length > 1 ? `les ${preuve.files.length} fichiers` : 'le fichier'}
                    </button>
                  )}
                  {/* On ne retire que ce qu'on a depose soi-meme. */}
                  {preuve.mienne && (
                    <button
                      type="button"
                      className="lien-action lien-action--danger"
                      onClick={() => onRetirer(preuve)}
                    >
                      Retirer
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="bloc__vide">
            Aucune preuve terrain pour ce projet. Vous étiez sur place ? Ajoutez la première.
          </p>
        )}
      </section>
    </>
  );
}
