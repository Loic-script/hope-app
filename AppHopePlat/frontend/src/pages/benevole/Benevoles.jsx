import { useMemo, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';

import BoutonMessage from '../../components/messagerie/BoutonMessage.jsx';
import { useChargement } from '../../hooks/useChargement.js';
import { urlMedia } from '../../services/api.js';
import * as service from '../../services/espaceBenevole.service.js';
import { nomDuPays } from '../../utils/pays.js';

function normaliser(texte) {
  return String(texte ?? '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

function initiales(personne) {
  return `${personne.prenom?.[0] ?? ''}${personne.nom?.[0] ?? ''}`.toUpperCase() || '?';
}

export function Avatar({ personne, taille = 'moyen' }) {
  const photo = urlMedia(personne.photoUrl);
  return (
    <span className={`annuaire-avatar annuaire-avatar--${taille}`} aria-hidden="true">
      {photo ? <img src={photo} alt="" loading="lazy" /> : initiales(personne)}
    </span>
  );
}

const FILTRES = [
  { cle: 'tous', libelle: 'Tous' },
  { cle: 'terrain', libelle: 'Sur le terrain' },
  { cle: 'distance', libelle: 'À distance' },
];

export default function Benevoles() {
  const { api, racineConversations, cheminMessages } = useOutletContext();
  const { donnees, chargement, erreur } = useChargement(() => service.listerBenevoles(), []);
  const [recherche, setRecherche] = useState('');
  const [filtre, setFiltre] = useState('tous');
  const [refus, setRefus] = useState('');
  const benevoles = useMemo(() => donnees ?? [], [donnees]);

  const affiches = useMemo(() => {
    const mots = normaliser(recherche).split(/\s+/).filter(Boolean);
    return benevoles.filter((b) => {
      if (filtre === 'terrain' && !b.accepteTerrain) return false;
      if (filtre === 'distance' && !b.accepteDistance) return false;
      const texte = normaliser(
        [b.prenom, b.nom, b.profession, nomDuPays(b.pays), ...b.competences, ...b.langues].join(' ')
      );
      return mots.every((mot) => texte.includes(mot));
    });
  }, [benevoles, recherche, filtre]);

  return (
    <div className="accueil-benevole annuaire">
      <header>
        <p className="surtitre">
          <span className="trait-hope surtitre__trait" aria-hidden="true" />
          La communauté HOPE
        </p>
        <h1 className="accueil-benevole__titre">Les bénévoles</h1>
        <p className="accueil-benevole__accroche">
          {benevoles.length > 0
            ? `${benevoles.length} bénévole${benevoles.length > 1 ? 's' : ''} engagé${benevoles.length > 1 ? 's' : ''} à vos côtés. Découvrez leur profil et écrivez-leur pour travailler ensemble.`
            : 'Découvrez les autres bénévoles et écrivez-leur pour travailler ensemble.'}
        </p>
      </header>

      <div className="annuaire__outils">
        <label className="annuaire__recherche">
          <span className="sr-only">Rechercher un bénévole</span>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="11" cy="11" r="6.5" />
            <path d="M16 16l4.5 4.5" />
          </svg>
          <input
            type="search"
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            placeholder="Nom, métier, compétence, langue…"
          />
        </label>
        <div className="annuaire__filtres" role="group" aria-label="Filtrer les bénévoles">
          {FILTRES.map((f) => (
            <button
              key={f.cle}
              type="button"
              className={`annuaire__filtre${filtre === f.cle ? ' annuaire__filtre--actif' : ''}`}
              aria-pressed={filtre === f.cle}
              onClick={() => setFiltre(f.cle)}
            >
              {f.libelle}
            </button>
          ))}
        </div>
      </div>

      {erreur && <p className="alerte-benevole">{erreur}</p>}
      {refus && (
        <p className="alerte-benevole" role="alert">
          {refus}
        </p>
      )}

      {chargement && benevoles.length === 0 ? (
        <p className="bloc__vide">Chargement des bénévoles…</p>
      ) : affiches.length === 0 ? (
        <p className="bloc__vide">
          {benevoles.length === 0
            ? 'Vous êtes pour l’instant le seul bénévole actif.'
            : 'Aucun bénévole ne correspond à cette recherche.'}
        </p>
      ) : (
        <ul className="annuaire__grille">
          {affiches.map((b, rang) => (
            <li key={b.id} className="annuaire-carte" style={{ '--rang': Math.min(rang, 8) }}>
              <div className="annuaire-carte__haut">
                <Avatar personne={b} />
                <div className="annuaire-carte__identite">
                  <h2 className="annuaire-carte__nom">
                    <Link to={`/benevole/benevoles/${b.id}`} className="annuaire-carte__lien">
                      {b.prenom} {b.nom}
                    </Link>
                  </h2>
                  <p className="annuaire-carte__metier">{b.profession || 'Bénévole HOPE'}</p>
                  {b.pays && <p className="annuaire-carte__pays">{nomDuPays(b.pays)}</p>}
                </div>
              </div>

              {b.competences.length > 0 && (
                <ul className="annuaire-carte__puces" aria-label="Compétences">
                  {b.competences.slice(0, 3).map((c) => (
                    <li key={c}>{c}</li>
                  ))}
                  {b.competences.length > 3 && (
                    <li className="annuaire-carte__plus">+{b.competences.length - 3}</li>
                  )}
                </ul>
              )}

              <p className="annuaire-carte__chiffres">
                <span>
                  <strong>{b.tachesLivrees}</strong> tâche{b.tachesLivrees > 1 ? 's' : ''} livrée
                  {b.tachesLivrees > 1 ? 's' : ''}
                </span>
                <span>
                  <strong>{b.projets}</strong> projet{b.projets > 1 ? 's' : ''}
                </span>
              </p>

              <div className="annuaire-carte__actions">
                <Link to={`/benevole/benevoles/${b.id}`} className="annuaire-carte__profil">
                  Voir le profil
                </Link>
                <BoutonMessage
                  api={api}
                  racine={racineConversations}
                  cheminMessages={cheminMessages}
                  cible={{ personne: { type: 'utilisateur', id: b.id } }}
                  libelle="Écrire"
                  className="annuaire-carte__ecrire"
                  onErreur={setRefus}
                >
                  <IconeEnveloppe />
                </BoutonMessage>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function IconeEnveloppe() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="annuaire__icone">
      <rect x="3.5" y="5.5" width="17" height="13" rx="2.5" />
      <path d="M4.5 7.5l7.5 5.5 7.5-5.5" />
    </svg>
  );
}
