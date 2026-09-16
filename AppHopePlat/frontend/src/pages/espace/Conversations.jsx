import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useOutletContext, useParams } from 'react-router-dom';

import {
  IconeChevronGauche,
  IconePlus,
  IconeRecherche,
} from '../../components/admin/AdminIcons.jsx';
import { PhotoAgrandissable } from '../../components/VisionneuseImage.jsx';
import { urlMedia } from '../../services/api.js';
import * as service from '../../services/conversation.service.js';
import * as fmt from '../../utils/format.js';

/**
 * La messagerie, commune a tous les espaces.
 *
 * Tout le monde ecrit a tout le monde : benevole, bailleur, donateur,
 * equipe. L'ecran ne connait pas les roles -- il affiche une liste de
 * conversations et un fil, et c'est le jeton porte par le client axios
 * qui dit qui parle.
 *
 * Le meme composant sert les trois espaces : ce qui change tient dans
 * deux proprietes du contexte, le client et la racine de l'API.
 */

/** Libelle du role, tel qu'il s'affiche a cote d'un nom. */
const ROLES = {
  benevole: 'Bénévole',
  bailleur: 'Bailleur',
  donateur: 'Donateur',
  equipe: 'Équipe HOPE',
  utilisateur: 'Membre',
};

export default function Conversations() {
  const {
    api,
    racineConversations: racine,
    cheminMessages,
    // Le titre suit l'entree du menu de chaque espace : "Conversations"
    // pour l'equipe et les benevoles, "Messages" pour les bailleurs. Un
    // menu et un titre qui ne disent pas la meme chose font douter
    // d'etre au bon endroit.
    titreMessagerie = 'Messages',
    rafraichirCompteurs,
  } = useOutletContext();

  /*
   * La conversation ouverte est dans l'adresse, pas dans un etat local.
   *
   * Elle a donc sa propre page : sur un telephone, la boite et le fil
   * ne se disputent plus le meme ecran, le lien se partage, et le
   * bouton Retour du navigateur ramene a la liste au lieu de quitter
   * la messagerie.
   */
  const { id: idUrl } = useParams();
  const navigate = useNavigate();
  const actif = idUrl ? Number(idUrl) : null;

  const [fils, setFils] = useState([]);
  // Qui je suis, dit par le serveur : lui seul le sait de facon sure.
  const [moi, setMoi] = useState(null);
  const [ouvert, setOuvert] = useState(null);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState(null);
  const [recherche, setRecherche] = useState('');

  const [brouillon, setBrouillon] = useState('');
  const [envoi, setEnvoi] = useState(false);

  // L'annuaire : ouvert par le "+", ferme des qu'on a choisi.
  const [annuaireOuvert, setAnnuaireOuvert] = useState(false);
  const [annuaire, setAnnuaire] = useState([]);
  const [filtreAnnuaire, setFiltreAnnuaire] = useState('');

  const charger = useCallback(async () => {
    try {
      const { moi: identite, items: liste } = await service.lister(api, racine);
      setMoi(identite);
      setFils(liste);
      setErreur(null);
      rafraichirCompteurs?.();
    } catch (e) {
      setErreur(e.response?.data?.message ?? 'Impossible de charger vos conversations.');
    } finally {
      setChargement(false);
    }
  }, [api, racine, rafraichirCompteurs]);

  useEffect(() => {
    charger();
  }, [charger]);

  // Le fil ouvert est recharge a chaque changement de selection.
  useEffect(() => {
    if (!actif) {
      setOuvert(null);
      return;
    }
    let annule = false;
    service
      .recuperer(api, racine, actif)
      .then((donnees) => {
        if (annule) return;
        setOuvert(donnees);
        // L'ouverture vaut lecture : la pastille du menu doit suivre.
        rafraichirCompteurs?.();
        setFils((liste) => liste.map((c) => (c.id === actif ? { ...c, nonLus: 0 } : c)));
      })
      .catch(() => {
        if (!annule) setErreur('Cette conversation est introuvable.');
      });
    return () => {
      annule = true;
    };
  }, [actif, api, racine, rafraichirCompteurs]);

  async function envoyer(evenement) {
    evenement.preventDefault();
    if (brouillon.trim() === '') return;
    setEnvoi(true);
    try {
      await service.ecrire(api, racine, actif, brouillon);
      setBrouillon('');
      const donnees = await service.recuperer(api, racine, actif);
      setOuvert(donnees);
      charger();
    } catch (e) {
      setErreur(e.response?.data?.message ?? 'L’envoi a échoué.');
    } finally {
      setEnvoi(false);
    }
  }

  /**
   * Entree envoie, Maj+Entree passe a la ligne.
   *
   * C'est la convention de toutes les messageries, et le champ fait
   * deux lignes : personne ne va chercher le bouton pour une reponse
   * de trois mots.
   *
   * isComposing protege les saisies a composition -- accents composes,
   * claviers asiatiques -- dont la validation passe aussi par Entree :
   * sans ce garde-fou, le message partirait au milieu d'un mot.
   */
  function surTouche(evenement) {
    if (
      evenement.key === 'Enter' &&
      !evenement.shiftKey &&
      !evenement.nativeEvent.isComposing
    ) {
      envoyer(evenement);
    }
  }

  async function ouvrirAnnuaire() {
    setAnnuaireOuvert(true);
    setFiltreAnnuaire('');
    try {
      setAnnuaire(await service.annuaire(api, racine));
    } catch {
      setErreur('L’annuaire n’a pas pu être chargé.');
    }
  }

  async function commencerAvec(personne) {
    try {
      const id = await service.ouvrir(api, racine, { type: personne.type, id: personne.id });
      setAnnuaireOuvert(false);
      await charger();
      navigate(`${cheminMessages}/${id}`);
    } catch (e) {
      setErreur(e.response?.data?.message ?? 'La conversation n’a pas pu être ouverte.');
    }
  }

  const filsFiltres = useMemo(() => {
    const terme = recherche.trim().toLowerCase();
    if (terme === '') return fils;
    return fils.filter((c) =>
      autres(c, moi).some((p) => p.nom?.toLowerCase().includes(terme)) ||
      (c.dernier?.corps ?? '').toLowerCase().includes(terme)
    );
  }, [fils, recherche, moi]);

  const annuaireFiltre = useMemo(() => {
    const terme = filtreAnnuaire.trim().toLowerCase();
    if (terme === '') return annuaire;
    return annuaire.filter((p) => p.nom?.toLowerCase().includes(terme));
  }, [annuaire, filtreAnnuaire]);

  const conversation = ouvert?.conversation ?? null;
  const interlocuteurs = conversation ? autres(conversation, moi) : [];

  return (
    <>
      {/* Sur telephone, un fil ouvert prend la page : le grand titre
          cede ses 150 px au chat, et l'entete du fil dit deja a qui
          l'on parle. Au-dela, le titre reste -- la place ne manque pas. */}
      <header
        className={`page-benevole__entete${
          actif ? ' page-benevole__entete--fil-ouvert' : ''
        }`}
      >
        <p className="surtitre">
          <span className="trait-hope surtitre__trait" aria-hidden="true" />
          Se parler
        </p>
        <h1 className="page-benevole__titre">{titreMessagerie}</h1>
        <p className="page-benevole__accroche">
          Écrivez à l’équipe, à un bénévole, à un partenaire : tout le monde se joint ici.
        </p>
      </header>

      {erreur && <p className="alerte-benevole">{erreur}</p>}

      {/* Sur un telephone, un seul volet a la fois : c'est cette classe
          qui dit lequel. Au-dela, les deux restent cote a cote. */}
      <div className={`messagerie${actif || annuaireOuvert ? ' messagerie--fil-ouvert' : ''}`}>
        {/* ================= Les conversations ================= */}
        <section className="messagerie__volet messagerie__volet--liste">
          <div className="conversations__entete">
            <div>
              <p className="conversations__titre">Conversations</p>
              <p className="conversations__compte">
                {fils.length === 0 ? 'Aucune pour l’instant' : `${fils.length} conversation(s)`}
              </p>
            </div>
            <button
              type="button"
              className="btn btn--principal btn--petit"
              onClick={ouvrirAnnuaire}
            >
              <IconePlus />
              Nouvelle
            </button>
          </div>

          <div className="conversations__outils">
            <span className="conversations__loupe" aria-hidden="true">
              <IconeRecherche />
            </span>
            <input
              type="search"
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
              placeholder="Rechercher une personne, un message…"
              aria-label="Rechercher dans les conversations"
            />
          </div>

          <div className="conversations__liste">
            {chargement ? (
              <div className="echange__vide">Chargement…</div>
            ) : filsFiltres.length === 0 ? (
              <div className="etat-vide">
                <p className="etat-vide__titre">
                  {fils.length === 0 ? 'Aucune conversation' : 'Aucun résultat'}
                </p>
                <p className="etat-vide__texte">
                  {fils.length === 0
                    ? 'Le bouton « Nouvelle » ouvre l’annuaire de la plateforme.'
                    : `Rien ne correspond à « ${recherche} ».`}
                </p>
              </div>
            ) : (
              filsFiltres.map((fil) => {
                const gens = autres(fil, moi);
                return (
                  <button
                    type="button"
                    key={fil.id}
                    className={
                      'conversation' +
                      (fil.id === actif ? ' conversation--active' : '') +
                      (fil.nonLus > 0 ? ' conversation--nouvelle' : '')
                    }
                    onClick={() => navigate(`${cheminMessages}/${fil.id}`)}
                    aria-current={fil.id === actif}
                  >
                    <Pastille personne={gens[0]} />
                    <span className="conversation__corps">
                      <span className="conversation__ligne">
                        <span className="conversation__nom">{nommer(gens)}</span>
                        <span className="conversation__temps">
                          {fmt.depuis(fil.dernier?.creeLe ?? fil.majLe)}
                        </span>
                      </span>
                      <span className="conversation__extrait">
                        {fil.dernier?.estDeMoi ? 'Vous : ' : ''}
                        {fil.dernier?.corps ?? (fil.sujet ?? 'Conversation ouverte')}
                      </span>
                      <span className="conversation__ligne">
                        <span className="conversation__courriel">
                          {ROLES[gens[0]?.role] ?? 'Membre'}
                        </span>
                        {fil.nonLus > 0 && (
                          <span className="conversation__pastille">{fil.nonLus}</span>
                        )}
                      </span>
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </section>

        {/* ================= Le fil, ou l'annuaire ================= */}
        <section className="messagerie__volet messagerie__volet--fil">
          {annuaireOuvert ? (
            <>
              <header className="echange__entete">
                <div className="echange__identite">
                  <div style={{ minWidth: 0 }}>
                    <p className="echange__nom">À qui voulez-vous écrire ?</p>
                    <p className="echange__courriel">
                      Tout le monde sur la plateforme : équipe, bénévoles, partenaires.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  className="btn btn--neutre btn--petit"
                  onClick={() => setAnnuaireOuvert(false)}
                >
                  Annuler
                </button>
              </header>

              <div className="conversations__outils">
                <span className="conversations__loupe" aria-hidden="true">
                  <IconeRecherche />
                </span>
                <input
                  type="search"
                  value={filtreAnnuaire}
                  onChange={(e) => setFiltreAnnuaire(e.target.value)}
                  placeholder="Chercher un nom…"
                  aria-label="Chercher une personne"
                />
              </div>

              <div className="conversations__liste">
                {annuaireFiltre.map((personne) => (
                  <button
                    type="button"
                    key={`${personne.type}-${personne.id}`}
                    className="conversation"
                    onClick={() => commencerAvec(personne)}
                  >
                    <Pastille personne={personne} />
                    <span className="conversation__corps">
                      <span className="conversation__ligne">
                        <span className="conversation__nom">{personne.nom}</span>
                      </span>
                      <span className="conversation__courriel">
                        {ROLES[personne.role] ?? 'Membre'}
                        {personne.email ? ` · ${personne.email}` : ''}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            </>
          ) : !conversation ? (
            <div className="echange__vide">
              {fils.length === 0
                ? 'Ouvrez une conversation : elle s’affichera ici.'
                : 'Sélectionnez une conversation dans la liste.'}
            </div>
          ) : (
            <>
              <header className="echange__entete">
                <div className="echange__identite">
                  {/* Le retour a la boite. Il ne parait que sur
                      telephone : ailleurs la liste est deja a gauche,
                      et un bouton de retour n'y mene nulle part. */}
                  <Link
                    to={cheminMessages}
                    className="echange__retour"
                    aria-label="Retour aux conversations"
                  >
                    <IconeChevronGauche />
                  </Link>
                  <Pastille personne={interlocuteurs[0]} agrandissable />
                  <div style={{ minWidth: 0 }}>
                    <p className="echange__nom">{nommer(interlocuteurs)}</p>
                    <p className="echange__courriel">
                      {ROLES[interlocuteurs[0]?.role] ?? 'Membre'}
                      {conversation.sujet ? ` · ${conversation.sujet}` : ''}
                    </p>
                  </div>
                </div>
              </header>

              <div className="echange__fil">
                {ouvert.messages.length === 0 ? (
                  <div className="echange__vide">
                    Rien encore. Écrivez le premier message.
                  </div>
                ) : (
                  ouvert.messages.map((message, rang) => {
                    const mien = estDeMoi(message, moi);
                    // Dans une salve du meme auteur, la photo ne se
                    // repete pas : elle ne marque que le dernier
                    // message, et les precedents gardent sa place en
                    // creux pour rester alignes.
                    const suivant = ouvert.messages[rang + 1];
                    const finDeSalve =
                      !suivant ||
                      suivant.auteurType !== message.auteurType ||
                      String(suivant.auteurId) !== String(message.auteurId);

                    return (
                      <div
                        key={message.id}
                        className={`bulle-rang bulle-rang--${mien ? 'envoyee' : 'recue'}`}
                      >
                        {!mien && (
                          <PastilleBulle
                            message={message}
                            visible={finDeSalve}
                          />
                        )}
                        <article className={`bulle bulle--${mien ? 'envoyee' : 'recue'}`}>
                          <div className="bulle__contenu">{message.corps}</div>
                          <p className="bulle__meta">
                            {message.auteurNom} · {fmt.depuis(message.creeLe)}
                          </p>
                        </article>
                      </div>
                    );
                  })
                )}
              </div>

              <form className="reponse" onSubmit={envoyer}>
                <textarea
                  value={brouillon}
                  onChange={(e) => setBrouillon(e.target.value)}
                  onKeyDown={surTouche}
                  placeholder="Écrire un message…"
                  disabled={envoi}
                  aria-label="Votre message"
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
            </>
          )}
        </section>
      </div>
    </>
  );
}

/**
 * La pastille d'une personne : sa photo, ou ses initiales a defaut.
 *
 * "agrandissable" n'est pas toujours possible : dans la liste, la
 * pastille est deja au creux d'un bouton, et un bouton dans un bouton
 * n'est pas du HTML valide. On ne l'ouvre donc qu'en tete de fil.
 */
function Pastille({ personne, agrandissable = false }) {
  if (!personne) return <span className="conversation__avatar" aria-hidden="true" />;

  if (personne.photoUrl && agrandissable) {
    return (
      <span className="conversation__avatar">
        <PhotoAgrandissable
          src={urlMedia(personne.photoUrl)}
          alt={personne.nom ?? ''}
          className="photo-voir--pastille"
        />
      </span>
    );
  }

  return (
    <span className="conversation__avatar" aria-hidden="true">
      {personne.photoUrl ? (
        <img src={urlMedia(personne.photoUrl)} alt="" />
      ) : (
        fmt.initiales(personne.nom)
      )}
    </span>
  );
}

/**
 * La photo de l'auteur, a cote de sa bulle.
 *
 * "visible" a faux garde la place sans rien montrer : sans ce creux,
 * les bulles d'une meme salve se decaleraient les unes par rapport aux
 * autres.
 */
function PastilleBulle({ message, visible }) {
  if (!visible) return <span className="bulle__avatar bulle__avatar--creux" aria-hidden="true" />;

  return (
    <span className="bulle__avatar">
      {message.auteurPhoto ? (
        <PhotoAgrandissable
          src={urlMedia(message.auteurPhoto)}
          alt={message.auteurNom ?? ''}
          className="photo-voir--pastille"
        />
      ) : (
        <span aria-hidden="true">{fmt.initiales(message.auteurNom)}</span>
      )}
    </span>
  );
}

/** Les autres participants : tous, sauf moi. */
function autres(fil, moi) {
  const gens = fil.participants ?? [];
  if (!moi) return gens;
  return gens.filter((p) => !(p.type === moi.type && String(p.id) === String(moi.id)));
}

/** Le nom affiche : celui d'en face, ou la liste quand ils sont plusieurs. */
function nommer(gens) {
  if (gens.length === 0) return 'Conversation';
  return gens.map((p) => p.nom).join(', ');
}

/** Un message est-il de moi ? */
function estDeMoi(message, moi) {
  return Boolean(moi) && message.auteurType === moi.type && String(message.auteurId) === String(moi.id);
}
