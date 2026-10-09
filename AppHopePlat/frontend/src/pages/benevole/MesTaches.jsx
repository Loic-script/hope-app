import { useEffect, useState } from 'react';

import { Carrousel } from '../../components/preuves/MediasPreuve.jsx';
import { useChargement } from '../../hooks/useChargement.js';
import { messageErreur } from '../../services/api.js';
import * as service from '../../services/espaceBenevole.service.js';
import * as fmt from '../../utils/format.js';
import { LIBELLES_PRIORITE } from '../../utils/priorites.js';
import { ActionDemande } from './composants.jsx';
import { DetailTacheModale, FormulaireLivraison } from './ModalesTache.jsx';

const COLONNES = [
  {
    cle: 'prendre',
    titre: 'À prendre',
    sousTitre: 'Demandez-la : l’équipe HOPE valide',
    vide: 'Aucune tâche à prendre pour l’instant. Revenez plus tard.',
  },
  {
    cle: 'cours',
    titre: 'En cours',
    sousTitre: 'Vous faites partie de l’équipe',
    vide: 'Rien en cours. Demandez une tâche dans « À prendre ».',
  },
  {
    cle: 'livree',
    titre: 'Livrée',
    sousTitre: 'En attente de validation',
    vide: 'Rien de livré pour l’instant.',
  },
];

