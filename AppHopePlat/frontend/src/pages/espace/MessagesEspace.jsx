import { useCallback, useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';

import { PleineMessages } from '../../components/IconesPleines.jsx';
import * as service from '../../services/espace.service.js';
import * as fmt from '../../utils/format.js';

/**
 * La correspondance avec l'equipe HOPE, commune aux espaces.
 *
 * Un fil par sujet : le message envoye, et la reponse quand elle vient.
 * Pas de conversation a plusieurs tours -- l'equipe repond une fois, et
 * un nouveau sujet ouvre un nouveau fil. C'est ce que la table dit, et
 * l'ecran ne promet rien de plus.
 */
export default function MessagesEspace() {
  const { api, rafraichirCompteurs } = useOutletContext();

  const [items, setItems] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState(null);

  const [sujet, setSujet] = useState('');
  const [corps, setCorps] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const [details, setDetails] = useState({});
  const [succes, setSucces] = useState(null);

  const charger = useCallback(async () => {
    try {
      setItems(await service.messages(api));
      setErreur(null);
      // La lecture eteint la pastille cote serveur : le menu doit le savoir.
      rafraichirCompteurs?.();
    } catch (e) {
      setErreur(e.response?.data?.message ?? 'Impossible de charger vos messages.');
    } finally {
      setChargement(false);
    }
  }, [api, rafraichirCompteurs]);

  useEffect(() => {
    charger();
  }, [charger]);

  async function envoyer(evenement) {
    evenement.preventDefault();
    setEnvoi(true);
    setDetails({});
    setSucces(null);
    try {
      await service.envoyerMessage(api, { sujet, corps });
      setSujet('');
      setCorps('');
      setSucces('Message envoyé. L’équipe vous répondra ici même.');
      await charger();
    } catch (e) {
      setDetails(e.response?.data?.details ?? {});
      setErreur(
        e.response?.data?.details
          ? null
          : (e.response?.data?.message ?? 'L’envoi a échoué.')
      );
    } finally {
      setEnvoi(false);
    }
  }

  const attente = items.filter((m) => m.statut === 'envoye').length;

  return (
    <div className="accueil-benevole">
      <header>
        <p className="surtitre">
          <span className="trait-hope surtitre__trait" aria-hidden="true" />
          Écrire à HOPE
        </p>
        <h1 className="accueil-benevole__titre">Messages</h1>
        <p className="accueil-benevole__accroche">
          Une question, une disponibilité, un document à demander : l’équipe répond ici.
        </p>
      </header>

      {erreur && <p className="alerte-benevole">{erreur}</p>}

      <div className="accueil-benevole__paire accueil-benevole__paire--messages">
        {/* ---------- Le fil ---------- */}
        <section className="bloc">
          <div className="bloc__entete">
            <h2 className="bloc__titre">Mes messages</h2>
            {items.length > 0 && (
              <p className="bloc__sous-titre">
                {attente > 0
                  ? `${attente} en attente de réponse`
                  : 'Tous ont une réponse'}
              </p>
            )}
          </div>

          {chargement ? (
            <p className="bloc__vide">Chargement…</p>
          ) : items.length === 0 ? (
            <p className="bloc__vide">
              Vous n’avez encore rien envoyé. Le formulaire ci-contre ouvre un premier
              échange.
            </p>
          ) : (
            <ul className="fil-messages">
              {items.map((m) => (
                <li key={m.id} className="echange">
                  <div className="echange__tete">
                    <span className="carre-icone carre-icone--violet" aria-hidden="true">
                      <PleineMessages />
                    </span>
                    <div className="echange__intitule">
                      <h3 className="echange__sujet">{m.sujet}</h3>
                      <p className="echange__date">Envoyé {fmt.depuis(m.creeLe)}</p>
                    </div>
                    <span
                      className={`pastille pastille--${m.statut === 'repondu' ? 'valide' : 'orange'}`}
                    >
                      {m.statut === 'repondu' ? 'Répondu' : 'En attente'}
                    </span>
                  </div>

                  <p className="echange__corps">{m.corps}</p>

                  {m.reponse ? (
                    <div className="echange__reponse">
                      <p className="echange__signature">
                        Réponse de {m.reponduPar ?? 'l’équipe HOPE'}
                        {m.reponduLe ? ` · ${fmt.date(m.reponduLe)}` : ''}
                      </p>
                      <p>{m.reponse}</p>
                    </div>
                  ) : (
                    <p className="echange__attente">
                      L’équipe n’a pas encore répondu. Vous serez prévenu ici.
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* ---------- Le formulaire ---------- */}
        <section className="bloc bloc--collant">
          <div className="bloc__entete">
            <h2 className="bloc__titre">Nouveau message</h2>
          </div>

          <form onSubmit={envoyer} className="formulaire-espace">
            <label className="champ-espace">
              <span className="champ-espace__label">Sujet</span>
              <input
                type="text"
                value={sujet}
                maxLength={160}
                onChange={(e) => setSujet(e.target.value)}
                placeholder="Disponibilité, document, question…"
              />
              {details.sujet && <span className="champ-espace__erreur">{details.sujet}</span>}
            </label>

            <label className="champ-espace">
              <span className="champ-espace__label">Votre message</span>
              <textarea
                rows={7}
                value={corps}
                maxLength={4000}
                onChange={(e) => setCorps(e.target.value)}
                placeholder="Dites-nous en quelques lignes ce dont vous avez besoin."
              />
              {details.corps && <span className="champ-espace__erreur">{details.corps}</span>}
            </label>

            {succes && <p className="succes-benevole">{succes}</p>}

            <button type="submit" className="bouton-hope" disabled={envoi}>
              {envoi ? 'Envoi…' : 'Envoyer'}
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
