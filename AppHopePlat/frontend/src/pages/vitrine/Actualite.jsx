import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { MessageFiche, Paragraphes } from '../../components/vitrine/fiche.jsx';
import { LIEN_DON } from '../../components/vitrine/liens.js';
import { urlMedia } from '../../services/api.js';

const FORMAT_DATE = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });

export default function Actualite() {
  const { id } = useParams();
  const [etat, setEtat] = useState({ statut: 'chargement' });

  useEffect(() => {
    const controle = new AbortController();
    setEtat({ statut: 'chargement' });
    fetch(`/api/public/actualites/${encodeURIComponent(id)}`, { signal: controle.signal })
      .then(async (r) => {
        if (r.status === 404) return setEtat({ statut: 'introuvable' });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        setEtat({ statut: 'pret', actualite: await r.json() });
      })
      .catch((e) => {
        if (e.name !== 'AbortError') setEtat({ statut: 'erreur' });
      });
    return () => controle.abort();
  }, [id]);

  if (etat.statut === 'chargement') {
    return <p className="realisation__attente">Chargement de l’actualité…</p>;
  }
  if (etat.statut === 'introuvable') {
    return (
      <MessageFiche
        titre="Actualité introuvable"
        texte="Cette actualité n’existe pas ou n’est plus publiée."
        retour="/actualites"
        libelleRetour="Toutes nos actualités"
      />
    );
  }
  if (etat.statut === 'erreur') {
    return (
      <MessageFiche
        titre="Un instant…"
        texte="L’actualité ne se charge pas pour le moment. Réessayez dans quelques instants."
        retour="/actualites"
        libelleRetour="Toutes nos actualités"
      />
    );
  }

  const { actualite } = etat;
  const photo = urlMedia(actualite.photoUrl);
  const date = FORMAT_DATE.format(new Date(actualite.publieLe));

  return (
    <article className="realisation realisation--actualite">
      <header className={`realisation-hero${photo ? '' : ' realisation-hero--sans-photo'}`}>
        {photo && <img className="realisation-hero__photo" src={photo} alt="" fetchPriority="high" />}
        <div className="realisation-hero__voile" aria-hidden="true" />
        <div className="v-conteneur realisation-hero__contenu">
          <Link to="/actualites" className="realisation__retour">
            <span aria-hidden="true">←</span> Toutes nos actualités
          </Link>
          <p className="realisation-hero__sur-titre">
            Publié le <time dateTime={actualite.publieLe}>{date}</time>
            {actualite.projetNom && <> · {actualite.projetNom}</>}
          </p>
          <h1 className="realisation-hero__titre">{actualite.titre}</h1>
        </div>
      </header>

      <div className="v-realisations realisation__fond">
        <div className="v-conteneur realisation__corps">
          <div className="realisation__texte">
            {actualite.corps ? <Paragraphes texte={actualite.corps} /> : <p>Cette actualité tient en son titre.</p>}
          </div>

          <aside className="realisation__aparte" aria-label="L’actualité en bref">
            <dl className="realisation__fiche">
              <dt>Publié</dt>
              <dd>
                <time dateTime={actualite.publieLe}>{date}</time>
              </dd>
              {actualite.projetNom && (
                <>
                  <dt>Projet</dt>
                  <dd>
                    {actualite.projetId ? (
                      <Link to={`/nos-projets/${actualite.projetId}`} className="realisation__lien">
                        {actualite.projetNom}
                      </Link>
                    ) : (
                      actualite.projetNom
                    )}
                  </dd>
                </>
              )}
            </dl>
            <p className="realisation__appel">Soutenez les actions de HOPE sur le terrain.</p>
            <Link to={LIEN_DON} className="accueil-bouton accueil-bouton--orange realisation__don">
              Faire un don
            </Link>
          </aside>
        </div>
      </div>
    </article>
  );
}