export default function MesTaches() {
  const miennes = useChargement(() => service.mesTaches(), []);
  const libres = useChargement(() => service.tachesLibres(), []);

  const [envoi, setEnvoi] = useState(false);
  const [refus, setRefus] = useState('');

  const [ouverte, setOuverte] = useState(null);
  const [livraisonEnvoi, setLivraisonEnvoi] = useState(false);
  const [preuve, setPreuve] = useState(null);
  const [vue, setVue] = useState(null);

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
  const parColonne = {
    prendre: libres.donnees ?? [],
    cours: taches.filter((t) => t.statut === 'en_cours'),
    livree: taches.filter((t) => t.statut === 'livree'),
  };

  useEffect(() => {
    if (vue || !miennes.donnees || !libres.donnees) return;
    setVue(parColonne.cours.length > 0 ? 'cours' : 'prendre');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [miennes.donnees, libres.donnees]);

  function actionsDe(colonne, tache, dansFenetre = false) {
    const principal = dansFenetre ? 'btn btn--principal' : 'btn btn--principal btn--petit';
    const neutre = dansFenetre ? 'btn btn--neutre' : 'btn btn--neutre btn--petit';

    if (colonne === 'prendre') {
      return (
        <ActionDemande
          tache={tache}
          envoi={envoi}
          classeBouton={principal}
          classeSecondaire={neutre}
          onDemander={async (t) => {
            if ((await agir(() => service.demanderTache(t.id))) && dansFenetre) setOuverte(null);
          }}
          onAnnuler={async (t) => {
            if ((await agir(() => service.annulerDemandeTache(t.id))) && dansFenetre) setOuverte(null);
          }}
        />
      );
    }

    if (colonne === 'cours') {
      const livraisonOuverte = dansFenetre && ouverte?.livrer;
      return (
        <>
          {!livraisonOuverte && (
            <button
              type="button"
              className={principal}
              disabled={envoi}
              onClick={() => setOuverte({ tache, colonne: 'cours', livrer: true })}
            >
              Marquer livrée
            </button>
          )}
          <button
            type="button"
            className={neutre}
            disabled={envoi}
            onClick={async () => {
              if ((await agir(() => service.relacherTache(tache.id))) && dansFenetre) setOuverte(null);
            }}
          >
            Quitter
          </button>
        </>
      );
    }

    return (
      <>
        {dansFenetre && (
          <span className="carte-tache__fait">
            Livrée le {fmt.date(tache.livreeLe)}
            {tache.livreeParMoi ? ' par vous' : ' par votre équipe'}
          </span>
        )}
        {tache.files?.length > 0 && (
          <button type="button" className={neutre} onClick={() => setPreuve({ tache, rang: 0 })}>
            Voir la preuve ({tache.files.length})
          </button>
        )}
      </>
    );
  }

  const chargement = (miennes.chargement && !miennes.donnees) || (libres.chargement && !libres.donnees);

  return (
    <>
      <header className="page-benevole__entete">
        <h1 className="page-benevole__titre">Mes tâches</h1>
        <p className="page-benevole__accroche">
          Ce que vous avez pris en charge, et ce qu’il reste à prendre. Touchez une tâche pour tout voir.
        </p>
      </header>

      {refus && <p className="alerte-benevole">{refus}</p>}
      {miennes.erreur && <p className="alerte-benevole">{miennes.erreur}</p>}

      <div className="onglets-taches" role="tablist" aria-label="Colonnes">
        {COLONNES.map((c) => (
          <button
            key={c.cle}
            type="button"
            role="tab"
            aria-selected={vue === c.cle}
            className={`onglets-taches__onglet onglets-taches__onglet--${c.cle}${
              vue === c.cle ? ' onglets-taches__onglet--actif' : ''
            }`}
            onClick={() => setVue(c.cle)}
          >
            {c.titre}
            <span className="onglets-taches__compte">{parColonne[c.cle].length}</span>
          </button>
        ))}
      </div>

      <div className="colonnes-taches">
        {COLONNES.map((c) => (
          <section
            key={c.cle}
            className={`colonne-taches colonne-taches--${c.cle}`}
            data-visible={vue === null || vue === c.cle}
            aria-labelledby={`colonne-${c.cle}`}
          >
            <header className="colonne-taches__tete">
              <h2 className="colonne-taches__titre" id={`colonne-${c.cle}`}>
                <span className="colonne-taches__point" aria-hidden="true" />
                {c.titre}
                <span className="colonne-taches__compteur" key={parColonne[c.cle].length}>
                  {parColonne[c.cle].length}
                </span>
              </h2>
              <p className="colonne-taches__sous-titre">{c.sousTitre}</p>
            </header>

            {chargement ? (
              <div className="colonne-taches__squelettes" aria-hidden="true">
                <span />
                <span />
              </div>
            ) : parColonne[c.cle].length === 0 ? (
              <p className="colonne-taches__vide">
                <IconeVide colonne={c.cle} />
                {c.vide}
              </p>
            ) : (
              <ul className="colonne-taches__liste">
                {parColonne[c.cle].map((tache, i) => (
                  <li key={tache.id} style={{ '--rang': i }}>
                    <CarteTache
                      tache={tache}
                      choisie={ouverte?.tache.id === tache.id && ouverte?.colonne === c.cle}
                      onOuvrir={() => setOuverte({ tache, colonne: c.cle })}
                      actions={actionsDe(c.cle, tache)}
                    />
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>

      {ouverte && (
        <DetailTacheModale
          tache={ouverte.tache}
          envoi={envoi || livraisonEnvoi}
          onFermer={() => !livraisonEnvoi && setOuverte(null)}
          actions={actionsDe(ouverte.colonne, ouverte.tache, true)}
          livraison={
            ouverte.livrer && ouverte.colonne === 'cours' ? (
              <FormulaireLivraison
                tache={ouverte.tache}
                onEnvoi={setLivraisonEnvoi}
                onAnnuler={() => setOuverte((actuelle) => ({ ...actuelle, livrer: false }))}
                onLivree={() => {
                  setOuverte(null);
                  miennes.recharger();
                }}
              />
            ) : null
          }
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

function CarteTache({ tache, actions, onOuvrir, choisie = false }) {
  const priorite = tache.priorite ?? 'moyenne';
  return (
    <article
      className={`carte-tache carte-tache--ouvrable carte-tache--${priorite}${choisie ? ' carte-tache--choisie' : ''}`}
    >
      <div className="carte-tache__haut">
        <h3 className="carte-tache__titre">
          <button type="button" className="carte-tache__ouvrir" onClick={onOuvrir} aria-haspopup="dialog">
            {tache.titre}
          </button>
        </h3>
        <span className={`jeton-priorite jeton-priorite--${priorite}`}>{LIBELLES_PRIORITE[priorite]}</span>
      </div>

      <div className="carte-tache__bas">
        {actions && <div className="carte-tache__actions">{actions}</div>}
        <span className="carte-tache__detail" aria-hidden="true">
          Détails
          <svg viewBox="0 0 24 24">
            <path d="M9 6l6 6-6 6" />
          </svg>
        </span>
      </div>
    </article>
  );
}

function IconeVide({ colonne }) {
  const traits = {
    prendre: <path d="M12 5v14M5 12h14" />,
    cours: <path d="M12 7v5l3 2M12 21a9 9 0 110-18 9 9 0 010 18z" />,
    livree: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  };
  return (
    <svg className="colonne-taches__icone-vide" viewBox="0 0 24 24" aria-hidden="true">
      {traits[colonne]}
    </svg>
  );
}
