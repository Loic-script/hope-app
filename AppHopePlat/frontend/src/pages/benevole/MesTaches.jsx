import { useState } from 'react';

import { Carrousel } from '../../components/preuves/MediasPreuve.jsx';
import { useChargement } from '../../hooks/useChargement.js';
import { messageErreur } from '../../services/api.js';
import * as service from '../../services/espaceBenevole.service.js';
import * as fmt from '../../utils/format.js';
import { ActionDemande, EquipeTache, STATUTS_TACHE } from './composants.jsx';
import { DetailTacheModale, LivraisonModale } from './ModalesTache.jsx';

/**
 * Mes taches, en trois colonnes : a prendre, en cours, livree.
 *
 * "A prendre" montre ce qu'on peut demander : les taches libres, et
 * celles qu'une equipe a deja commencees et qu'on peut rejoindre. Une
 * tache ne devient la sienne qu'une fois la demande validee par l'equipe
 * HOPE : la carte dit ou en est la demande.
 */
export default function MesTaches() {
  const miennes = useChargement(() => service.mesTaches(), []);
  const libres = useChargement(() => service.tachesLibres(), []);
  // Sa fiche : elle dit ce qu'il sait faire, et les taches marquent
  // alors les competences qu'il possede deja.
  const profil = useChargement(() => service.recupererProfil(), []);

  const [envoi, setEnvoi] = useState(false);
  const [refus, setRefus] = useState('');

  // Les trois fenetres : lire une tache libre, livrer la sienne, revoir
  // la preuve d'une tache livree.
  const [enLecture, setEnLecture] = useState(null);
  const [aLivrer, setALivrer] = useState(null);
  const [preuve, setPreuve] = useState(null);

  /** @returns {Promise<boolean>} vrai si l'action a abouti */
  async function agir(action) {
    setEnvoi(true);
    setRefus('');
    try {
      await action();
      miennes.recharger();
      libres.recharger();
      return true;
    } catch (echec) {
      setRefus(messageErreur(echec, 'Action impossible pour le moment.'));
      return false;
    } finally {
      setEnvoi(false);
    }
  }

  const taches = miennes.donnees?.items ?? [];
  const compteurs = miennes.donnees?.counts ?? {};
  const aPrendre = libres.donnees ?? [];
  const mesCompetences = profil.donnees?.competences ?? [];

  return (
    <>
      <header className="page-benevole__entete">
        <h1 className="page-benevole__titre">Mes tâches</h1>
        <p className="page-benevole__accroche">
          Ce que vous avez pris en charge, et ce qu’il reste à prendre.
        </p>
      </header>

      {refus && <p className="alerte-benevole">{refus}</p>}
      {miennes.erreur && <p className="alerte-benevole">{miennes.erreur}</p>}

      <div className="colonnes-taches">
        <Colonne
          titre="À prendre"
          mesCompetences={mesCompetences}
          sousTitre="demandez-la : l’équipe HOPE valide"
          compteur={aPrendre.length}
          vide="Aucune tâche à prendre pour l’instant. Revenez plus tard."
          taches={aPrendre}
          onOuvrir={setEnLecture}
          rendreActions={(tache) => (
            <ActionDemande
              tache={tache}
              envoi={envoi}
              onDemander={(t) => agir(() => service.demanderTache(t.id))}
              onAnnuler={(t) => agir(() => service.annulerDemandeTache(t.id))}
            />
          )}
        />

        <Colonne
          titre="En cours"
          mesCompetences={mesCompetences}
          sousTitre="vous faites partie de l’équipe"
          compteur={compteurs.en_cours ?? 0}
          vide="Rien en cours. Prenez une tâche à gauche."
          taches={taches.filter((t) => t.statut === 'en_cours')}
          rendreActions={(tache) => (
            <>
              <button
                type="button"
                className="btn btn--principal btn--petit"
                disabled={envoi}
                onClick={() => setALivrer(tache)}
              >
                Marquer livrée
              </button>
              <button
                type="button"
                className="btn btn--neutre btn--petit"
                disabled={envoi}
                onClick={() => agir(() => service.relacherTache(tache.id))}
              >
                Quitter
              </button>
            </>
          )}
        />

        <Colonne
          titre="Livrée"
          mesCompetences={mesCompetences}
          sousTitre="en attente de validation"
          compteur={compteurs.livree ?? 0}
          vide="Rien de livré pour l’instant."
          taches={taches.filter((t) => t.statut === 'livree')}
          rendreActions={(tache) => (
            <>
              <span className="carte-tache__fait">
                Livrée le {fmt.date(tache.livreeLe)}
                {tache.livreeParMoi ? ' par vous' : ' par votre équipe'}
              </span>
              {/* Les taches livrees avant la preuve obligatoire n'en ont pas. */}
              {tache.files?.length > 0 && (
                <button
                  type="button"
                  className="lien-action carte-tache__preuve"
                  onClick={() => setPreuve({ tache, rang: 0 })}
                >
                  Voir la preuve ({tache.files.length})
                </button>
              )}
            </>
          )}
        />
      </div>

      {enLecture && (
        <DetailTacheModale
          tache={enLecture}
          envoi={envoi}
          onFermer={() => setEnLecture(null)}
          onDemander={async (tache) => {
            if (await agir(() => service.demanderTache(tache.id))) setEnLecture(null);
          }}
          onAnnuler={async (tache) => {
            if (await agir(() => service.annulerDemandeTache(tache.id))) setEnLecture(null);
          }}
        />
      )}

      {aLivrer && (
        <LivraisonModale
          tache={aLivrer}
          onFermer={() => setALivrer(null)}
          onLivree={() => {
            setALivrer(null);
            miennes.recharger();
          }}
        />
      )}

      {preuve && (
        <Carrousel
          preuve={{ ...preuve.tache, description: preuve.tache.titre }}
          charger={service.urlDuFichierTache}
          rang={preuve.rang}
          onRang={(rang) => setPreuve((actuel) => ({ ...actuel, rang }))}
          onFermer={() => setPreuve(null)}
        />
      )}
    </>
  );
}

