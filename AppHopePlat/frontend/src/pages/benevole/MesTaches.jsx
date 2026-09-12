import { useState } from 'react';

import { useChargement } from '../../hooks/useChargement.js';
import { messageErreur } from '../../services/api.js';
import * as service from '../../services/espaceBenevole.service.js';
import * as fmt from '../../utils/format.js';
import { STATUTS_TACHE } from './composants.jsx';

/**
 * Mes taches, en trois colonnes : a faire, en cours, livree.
 *
 * "A faire" montre les taches que personne n'a encore prises. Ce n'est
 * pas un detail de presentation : une tache assignee passe aussitot a
 * "en cours", donc une colonne "a faire" remplie de ses propres taches
 * serait toujours vide. Le vivier commun est la seule chose qui a du
 * sens a cet endroit, et c'est de la que l'on se sert.
 */
export default function MesTaches() {
  const miennes = useChargement(() => service.mesTaches(), []);
  const libres = useChargement(() => service.tachesLibres(), []);

  const [envoi, setEnvoi] = useState(false);
  const [refus, setRefus] = useState('');

  async function agir(action) {
    setEnvoi(true);
    setRefus('');
    try {
      await action();
      miennes.recharger();
      libres.recharger();
    } catch (echec) {
      setRefus(messageErreur(echec, 'Action impossible pour le moment.'));
    } finally {
      setEnvoi(false);
    }
  }

  const taches = miennes.donnees?.items ?? [];
  const compteurs = miennes.donnees?.counts ?? {};
  const aPrendre = libres.donnees ?? [];

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
          titre="À faire"
          sousTitre="à prendre par qui veut"
          compteur={aPrendre.length}
          vide="Toutes les tâches sont prises. Revenez plus tard."
          taches={aPrendre}
          rendreActions={(tache) => (
            <button
              type="button"
              className="btn btn--principal btn--petit"
              disabled={envoi}
              onClick={() => agir(() => service.prendreTache(tache.id))}
            >
              Prendre cette tâche
            </button>
          )}
        />

        <Colonne
          titre="En cours"
          sousTitre="vous les avez prises"
          compteur={compteurs.en_cours ?? 0}
          vide="Rien en cours. Prenez une tâche à gauche."
          taches={taches.filter((t) => t.statut === 'en_cours')}
          rendreActions={(tache) => (
            <>
              <button
                type="button"
                className="btn btn--principal btn--petit"
                disabled={envoi}
                onClick={() => agir(() => service.livrerTache(tache.id))}
              >
                Marquer livrée
              </button>
              <button
                type="button"
                className="btn btn--neutre btn--petit"
                disabled={envoi}
                onClick={() => agir(() => service.relacherTache(tache.id))}
              >
                Rendre
              </button>
            </>
          )}
        />

        <Colonne
          titre="Livrée"
          sousTitre="en attente de validation"
          compteur={compteurs.livree ?? 0}
          vide="Rien de livré pour l’instant."
          taches={taches.filter((t) => t.statut === 'livree')}
          rendreActions={(tache) => (
            <span className="carte-tache__fait">Livrée le {fmt.date(tache.livreeLe)}</span>
          )}
        />
      </div>
    </>
  );
}

/** Une colonne du tableau des taches. */
function Colonne({ titre, sousTitre, compteur, vide, taches, rendreActions }) {
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
          <CarteTache key={tache.id} tache={tache} actions={rendreActions(tache)} />
        ))
      )}
    </section>
  );
}

/** Une tache en carte, avec ses actions. */
function CarteTache({ tache, actions }) {
  // Une echeance depassee sur une tache non livree merite d'etre vue.
  const enRetard =
    tache.echeance && tache.statut !== 'livree' && new Date(tache.echeance) < new Date();

  return (
    <article className="carte-tache">
      <p className="carte-tache__projet">{tache.projetNom}</p>
      <h3 className="carte-tache__titre">{tache.titre}</h3>
      {tache.description && <p className="carte-tache__texte">{tache.description}</p>}

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
