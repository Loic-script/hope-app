import { useState } from 'react';
import { Link } from 'react-router-dom';

import { IconeCoeur, IconeRecherche, IconeSoleil } from '../../components/HopeIcons.jsx';
import { useChargement } from '../../hooks/useChargement.js';
import { urlMedia } from '../../services/api.js';
import * as service from '../../services/donateur.service.js';
import * as fmt from '../../utils/format.js';
import { normaliser } from '../../components/ChoixSurPage.jsx';

export default function Projets() {
  const { donnees, chargement, erreur } = useChargement(() => service.listerProjets(), []);
  const [recherche, setRecherche] = useState('');

  const projets = donnees?.items ?? [];
  const cle = normaliser(recherche.trim());
  const affiches = cle
    ? projets.filter((p) => normaliser(`${p.nom} ${p.lieu} ${p.categorie}`).includes(cle))
    : projets;

  return (
    <div className="espace-donateur">
      <header className="don-entete don-entete--action">
        <div>
          <p className="surtitre">
            <span className="trait-hope surtitre__trait" aria-hidden="true" />
            Projets
          </p>
          <h1 className="don-entete__titre">Les projets à soutenir</h1>
          <p className="don-entete__accroche">
            Ce que HOPE mène à Madagascar, et ce qu’il manque à chacun. Choisissez celui qui vous
            parle.
          </p>
        </div>
        <label className="don-recherche">
          <IconeRecherche />
          <input
            type="search"
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            placeholder="Un projet, un lieu, un domaine…"
            aria-label="Rechercher un projet"
          />
        </label>
      </header>

      {erreur && <p className="don-refus">{erreur}</p>}

      {chargement && !donnees ? (
        <p className="don-vide">Chargement des projets…</p>
      ) : affiches.length === 0 ? (
        <p className="don-vide">
          {cle ? 'Aucun projet ne correspond à votre recherche.' : 'Aucun projet ouvert aux dons pour l’instant.'}
        </p>
      ) : (
        <ul className="don-grille">
          {affiches.map((projet, rang) => (
            <li key={projet.id} className="don-carte-projet" style={{ '--rang': Math.min(rang, 8) }}>
              <Link className="don-carte-projet__image" to={`/donateur/projets/${projet.id}`} tabIndex={-1} aria-hidden="true">
                {projet.image ? <img src={urlMedia(projet.image)} alt="" loading="lazy" /> : <IconeSoleil />}
                {projet.categorie && <span className="don-carte-projet__categorie">{projet.categorie}</span>}
              </Link>
              <div className="don-carte-projet__corps">
                <h2 className="don-carte-projet__nom">
                  <Link to={`/donateur/projets/${projet.id}`}>{projet.nom}</Link>
                </h2>
                {projet.lieu && <p className="don-carte-projet__lieu">{projet.lieu}</p>}
                {projet.accroche && <p className="don-carte-projet__accroche">{projet.accroche}</p>}

                <div
                  className="don-carte-projet__rail"
                  role="progressbar"
                  aria-valuenow={Math.round(Math.min(100, Number(projet.taux) || 0))}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`Financement de ${projet.nom}`}
                >
                  <span style={{ '--taux': `${Math.min(100, Number(projet.taux) || 0)}%` }} />
                </div>
                <p className="don-carte-projet__chiffres">
                  <strong>{fmt.montant(projet.collecte, projet.devise)}</strong> sur{' '}
                  {fmt.montant(projet.objectif, projet.devise)}
                  <span>{fmt.pourcent(projet.taux)}</span>
                </p>

                <div className="don-carte-projet__actions">
                  {projet.atteint ? (
                    <span className="don-carte-projet__atteint">Objectif atteint, merci !</span>
                  ) : (
                    <Link className="don-cta don-cta--plein don-cta--petit" to={`/donateur/faire-un-don?projet=${projet.id}`}>
                      <IconeCoeur />
                      Soutenir
                    </Link>
                  )}
                  <Link className="don-lien" to={`/donateur/projets/${projet.id}`}>
                    Voir le projet
                  </Link>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