/** Une colonne du tableau des taches. */
function Colonne({
  titre,
  sousTitre,
  compteur,
  vide,
  taches,
  rendreActions,
  onOuvrir = null,
  mesCompetences = [],
}) {
  return (
    <section className="colonne-taches">
      <h2 className="colonne-taches__titre">
        {titre}
        <span className="colonne-taches__compteur">{compteur}</span>
      </h2>
      <p className="colonne-taches__sous-titre">{sousTitre}</p>

      {taches.length === 0 ? (
        <p className="colonne-taches__vide">{vide}</p>
      ) : (
        taches.map((tache) => (
          <CarteTache
            key={tache.id}
            tache={tache}
            actions={rendreActions(tache)}
            onOuvrir={onOuvrir}
            mesCompetences={mesCompetences}
          />
        ))
      )}
    </section>
  );
}

/**
 * Ce qu'une tache demande de savoir faire.
 *
 * L'equipe coche ces intitules a la creation de la tache ; ce sont les
 * memes que ceux de la fiche du benevole. Celles qu'il possede sont
 * marquees : il voit d'un coup d'oeil s'il est attendu, au lieu de
 * lire une description et de se demander.
 */
function CompetencesTache({ requises, acquises = [] }) {
  if (!requises || requises.length === 0) return null;

  const possede = (competence) =>
    acquises.some((mienne) => mienne.toLowerCase() === competence.toLowerCase());

  return (
    <p className="tache-competences">
      <span className="tache-competences__intitule">Expérience requise</span>
      {requises.map((competence) => (
        <span
          className={`tache-competences__puce${
            possede(competence) ? ' tache-competences__puce--acquise' : ''
          }`}
          key={competence}
        >
          {competence}
          {possede(competence) && <span className="sr-only"> — vous l’avez</span>}
        </span>
      ))}
    </p>
  );
}

/**
 * Une tache en carte, avec ses actions.
 *
 * Ouvrable, toute la carte repond au clic : le titre est un bouton dont
 * la zone s'etire sur la carte entiere. Les actions passent au-dessus et
 * gardent leur propre clic -- "Prendre cette tache" ne doit pas ouvrir
 * la fenetre au passage.
 */
function CarteTache({ tache, actions, onOuvrir = null, mesCompetences = [] }) {
  // Une echeance depassee sur une tache non livree merite d'etre vue.
  const enRetard =
    tache.echeance && tache.statut !== 'livree' && new Date(tache.echeance) < new Date();

  return (
    <article className={`carte-tache${onOuvrir ? ' carte-tache--ouvrable' : ''}`}>
      <p className="carte-tache__projet">{tache.projetNom}</p>
      <h3 className="carte-tache__titre">
        {onOuvrir ? (
          <button
            type="button"
            className="carte-tache__ouvrir"
            onClick={() => onOuvrir(tache)}
            aria-haspopup="dialog"
          >
            {tache.titre}
          </button>
        ) : (
          tache.titre
        )}
      </h3>
      {tache.description && <p className="carte-tache__texte">{tache.description}</p>}
      <CompetencesTache requises={tache.competencesRequises} acquises={mesCompetences} />
      <EquipeTache tache={tache} className="carte-tache__equipe" />

      <div className="carte-tache__pied">
        {tache.echeance && (
          <span className={`carte-tache__echeance${enRetard ? ' carte-tache__echeance--retard' : ''}`}>
            {enRetard ? 'En retard depuis le ' : 'Échéance : '}
            {fmt.date(tache.echeance)}
          </span>
        )}
        <span className="carte-tache__statut">{STATUTS_TACHE[tache.statut]}</span>
      </div>

      {actions && <div className="carte-tache__actions">{actions}</div>}
    </article>
  );
}
