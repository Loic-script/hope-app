import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { LIEN_DON } from '../../components/vitrine/liens.js';

/**
 * La fiche publique d'un projet de HOPE (GET /api/public/projets/:id) :
 * sa photo, son nom, son lieu et son domaine, sa description et, s'il
 * est termine, ce qu'il a permis. Rien de l'argent ni des personnes.
 */

const MOIS = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' });

const ETATS = {
  COMPLETED: { classe: 'realise', libelle: 'Réalisé' },
  IN_PROGRESS: { classe: 'en-cours', libelle: 'En cours' },
};

/** "mars 2026" ; une date nue (AAAA-MM-JJ) est lue a midi pour ne pas changer de jour. */
function moisLisible(valeur) {
  if (!valeur) return null;
  const texte = String(valeur);
  const date = /^\d{4}-\d{2}-\d{2}$/.test(texte) ? new Date(`${texte}T12:00:00`) : new Date(texte);
  return Number.isNaN(date.getTime()) ? null : MOIS.format(date);
}

/** Un texte libre, un paragraphe par ligne vide (ou par retour a la ligne). */
function Paragraphes({ texte }) {
  return texte
    .split(/\r?\n+/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p, i) => <p key={i}>{p}</p>);
}

function Message({ titre, texte }) {
  return (
    <section className="realisation__message" aria-labelledby="realisation-message-titre">
      <h1 id="realisation-message-titre">{titre}</h1>
      <p>{texte}</p>
      <Link to="/nos-realisations" className="v-bouton-contour">
        Toutes nos réalisations
      </Link>
    </section>
  );
}

export default function Realisation() {
  const { id } = useParams();
  const [etat, setEtat] = useState({ statut: 'chargement' });

  useEffect(() => {
    const controle = new AbortController();
    setEtat({ statut: 'chargement' });
    fetch(`/api/public/projets/${encodeURIComponent(id)}`, { signal: controle.signal })
      .then(async (r) => {
        if (r.status === 404) return setEtat({ statut: 'introuvable' });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        setEtat({ statut: 'pret', projet: await r.json() });
      })
      .catch((e) => {
        if (e.name !== 'AbortError') setEtat({ statut: 'erreur' });
      });
    return () => controle.abort();
  }, [id]);

  if (etat.statut === 'chargement') {
    return <p className="realisation__attente">Chargement du projet…</p>;
  }
  if (etat.statut === 'introuvable') {
    return <Message titre="Projet introuvable" texte="Ce projet n’existe pas ou n’est plus présenté sur le site." />;
  }
  if (etat.statut === 'erreur') {
    return <Message titre="Un instant…" texte="Le projet ne se charge pas pour le moment. Réessayez dans quelques instants." />;
  }

  const { projet } = etat;
  const marque = ETATS[projet.status];
  const debut = moisLisible(projet.startDate);
  const fin = moisLisible(projet.completedAt);
  const periode = fin ? `Achevé en ${fin}` : debut ? `Depuis ${debut}` : null;
  const surTitre = [projet.categorie, projet.location].filter(Boolean).join(' · ');

  return (
    <article className="realisation">
      <header className={`realisation-hero${projet.photoUrl ? '' : ' realisation-hero--sans-photo'}`}>
        {projet.photoUrl && <img className="realisation-hero__photo" src={projet.photoUrl} alt="" fetchPriority="high" />}
        <div className="realisation-hero__voile" aria-hidden="true" />
        <div className="v-conteneur realisation-hero__contenu">
          <Link to="/nos-realisations" className="realisation__retour">
            <span aria-hidden="true">←</span> Toutes nos réalisations
          </Link>
          {surTitre && <p className="realisation-hero__sur-titre">{surTitre}</p>}
          <h1 className="realisation-hero__titre">{projet.name}</h1>
          {(marque || periode) && (
            <p className="realisation-hero__etat">
              {marque && (
                <span className={`realisations-carte__etat realisations-carte__etat--${marque.classe}`}>{marque.libelle}</span>
              )}
              {periode && <span>{periode}</span>}
            </p>
          )}
        </div>
      </header>

      <div className="v-realisations realisation__fond">
        <div className="v-conteneur realisation__corps">
          <div className="realisation__texte">
            {projet.descriptionTitre && <h2 className="realisation__sous-titre">{projet.descriptionTitre}</h2>}
            {projet.description ? (
              <Paragraphes texte={projet.description} />
            ) : (
              <p>La présentation de ce projet arrive bientôt.</p>
            )}
            {projet.outcome && projet.status === 'COMPLETED' && (
              <>
                <h2 className="realisation__sous-titre">Ce que le projet a permis</h2>
                <Paragraphes texte={projet.outcome} />
              </>
            )}
          </div>

          <aside className="realisation__aparte" aria-label="Le projet en bref">
            <dl className="realisation__fiche">
              {projet.categorie && (
                <>
                  <dt>Domaine</dt>
                  <dd>{projet.categorie}</dd>
                </>
              )}
              {projet.location && (
                <>
                  <dt>Lieu</dt>
                  <dd>{projet.location}</dd>
                </>
              )}
              {debut && (
                <>
                  <dt>Début</dt>
                  <dd>{debut}</dd>
                </>
              )}
              {fin && (
                <>
                  <dt>Achevé</dt>
                  <dd>{fin}</dd>
                </>
              )}
              {marque && (
                <>
                  <dt>État</dt>
                  <dd>{marque.libelle}</dd>
                </>
              )}
            </dl>
            <p className="realisation__appel">Chaque don fait avancer des projets comme celui-ci.</p>
            <Link to={LIEN_DON} className="accueil-bouton accueil-bouton--orange realisation__don">
              Faire un don
            </Link>
          </aside>
        </div>
      </div>
    </article>
  );
}
