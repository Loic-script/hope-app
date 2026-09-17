import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

import { urlMedia } from '../../services/api.js';
import * as service from '../../services/messagerie.service.js';
import Avatar from './Avatar.jsx';
import { heureRelative, normaliser, poids } from './outils.js';
import { lienEntreprise, lienProfil } from './profil.js';
import { Surlignage } from './TexteMessage.jsx';

/**
 * Le panneau d'information d'un fil : lateral sur ordinateur, plein ecran
 * sur telephone.
 *
 * - l'identite et les coordonnees de la personne -- ou de l'equipe ;
 * - pour un groupe, ses participants ;
 * - la recherche dans la conversation ;
 * - les fichiers partages.
 *
 * @param {{ api: object, racine: string, conversation: object,
 *           messages: object[], equipe: object|null, espace: string,
 *           pleinEcran: boolean, onFermer: () => void,
 *           onAllerAuMessage: (id: number) => void,
 *           actionsGroupe?: React.ReactNode }} props
 */
export default function PanneauInfo({
  api, racine, conversation, messages, equipe, espace, pleinEcran, onFermer, onAllerAuMessage, actionsGroupe,
}) {
  const [recherche, setRecherche] = useState('');
  const [fichiers, setFichiers] = useState(null);
  const titre = useRef(null);

  // Le focus entre dans le panneau a l'ouverture.
  useEffect(() => {
    titre.current?.focus();
  }, []);

  // Echap referme.
  useEffect(() => {
    const surTouche = (evenement) => {
      if (evenement.key === 'Escape' && !document.querySelector('dialog[open]')) onFermer();
    };
    document.addEventListener('keydown', surTouche);
    return () => document.removeEventListener('keydown', surTouche);
  }, [onFermer]);

  // Les fichiers partages : relus a chaque ouverture, et quand le fil change.
  useEffect(() => {
    let annule = false;
    service
      .fichiers(api, racine, conversation.id)
      .then((items) => !annule && setFichiers(items))
      .catch(() => !annule && setFichiers([]));
    return () => {
      annule = true;
    };
  }, [api, racine, conversation.id, messages.length]);

  const groupe = conversation.type === 'groupe';
  const personne = !groupe && !conversation.equipe
    ? conversation.participants.find((p) => p.type === conversation.interlocuteur?.type && p.id === conversation.interlocuteur?.id)
    : null;

  /*
   * Recherche dans la conversation : sur le texte, l'auteur et les noms de
   * fichiers, sans accents. Un message supprime n'a plus rien a trouver.
   */
  const resultats = useMemo(() => {
    const terme = normaliser(recherche);
    if (terme === '') return [];
    return messages
      .filter((message) => !message.supprime)
      .filter((message) =>
        [message.texte, message.auteur.nom, ...message.pieces.map((piece) => piece.nom)].some((texte) =>
          normaliser(texte).includes(terme)
        )
      )
      .reverse();
  }, [messages, recherche]);

  return (
    <aside
      className={`msg-panneau${pleinEcran ? ' msg-panneau--plein-ecran' : ''}`}
      aria-label="Informations sur la conversation"
    >
      <header className="msg-panneau__entete">
        <h2 className="msg-panneau__titre" tabIndex={-1} ref={titre}>
          Informations
        </h2>
        <button type="button" className="msg-icone" onClick={onFermer} aria-label="Fermer les informations">
          <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="m6 6 12 12M18 6 6 18" />
          </svg>
        </button>
      </header>

      <div className="msg-panneau__defilement">
        {/* --- Identite --- */}
        <section className="msg-panneau__identite">
          <Avatar
            nom={conversation.nom}
            photoUrl={conversation.photoUrl}
            src={conversation.photoSrc}
            equipe={conversation.equipe}
            taille="grande"
          />
          <p className="msg-panneau__nom">{conversation.nom}</p>
          {conversation.sousTitre && <p className="msg-panneau__fonction">{conversation.sousTitre}</p>}
        </section>

        {/* --- Coordonnees --- */}
        {personne && <Coordonnees personne={personne} espace={espace} />}
        {conversation.equipe && equipe && <CoordonneesEquipe equipe={equipe} />}

        {/* --- Participants d'un groupe --- */}
        {groupe && (
          <section className="msg-panneau__section">
            <h3 className="msg-panneau__intertitre">
              {conversation.participants.length} participant{conversation.participants.length > 1 ? 's' : ''}
            </h3>
            <ul className="msg-participants">
              {conversation.participants.map((participant) => {
                const lien = lienProfil(participant, espace);
                const contenu = (
                  <>
                    <Avatar nom={participant.nom} photoUrl={participant.photoUrl} taille="petite" />
                    <span className="msg-participants__texte">
                      <span className="msg-participants__nom">
                        {participant.nom}
                        {participant.estMoi && <span className="msg-participants__vous"> · vous</span>}
                      </span>
                      <span className="msg-participants__fonction">
                        {[participant.fonction, participant.entreprise].filter(Boolean).join(' · ') || participant.sousTitre}
                      </span>
                    </span>
                  </>
                );
                return (
                  <li key={`${participant.type}:${participant.id}`}>
                    {lien ? (
                      <Link className="msg-participants__ligne" to={lien}>
                        {contenu}
                      </Link>
                    ) : (
                      <span className="msg-participants__ligne">{contenu}</span>
                    )}
                  </li>
                );
              })}
            </ul>
            {actionsGroupe}
          </section>
        )}

        {/* --- Recherche dans la conversation --- */}
        <section className="msg-panneau__section">
          <h3 className="msg-panneau__intertitre">Rechercher dans la conversation</h3>
          <label className="msg-recherche">
            <span className="sr-only">Rechercher un mot, un auteur ou un fichier</span>
            <input
              type="search"
              value={recherche}
              onChange={(evenement) => setRecherche(evenement.target.value)}
              placeholder="Un mot, un nom, un fichier…"
            />
          </label>
          {recherche.trim() !== '' && (
            <>
              <p className="msg-panneau__compte" role="status">
                {resultats.length === 0
                  ? 'Aucun message ne correspond.'
                  : `${resultats.length} message${resultats.length > 1 ? 's' : ''}`}
              </p>
              <ul className="msg-resultats">
                {resultats.map((message) => (
                  <li key={message.id}>
                    <button
                      type="button"
                      className="msg-resultats__ligne"
                      onClick={() => {
                        onAllerAuMessage(message.id);
                        if (pleinEcran) onFermer();
                      }}
                    >
                      <span className="msg-resultats__haut">
                        <span className="msg-resultats__auteur">
                          <Surlignage texte={message.auteur.nom} terme={recherche} />
                        </span>
                        <span className="msg-resultats__date">{heureRelative(message.creeLe)}</span>
                      </span>
                      {message.texte && (
                        <span className="msg-resultats__texte">
                          <Surlignage texte={extrait(message.texte, recherche)} terme={recherche} />
                        </span>
                      )}
                      {message.pieces.map((piece) => (
                        <span key={piece.id} className="msg-resultats__piece">
                          📎 <Surlignage texte={piece.nom} terme={recherche} />
                        </span>
                      ))}
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>

        {/* --- Fichiers partages --- */}
        <section className="msg-panneau__section">
          <h3 className="msg-panneau__intertitre">Fichiers partagés</h3>
          {fichiers === null ? (
            <p className="msg-panneau__compte">Chargement…</p>
          ) : fichiers.length === 0 ? (
            <p className="msg-panneau__compte">Aucun fichier dans cette conversation.</p>
          ) : (
            <ul className="msg-fichiers">
              {fichiers.map((fichier) => (
                <li key={fichier.id}>
                  <a className="msg-fichiers__ligne" href={urlMedia(fichier.url)} target="_blank" rel="noopener noreferrer">
                    <span className={`msg-fichiers__type msg-fichiers__type--${fichier.type}`} aria-hidden="true">
                      {fichier.type === 'image' ? (
                        <img src={urlMedia(fichier.url)} alt="" loading="lazy" />
                      ) : fichier.type === 'video' ? (
                        '▶'
                      ) : (
                        'PDF'
                      )}
                    </span>
                    <span className="msg-fichiers__texte">
                      <span className="msg-fichiers__nom">{fichier.nom}</span>
                      <span className="msg-fichiers__meta">
                        {poids(fichier.taille)} · {heureRelative(fichier.creeLe)}
                      </span>
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </aside>
  );
}

/** Les coordonnees d'une personne. */
function Coordonnees({ personne, espace }) {
  const profil = lienProfil(personne, espace);
  const entreprise = lienEntreprise(personne, espace);
  const site = personne.siteWeb ? (/^https?:\/\//i.test(personne.siteWeb) ? personne.siteWeb : `https://${personne.siteWeb}`) : null;

  const lignes = [
    personne.entreprise && {
      cle: 'entreprise',
      libelle: 'Organisation',
      valeur: entreprise ? <Link to={entreprise}>{personne.entreprise}</Link> : personne.entreprise,
    },
    personne.telephone && {
      cle: 'telephone',
      libelle: 'Téléphone',
      valeur: <a href={`tel:${personne.telephone.replace(/\s+/g, '')}`}>{personne.telephone}</a>,
    },
    personne.email && {
      cle: 'email',
      libelle: 'E-mail',
      valeur: <a href={`mailto:${personne.email}`}>{personne.email}</a>,
    },
    site && {
      cle: 'site',
      libelle: 'Site web',
      valeur: (
        <a href={site} target="_blank" rel="noopener noreferrer">
          {personne.siteWeb.replace(/^https?:\/\//i, '')}
        </a>
      ),
    },
  ].filter(Boolean);

  if (lignes.length === 0 && !profil) return null;

  return (
    <section className="msg-panneau__section">
      <h3 className="msg-panneau__intertitre">Coordonnées</h3>
      {lignes.length > 0 && (
        <dl className="msg-coordonnees">
          {lignes.map((ligne) => (
            <div key={ligne.cle} className="msg-coordonnees__ligne">
              <dt>{ligne.libelle}</dt>
              <dd>{ligne.valeur}</dd>
            </div>
          ))}
        </dl>
      )}
      {profil && (
        <Link className="btn btn--neutre msg-panneau__bouton" to={profil}>
          Voir le profil
        </Link>
      )}
    </section>
  );
}

/** Les coordonnees de l'equipe, dans un fil d'assistance. */
function CoordonneesEquipe({ equipe }) {
  const site = equipe.siteWeb ? (/^https?:\/\//i.test(equipe.siteWeb) ? equipe.siteWeb : `https://${equipe.siteWeb}`) : null;
  const lignes = [
    equipe.telephone && { cle: 'telephone', libelle: 'Téléphone', valeur: <a href={`tel:${equipe.telephone.replace(/\s+/g, '')}`}>{equipe.telephone}</a> },
    equipe.email && { cle: 'email', libelle: 'E-mail', valeur: <a href={`mailto:${equipe.email}`}>{equipe.email}</a> },
    site && { cle: 'site', libelle: 'Site web', valeur: <a href={site} target="_blank" rel="noopener noreferrer">{equipe.siteWeb.replace(/^https?:\/\//i, '')}</a> },
  ].filter(Boolean);

  return (
    <section className="msg-panneau__section">
      <h3 className="msg-panneau__intertitre">Coordonnées de l’équipe</h3>
      {lignes.length === 0 ? (
        <p className="msg-panneau__compte">L’équipe vous répond ici, dans cette conversation.</p>
      ) : (
        <dl className="msg-coordonnees">
          {lignes.map((ligne) => (
            <div key={ligne.cle} className="msg-coordonnees__ligne">
              <dt>{ligne.libelle}</dt>
              <dd>{ligne.valeur}</dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}

/** Un extrait centre sur le terme, pour un long message. */
function extrait(texte, terme, largeur = 90) {
  const propre = String(texte).replace(/\s+/g, ' ');
  if (propre.length <= largeur * 2) return propre;
  const position = normaliser(propre).indexOf(normaliser(terme));
  if (position < 0) return `${propre.slice(0, largeur * 2)}…`;
  const debut = Math.max(0, position - largeur);
  return `${debut > 0 ? '…' : ''}${propre.slice(debut, position + largeur)}…`;
}
