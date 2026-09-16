import { Link, useOutletContext } from 'react-router-dom';
import { useCallback, useEffect, useState } from 'react';

import {
  PleineCalendrier,
  PleineDons,
  PleineJournal,
  PleinePersonne,
  PleinePreuves,
  PleineTaches,
} from '../../components/IconesPleines.jsx';
import * as service from '../../services/espace.service.js';
import * as fmt from '../../utils/format.js';

/**
 * Le fil de notifications, commun au benevole et au bailleur.
 *
 * L'ecran est le meme des deux cotes : ce qui change tient dans le
 * client axios, que la coque de l'espace fournit par le contexte. Une
 * page par espace aurait double le meme code, et la correction de l'un
 * aurait oublie l'autre.
 */

/** Une icone par type d'evenement, dans la couleur qui lui va. */
const ALLURE = {
  tache: { Icone: PleineTaches, teinte: 'bleu' },
  journal: { Icone: PleineJournal, teinte: 'violet' },
  profil: { Icone: PleinePersonne, teinte: 'jaune' },
  preuve: { Icone: PleinePreuves, teinte: 'bleu' },
  rapport: { Icone: PleineCalendrier, teinte: 'violet' },
  versement: { Icone: PleineDons, teinte: 'orange' },
  actualite: { Icone: PleineDons, teinte: 'orange' },
};
const PAR_DEFAUT = { Icone: PleineCalendrier, teinte: 'bleu' };

export default function NotificationsEspace() {
  const { api, rafraichirCompteurs } = useOutletContext();

  const [items, setItems] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState(null);

  const charger = useCallback(async () => {
    try {
      setItems(await service.notifications(api));
      setErreur(null);
    } catch (e) {
      setErreur(e.response?.data?.message ?? 'Impossible de charger vos notifications.');
    } finally {
      setChargement(false);
    }
  }, [api]);

  useEffect(() => {
    charger();
  }, [charger]);

  const nonLues = items.filter((n) => !n.lu).length;

  /*
   * L'etat local est mis a jour sans recharger la liste : la ligne perd
   * sa marque au clic, sans que la page ne tressaute. Le serveur reste
   * la source de verite -- la pastille du menu, elle, est rechargee.
   */
  async function lire(notification) {
    if (notification.lu) return;
    setItems((liste) =>
      liste.map((n) => (n.id === notification.id ? { ...n, lu: true } : n))
    );
    try {
      await service.marquerLue(api, notification.id);
      rafraichirCompteurs?.();
    } catch {
      charger();
    }
  }

  async function toutLire() {
    setItems((liste) => liste.map((n) => ({ ...n, lu: true })));
    try {
      await service.marquerToutLu(api);
      rafraichirCompteurs?.();
    } catch {
      charger();
    }
  }

  return (
    <div className="accueil-benevole">
      <header className="accueil-benevole__entete">
        <div>
          <p className="surtitre">
            <span className="trait-hope surtitre__trait" aria-hidden="true" />
            Ce qui vous concerne
          </p>
          <h1 className="accueil-benevole__titre">Notifications</h1>
          <p className="accueil-benevole__accroche">
            {nonLues > 0
              ? `${nonLues} notification${nonLues > 1 ? 's' : ''} non lue${nonLues > 1 ? 's' : ''}.`
              : 'Vous êtes à jour.'}
          </p>
        </div>

        {nonLues > 0 && (
          <button type="button" className="bouton-hope bouton-hope--creux" onClick={toutLire}>
            Tout marquer comme lu
          </button>
        )}
      </header>

      {erreur && <p className="alerte-benevole">{erreur}</p>}

      <section className="bloc">
        {chargement ? (
          <p className="bloc__vide">Chargement…</p>
        ) : items.length === 0 ? (
          <p className="bloc__vide">
            Aucune notification pour l’instant. Elles arriveront ici dès qu’une tâche
            ou un document vous concernera.
          </p>
        ) : (
          <ul className="fil-notifs">
            {items.map((n) => {
              const { Icone, teinte } = ALLURE[n.type] ?? PAR_DEFAUT;
              const Contenu = (
                <>
                  <span className={`carre-icone carre-icone--${teinte}`} aria-hidden="true">
                    <Icone />
                  </span>
                  <span className="notif__corps">
                    <span className="notif__titre">{n.titre}</span>
                    {n.corps && <span className="notif__texte">{n.corps}</span>}
                    <span className="notif__date">{fmt.depuis(n.creeLe)}</span>
                  </span>
                  {!n.lu && <span className="notif__point" aria-label="Non lue" />}
                </>
              );

              return (
                <li key={n.id} className={`notif${n.lu ? '' : ' notif--neuve'}`}>
                  {n.lien ? (
                    <Link className="notif__lien" to={n.lien} onClick={() => lire(n)}>
                      {Contenu}
                    </Link>
                  ) : (
                    <button type="button" className="notif__lien" onClick={() => lire(n)}>
                      {Contenu}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
