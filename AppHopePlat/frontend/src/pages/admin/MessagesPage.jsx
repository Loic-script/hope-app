import { useEffect, useMemo, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';

import { IconeJustificatifs, IconeRecherche } from '../../components/admin/AdminIcons.jsx';
import { NouveauMessageModale } from '../../components/admin/modales.jsx';
import { Alerte, Badge, Chargement, EntetePage } from '../../components/admin/ui.jsx';
import { useChargement, useSoumission } from '../../hooks/useChargement.js';
import * as catalogService from '../../services/catalog.service.js';
import * as donorService from '../../services/donor.service.js';
import * as messageService from '../../services/message.service.js';
import * as fmt from '../../utils/format.js';

/**
 * Regroupe les messages par donateur : une conversation par compte.
 *
 * Le backend renvoie des messages a plat ; c'est ici qu'on reconstitue le
 * fil de chaque donateur, du plus ancien au plus recent.
 */
function construireConversations(messages) {
  const parCompte = new Map();

  for (const message of messages) {
    const cle = message.donorAccountId;
    if (!parCompte.has(cle)) {
      parCompte.set(cle, {
        accountId: cle,
        donorId: message.donorId,
        donorName: message.donorName,
        accountEmail: message.accountEmail,
        donorOrigin: message.donorOrigin,
        donationsCount: message.donorDonationsCount,
        messages: [],
      });
    }
    parCompte.get(cle).messages.push(message);
  }

  return [...parCompte.values()]
    .map((conversation) => {
      const tries = [...conversation.messages].sort(
        (a, b) => new Date(a.createdAt) - new Date(b.createdAt)
      );
      const dernier = tries[tries.length - 1];

      return {
        ...conversation,
        messages: tries,
        dernier,
        // Un echange se lit a sa derniere activite : le message ou la reponse.
        derniereActivite: dernier.repliedAt ?? dernier.createdAt,
        nonLus: tries.filter((message) => message.status === 'NEW').length,
      };
    })
    .sort((a, b) => new Date(b.derniereActivite) - new Date(a.derniereActivite));
}

/** Bulle d'un message reçu ou d'une reponse envoyee. */
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

/**
 * Ecran Messages : les echanges avec les donateurs disposant d'un compte.
 *
 * Ecrire a HOPE fait partie des avantages du compte donateur : la
 * messagerie n'est donc pas ouverte aux donateurs ponctuels.
 */
export default function MessagesPage() {
  const { rafraichirCompteurs } = useOutletContext();

  const [recherche, setRecherche] = useState('');
  const [compteSelectionne, setCompteSelectionne] = useState(null);
  const [brouillon, setBrouillon] = useState('');
  const [modaleOuverte, setModaleOuverte] = useState(false);

  const { donnees, chargement, erreur, recharger } = useChargement(
    () => messageService.lister(),
    []
  );
  const { donnees: comptes } = useChargement(() => donorService.listerComptes(), []);
  const { donnees: catalogue } = useChargement(() => catalogService.recuperer(), []);

  const { envoi, erreur: erreurAction, setErreur, soumettre } = useSoumission();

  const libelles = catalogue?.labels ?? {};
  const conversations = useMemo(
    () => construireConversations(donnees?.items ?? []),
    [donnees]
  );

  const conversationsFiltrees = useMemo(() => {
    const terme = recherche.trim().toLowerCase();
    if (terme === '') return conversations;

    return conversations.filter((conversation) =>
      [
        conversation.donorName,
        conversation.accountEmail,
        conversation.dernier.subject,
        conversation.dernier.body,
      ]
        .filter(Boolean)
        .some((champ) => champ.toLowerCase().includes(terme))
    );
  }, [conversations, recherche]);

  // La premiere conversation est ouverte d'office, et on garde la selection
  // valide quand la liste change (recherche, rechargement).
  useEffect(() => {
    if (conversationsFiltrees.length === 0) {
      setCompteSelectionne(null);
      return;
    }
    const existeToujours = conversationsFiltrees.some(
      (conversation) => conversation.accountId === compteSelectionne
    );
    if (!existeToujours) setCompteSelectionne(conversationsFiltrees[0].accountId);
  }, [conversationsFiltrees, compteSelectionne]);

  const active = conversationsFiltrees.find(
    (conversation) => conversation.accountId === compteSelectionne
  );

  // Ouvrir une conversation marque ses messages comme lus.
  useEffect(() => {
    if (!active || active.nonLus === 0) return;

    const aLire = active.messages.filter((message) => message.status === 'NEW');
    Promise.all(aLire.map((message) => messageService.marquerLu(message.id)))
      .then(() => {
        recharger();
        rafraichirCompteurs?.();
      })
      .catch(() => {
        // Un echec de marquage ne doit pas empecher de lire l'echange.
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active?.accountId, active?.nonLus]);

  function selectionner(accountId) {
    setCompteSelectionne(accountId);
    setBrouillon('');
    setErreur('');
  }

  /**
   * Repond au dernier message du donateur.
   *
   * S'il a deja recu une reponse, on la remplace explicitement — le backend
   * l'exige pour eviter d'ecraser un envoi par megarde.
   */
  async function envoyerReponse(evenement) {
    evenement.preventDefault();
    if (!active || brouillon.trim() === '') return;

    const cible = active.dernier;
    await soumettre(
      () =>
        messageService.repondre(cible.id, brouillon.trim(), { force: Boolean(cible.reply) }),
      {
        onSucces: () => {
          setBrouillon('');
          recharger();
          rafraichirCompteurs?.();
        },
      }
    );
  }

  const aucunCompte = (comptes?.items ?? []).length === 0;

  return (
    <>
      <EntetePage
        titre="Messages"
        accroche="Les donateurs disposant d’un compte peuvent écrire à HOPE. Leurs messages arrivent ici."
        actions={
          <button
            type="button"
            className="btn btn--neutre"
            onClick={() => setModaleOuverte(true)}
            disabled={aucunCompte}
            title={
              aucunCompte
                ? 'Aucun donateur ne dispose encore d’un compte'
                : 'Garder trace d’un échange reçu par un autre canal'
            }
          >
            Enregistrer un message reçu
          </button>
        }
      />

      {erreur && <Alerte>{erreur}</Alerte>}
      {erreurAction && <Alerte>{erreurAction}</Alerte>}

      {chargement && !donnees ? (
        <Chargement texte="Chargement des messages…" />
      ) : (
        <div className="messagerie">
          {/* ================= Conversations ================= */}
          <section className="messagerie__volet">
            <header className="conversations__entete">
              <div>
                <h2 className="conversations__titre">Conversations</h2>
                <p className="conversations__compte">
                  {conversations.length === 0
                    ? 'Aucune conversation'
                    : `${fmt.nombre(conversations.length)} conversation(s)`}
                </p>
              </div>
              <span className="conversations__marque" aria-hidden="true">
                <IconeJustificatifs />
              </span>
            </header>

            {conversations.length > 0 && (
              <div className="outils">
                <div className="outils__recherche" style={{ maxWidth: 'none' }}>
                  <IconeRecherche />
                  <input
                    type="search"
                    value={recherche}
                    onChange={(e) => setRecherche(e.target.value)}
                    placeholder="Rechercher un donateur, un sujet…"
                    aria-label="Rechercher une conversation"
                  />
                </div>
              </div>
            )}

            <div className="conversations__liste">
              {conversations.length === 0 ? (
                <div className="etat-vide">
                  <p className="etat-vide__titre">Aucune conversation pour le moment</p>
                  <p className="etat-vide__texte">
                    {aucunCompte
                      ? 'Seuls les donateurs disposant d’un compte peuvent écrire à HOPE. ' +
                        'Ouvrez un compte à un donateur depuis l’écran Donateurs : ses messages ' +
                        'apparaîtront ici.'
                      : 'Vos donateurs avec un compte n’ont pas encore écrit. Leurs messages ' +
                        'arriveront dans cette liste.'}
                  </p>
                  <div className="etat-vide__action">
                    <Link className="btn btn--principal" to="/admin/donors">
                      Ouvrir les donateurs
                    </Link>
                  </div>
                </div>
              ) : conversationsFiltrees.length === 0 ? (
                <div className="etat-vide">
                  <p className="etat-vide__titre">Aucun résultat</p>
                  <p className="etat-vide__texte">Aucune conversation ne correspond à « {recherche} ».</p>
                </div>
              ) : (
                conversationsFiltrees.map((conversation) => (
                  <button
                    type="button"
                    key={conversation.accountId}
                    className={
                      'conversation' +
                      (conversation.accountId === compteSelectionne ? ' conversation--active' : '') +
                      (conversation.nonLus > 0 ? ' conversation--nouvelle' : '')
                    }
                    onClick={() => selectionner(conversation.accountId)}
                    aria-current={conversation.accountId === compteSelectionne}
                  >
                    <span
                      className={
                        'conversation__avatar' +
                        (conversation.donorOrigin === 'INTERNATIONAL'
                          ? ' conversation__avatar--international'
                          : '')
                      }
                      aria-hidden="true"
                    >
                      {fmt.initiales(conversation.donorName)}
                    </span>

                    <span className="conversation__corps">
                      <span className="conversation__ligne">
                        <span className="conversation__nom">{conversation.donorName}</span>
                        <span className="conversation__temps">
                          {fmt.depuis(conversation.derniereActivite)}
                        </span>
                      </span>
                      <span className="conversation__extrait">
                        {conversation.dernier.reply
                          ? `Vous : ${conversation.dernier.reply}`
                          : conversation.dernier.subject}
                      </span>
                      <span className="conversation__ligne">
                        <span className="conversation__courriel">{conversation.accountEmail}</span>
                        {conversation.nonLus > 0 && (
                          <span className="conversation__pastille">{conversation.nonLus}</span>
                        )}
                      </span>
                    </span>
                  </button>
                ))
              )}
            </div>
          </section>

          {/* ================= Échange ================= */}
          <section className="messagerie__volet">
            {!active ? (
              <div className="echange__vide">
                {conversations.length === 0
                  ? 'La conversation s’affichera ici dès qu’un donateur aura écrit.'
                  : 'Sélectionnez une conversation dans la liste.'}
              </div>
            ) : (
              <>
                <header className="echange__entete">
                  <div className="echange__identite">
                    <span
                      className={
                        'conversation__avatar' +
                        (active.donorOrigin === 'INTERNATIONAL'
                          ? ' conversation__avatar--international'
                          : '')
                      }
                      aria-hidden="true"
                    >
                      {fmt.initiales(active.donorName)}
                    </span>
                    <div style={{ minWidth: 0 }}>
                      <p className="echange__nom">{active.donorName}</p>
                      <p className="echange__courriel">
                        {active.accountEmail} · {fmt.nombre(active.donationsCount)} don(s) ·{' '}
                        {libelles.donorOrigin?.[active.donorOrigin] ?? active.donorOrigin}
                      </p>
                    </div>
                  </div>

                  <Badge
                    valeur={active.dernier.status}
                    libelles={libelles.messageStatus}
                    couleur={
                      active.dernier.status === 'NEW'
                        ? 'ambre'
                        : active.dernier.status === 'ANSWERED'
                          ? 'vert'
                          : 'bleu'
                    }
                  />
                </header>

                <div className="echange__fil">
                  {active.messages.length === 0 ? (
                    <div className="echange__vide">Aucun message dans cette conversation</div>
                  ) : (
                    active.messages.map((message) => (
                      <div key={message.id}>
                        <Bulle
                          sens="recue"
                          sujet={message.subject}
                          contenu={message.body}
                          horodatage={message.createdAt}
                          legende={active.donorName}
                        />
                        {message.reply && (
                          <Bulle
                            sens="envoyee"
                            contenu={message.reply}
                            horodatage={message.repliedAt}
                            legende="HOPE"
                          />
                        )}
                      </div>
                    ))
                  )}
                </div>

                <form className="reponse" onSubmit={envoyerReponse}>
                  <textarea
                    value={brouillon}
                    onChange={(e) => setBrouillon(e.target.value)}
                    placeholder="Écrire une réponse…"
                    disabled={envoi}
                    aria-label="Votre réponse"
                    rows={2}
                  />
                  <button
                    type="submit"
                    className="btn btn--principal"
                    disabled={envoi || brouillon.trim() === ''}
                  >
                    {envoi ? 'Envoi…' : 'Envoyer'}
                  </button>
                </form>

                {active.dernier.reply && (
                  <p className="reponse__aide">
                    Ce message a déjà reçu une réponse le {fmt.date(active.dernier.repliedAt)} :
                    envoyer remplacera la réponse précédente.
                  </p>
                )}
              </>
            )}
          </section>
        </div>
      )}

      <NouveauMessageModale
        ouverte={modaleOuverte}
        comptes={comptes?.items ?? []}
        onFermer={() => setModaleOuverte(false)}
        onEnregistre={() => {
          setModaleOuverte(false);
          recharger();
          rafraichirCompteurs?.();
        }}
      />
    </>
  );
}
