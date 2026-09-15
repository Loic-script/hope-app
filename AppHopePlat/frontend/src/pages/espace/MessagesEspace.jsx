import { useCallback, useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';

import { IconePlus } from '../../components/admin/AdminIcons.jsx';
import { PleineMessages } from '../../components/IconesPleines.jsx';
import * as service from '../../services/espace.service.js';
import * as fmt from '../../utils/format.js';

/**
 * La correspondance avec l'equipe HOPE, commune aux espaces.
 *
 * Meme ossature que la messagerie de l'administration : les fils a
 * gauche, l'echange a droite, en bulles. Les deux ecrans montrent la
 * meme chose vue des deux bouts -- il n'y avait pas de raison qu'ils se
 * ressemblent si peu.
 *
 * Un fil est une vraie conversation : chaque prise de parole est une
 * ligne, et les deux bouts peuvent repondre. Une nouvelle question ouvre
 * un nouveau fil, par le bouton "Ecrire" de la liste.
 */
export default function MessagesEspace() {
  const { api, rafraichirCompteurs } = useOutletContext();

  const [items, setItems] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState(null);
  const [actif, setActif] = useState(null);

  // La composition : ouverte par le "+", et au premier message.
  const [compose, setCompose] = useState(false);
  const [sujet, setSujet] = useState('');
  const [corps, setCorps] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const [details, setDetails] = useState({});
  // La reponse dans un fil ouvert, distincte de la composition.
  const [reponse, setReponse] = useState('');

  const charger = useCallback(async () => {
    try {
      const liste = await service.messages(api);
      setItems(liste);
      setErreur(null);
      // On garde le fil ouvert s'il existe encore ; sinon le plus recent.
      setActif((courant) =>
        liste.some((m) => m.id === courant) ? courant : (liste[0]?.id ?? null)
      );
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
    try {
      const cree = await service.envoyerMessage(api, { sujet, corps });
      setSujet('');
      setCorps('');
      setCompose(false);
      await charger();
      if (cree?.id) setActif(cree.id);
    } catch (e) {
      setDetails(e.response?.data?.details ?? {});
      if (!e.response?.data?.details) {
        setErreur(e.response?.data?.message ?? 'L’envoi a échoué.');
      }
    } finally {
      setEnvoi(false);
    }
  }

  async function repondre(evenement) {
    evenement.preventDefault();
    if (reponse.trim() === '') return;
    setEnvoi(true);
    try {
      await service.repondre(api, actif, reponse);
      setReponse('');
      await charger();
    } catch (e) {
      setErreur(e.response?.data?.message ?? 'L’envoi a échoué.');
    } finally {
      setEnvoi(false);
    }
  }

  const attente = items.filter((m) => m.statut === 'envoye').length;
  const ouvert = items.find((m) => m.id === actif) ?? null;

  function ouvrirComposition() {
    setCompose(true);
    setActif(null);
    setDetails({});
  }

  return (
    <>
      <header className="page-benevole__entete">
        <p className="surtitre">
          <span className="trait-hope surtitre__trait" aria-hidden="true" />
          Écrire à HOPE
        </p>
        <h1 className="page-benevole__titre">Messages</h1>
        <p className="page-benevole__accroche">
          Une question, une disponibilité, un document à demander : l’équipe répond ici.
        </p>
      </header>

      {erreur && <p className="alerte-benevole">{erreur}</p>}

      <div className="messagerie">
        {/* ================= Les fils ================= */}
        <section className="messagerie__volet">
          <div className="conversations__entete">
            <div>
              <p className="conversations__titre">Mes messages</p>
              <p className="conversations__compte">
                {items.length === 0
                  ? 'Aucun pour l’instant'
                  : attente > 0
                    ? `${attente} en attente de réponse`
                    : 'Tous ont une réponse'}
              </p>
            </div>
            <button
              type="button"
              className="btn btn--principal btn--petit"
              onClick={ouvrirComposition}
            >
              <IconePlus />
              Écrire
            </button>
          </div>

          <div className="conversations__liste">
            {chargement ? (
              <div className="echange__vide">Chargement…</div>
            ) : items.length === 0 ? (
              <div className="etat-vide">
                <p className="etat-vide__titre">Aucun message</p>
                <p className="etat-vide__texte">
                  Le bouton « Écrire » ouvre un premier échange avec l’équipe.
                </p>
              </div>
            ) : (
              items.map((message) => (
                <button
                  type="button"
                  key={message.id}
                  className={
                    'conversation' +
                    (message.id === actif ? ' conversation--active' : '') +
                    // Une reponse non lue met le fil en avant, comme un
                    // message non lu cote administration.
                    (message.nonLus > 0 ? ' conversation--nouvelle' : '')
                  }
                  onClick={() => {
                    setActif(message.id);
                    setCompose(false);
                  }}
                  aria-current={message.id === actif}
                >
                  <span className="conversation__avatar" aria-hidden="true">
                    <PleineMessages />
                  </span>

                  <span className="conversation__corps">
                    <span className="conversation__ligne">
                      <span className="conversation__nom">{message.sujet}</span>
                      <span className="conversation__temps">{fmt.depuis(message.creeLe)}</span>
                    </span>
                    <span className="conversation__extrait">
                      {derniere(message)?.auteur === 'hope' ? 'HOPE : ' : ''}
                      {derniere(message)?.corps ?? ''}
                    </span>
                    <span className="conversation__ligne">
                      <span className="conversation__courriel">
                        {message.statut === 'repondu' ? 'Répondu' : 'En attente'}
                      </span>
                      {message.nonLus > 0 && (
                        <span className="conversation__pastille">{message.nonLus}</span>
                      )}
                    </span>
                  </span>
                </button>
              ))
            )}
          </div>
        </section>

        {/* ================= L'echange, ou la composition ================= */}
        <section className="messagerie__volet">
          {compose ? (
            <>
              <header className="echange__entete">
                <div className="echange__identite">
                  <span className="conversation__avatar" aria-hidden="true">
                    <IconePlus />
                  </span>
                  <div style={{ minWidth: 0 }}>
                    <p className="echange__nom">Nouveau message</p>
                    <p className="echange__courriel">
                      L’équipe HOPE vous répondra dans ce même fil.
                    </p>
                  </div>
                </div>
              </header>

              <form className="composition" onSubmit={envoyer}>
                <label className="champ-espace">
                  <span className="champ-espace__label">Sujet</span>
                  <input
                    type="text"
                    value={sujet}
                    maxLength={160}
                    onChange={(e) => setSujet(e.target.value)}
                    placeholder="Disponibilité, document, question…"
                    disabled={envoi}
                  />
                  {details.sujet && (
                    <span className="champ-espace__erreur">{details.sujet}</span>
                  )}
                </label>

                <label className="champ-espace champ-espace--extensible">
                  <span className="champ-espace__label">Votre message</span>
                  <textarea
                    value={corps}
                    maxLength={4000}
                    onChange={(e) => setCorps(e.target.value)}
                    placeholder="Dites-nous en quelques lignes ce dont vous avez besoin."
                    disabled={envoi}
                  />
                  {details.corps && (
                    <span className="champ-espace__erreur">{details.corps}</span>
                  )}
                </label>

                <div className="composition__pied">
                  {items.length > 0 && (
                    <button
                      type="button"
                      className="btn btn--neutre"
                      onClick={() => setCompose(false)}
                      disabled={envoi}
                    >
                      Annuler
                    </button>
                  )}
                  <button type="submit" className="btn btn--principal" disabled={envoi}>
                    {envoi ? 'Envoi…' : 'Envoyer'}
                  </button>
                </div>
              </form>
            </>
          ) : !ouvert ? (
            <div className="echange__vide">
              {items.length === 0
                ? 'Écrivez à l’équipe : votre échange s’affichera ici.'
                : 'Sélectionnez un message dans la liste.'}
            </div>
          ) : (
            <>
              <header className="echange__entete">
                <div className="echange__identite">
                  <span className="conversation__avatar" aria-hidden="true">
                    <PleineMessages />
                  </span>
                  <div style={{ minWidth: 0 }}>
                    <p className="echange__nom">{ouvert.sujet}</p>
                    <p className="echange__courriel">
                      Ouvert le {fmt.date(ouvert.creeLe)} · {ouvert.entrees.length} message
                      {ouvert.entrees.length > 1 ? 's' : ''}
                    </p>
                  </div>
                </div>

                <span
                  className={`pastille pastille--${
                    ouvert.statut === 'repondu' ? 'valide' : 'orange'
                  }`}
                >
                  {ouvert.statut === 'repondu' ? 'Répondu' : 'En attente'}
                </span>
              </header>

              <div className="echange__fil">
                {/* Le mien a droite, celui de HOPE a gauche : l'inverse de
                    l'ecran d'administration, ou c'est HOPE qui ecrit. Pas
                    de sujet dans les bulles : l'en-tete du volet le porte
                    deja, juste au-dessus. */}
                {ouvert.entrees.map((entree) => (
                  <Bulle
                    key={entree.id}
                    sens={entree.auteur === 'hope' ? 'recue' : 'envoyee'}
                    contenu={entree.corps}
                    horodatage={entree.creeLe}
                    legende={
                      entree.auteur === 'hope' ? (entree.auteurNom ?? 'Équipe HOPE') : 'Vous'
                    }
                  />
                ))}
                {ouvert.statut === 'envoye' && (
                  <p className="echange__attente">
                    L’équipe n’a pas encore répondu. Vous serez prévenu ici, et par une
                    notification.
                  </p>
                )}
              </div>

              {/* La conversation continue : on repond dans le fil, comme
                  l'equipe le fait de son cote. */}
              <form className="reponse" onSubmit={repondre}>
                <textarea
                  value={reponse}
                  onChange={(e) => setReponse(e.target.value)}
                  placeholder="Écrire une réponse…"
                  disabled={envoi}
                  aria-label="Votre réponse"
                  rows={2}
                />
                <button
                  type="submit"
                  className="btn btn--principal"
                  disabled={envoi || reponse.trim() === ''}
                >
                  {envoi ? 'Envoi…' : 'Envoyer'}
                </button>
              </form>
            </>
          )}
        </section>
      </div>
    </>
  );
}

/** La derniere parole d'un fil : celle qui le resume dans la liste. */
function derniere(fil) {
  return fil.entrees?.[fil.entrees.length - 1] ?? null;
}

/** Une bulle du fil : la mienne, ou celle de HOPE. */
function Bulle({ sens, sujet, contenu, horodatage, legende }) {
  return (
    <article className={`bulle bulle--${sens}`}>
      {sujet && <p className="bulle__sujet">{sujet}</p>}
      <div className="bulle__contenu">{contenu}</div>
      <p className="bulle__meta">
        {legende} · {fmt.date(horodatage)} · {fmt.depuis(horodatage)}
      </p>
    </article>
  );
}
