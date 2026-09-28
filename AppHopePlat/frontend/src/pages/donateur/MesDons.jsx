import { useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';

import {
  IconeCalendrierRenouvele,
  IconeCoeur,
  IconeHorloge,
  IconeMainsCoeur,
  IconeSoleil,
} from '../../components/HopeIcons.jsx';
import { useChargement } from '../../hooks/useChargement.js';
import { urlMedia } from '../../services/api.js';
import * as service from '../../services/donateur.service.js';
import * as fmt from '../../utils/format.js';
import { MontantAnime, NombreAnime, StatutDon, totalPrincipal } from './commun.jsx';

const FILTRES = [
  { cle: 'tous', label: 'Tous', garde: () => true },
  { cle: 'recus', label: 'Reçus', garde: (d) => d.statut === 'RECEIVED' },
  { cle: 'attente', label: 'En attente', garde: (d) => d.statut === 'PENDING' },
];

/**
 * Mes dons : ce que le donateur a donne, et ou en est chacun.
 *
 * En tete, ses chiffres -- ils montent a l'arrivee. Seuls les dons recus
 * comptent dans le total ; une promesse attend que l'equipe confirme la
 * reception, et se lit a part. Puis chaque don, sur une frise, du plus
 * recent au plus ancien : pour quoi, combien, quand, et son etat.
 */
export default function MesDons() {
  const { donateur } = useOutletContext();
  const { donnees, chargement, erreur } = useChargement(() => service.mesDons(), []);
  const [filtre, setFiltre] = useState('tous');

  const dons = donnees?.items ?? [];
  const synthese = donnees?.synthese;
  const principal = totalPrincipal(synthese);
  const autres = (synthese?.totaux ?? []).slice(1).filter((t) => Number(t.recu) > 0);
  const actif = FILTRES.find((f) => f.cle === filtre) ?? FILTRES[0];
  const affiches = dons.filter(actif.garde);

  return (
    <div className="espace-donateur">
      <header className="don-entete don-entete--action">
        <div>
          <p className="surtitre">
            <span className="trait-hope surtitre__trait" aria-hidden="true" />
            Mes dons
          </p>
          <h1 className="don-entete__titre">Ce que vous avez rendu possible</h1>
          <p className="don-entete__accroche">
            Chaque don, son état et sa destination. Un don est « reçu » dès que l’équipe HOPE a
            confirmé votre paiement.
          </p>
        </div>
        <Link className="don-cta don-cta--plein" to="/donateur/faire-un-don">
          <IconeCoeur />
          Faire un don
        </Link>
      </header>

      {erreur && <p className="don-refus">{erreur}</p>}

      {/* ---------- Les chiffres ---------- */}
      <ul className="don-stats">
        <li className="don-stat don-stat--violet" style={{ '--rang': 0 }}>
          <span className="don-stat__icone" aria-hidden="true">
            <IconeMainsCoeur />
          </span>
          <span className="don-stat__libelle">Total reçu</span>
          <strong className="don-stat__valeur">
            {principal ? <MontantAnime valeur={principal.recu} devise={principal.devise} /> : '—'}
          </strong>
          <span className="don-stat__note">
            {autres.length > 0
              ? `et ${autres.map((t) => fmt.montant(t.recu, t.devise)).join(', ')}`
              : `${synthese?.nombreRecus ?? 0} don${(synthese?.nombreRecus ?? 0) > 1 ? 's' : ''} reçu${(synthese?.nombreRecus ?? 0) > 1 ? 's' : ''}`}
          </span>
        </li>
        <li className="don-stat don-stat--orange" style={{ '--rang': 1 }}>
          <span className="don-stat__icone" aria-hidden="true">
            <IconeHorloge />
          </span>
          <span className="don-stat__libelle">En attente</span>
          <strong className="don-stat__valeur">
            <NombreAnime valeur={synthese ? synthese.nombreEnAttente : null} delai={120} />
          </strong>
        </li>
        <li className="don-stat don-stat--bleu" style={{ '--rang': 2 }}>
          <span className="don-stat__icone" aria-hidden="true">
            <IconeSoleil />
          </span>
          <span className="don-stat__libelle">Projets soutenus</span>
          <strong className="don-stat__valeur">
            <NombreAnime valeur={synthese ? synthese.projetsSoutenus : null} delai={240} />
          </strong>
          <span className="don-stat__note">
            <Link className="don-lien" to="/donateur/projets">
              Voir les projets
            </Link>
          </span>
        </li>
        <li className="don-stat don-stat--jaune" style={{ '--rang': 3 }}>
          <span className="don-stat__icone" aria-hidden="true">
            <IconeCalendrierRenouvele />
          </span>
          <span className="don-stat__libelle">Donateur depuis</span>
          <strong className="don-stat__valeur don-stat__valeur--date">
            {synthese?.premierDon
              ? fmt.date(synthese.premierDon)
              : donateur?.creeLe
                ? fmt.date(donateur.creeLe)
                : '—'}
          </strong>
          <span className="don-stat__note">
            {synthese?.premierDon ? 'Votre premier don reçu' : 'Votre inscription'}
          </span>
        </li>
      </ul>

      {/* ---------- La frise ---------- */}
      <section className="don-carte don-frise-carte" aria-labelledby="don-frise-titre">
        <div className="don-carte__entete">
          <h2 className="don-carte__titre" id="don-frise-titre">
            Historique
          </h2>
          <div className="filtres" role="group" aria-label="Filtrer les dons">
            {FILTRES.map((f) => (
              <button
                key={f.cle}
                type="button"
                aria-pressed={filtre === f.cle}
                className={`filtres__bouton${filtre === f.cle ? ' filtres__bouton--actif' : ''}`}
                onClick={() => setFiltre(f.cle)}
              >
                {f.label}
                <span className="filtres-fil__compte">{dons.filter(f.garde).length}</span>
              </button>
            ))}
          </div>
        </div>

        {chargement && !donnees ? (
          <p className="don-vide">Chargement de vos dons…</p>
        ) : affiches.length === 0 ? (
          <div className="don-vide don-vide--grand">
            <span className="don-vide__icone" aria-hidden="true">
              <IconeCoeur />
            </span>
            <p>
              {filtre === 'tous'
                ? 'Vous n’avez pas encore fait de don depuis votre espace.'
                : 'Aucun don dans cette catégorie.'}
            </p>
            {filtre === 'tous' && (
              <Link className="don-cta don-cta--plein" to="/donateur/faire-un-don">
                Faire mon premier don
              </Link>
            )}
          </div>
        ) : (
          <ol className="don-frise">
            {affiches.map((don, rang) => (
              <li
                key={don.id}
                className={`don-frise__don don-frise__don--${don.statut.toLowerCase()}`}
                style={{ '--rang': Math.min(rang, 8) }}
              >
                <span className="don-frise__point" aria-hidden="true" />
                <div className="don-frise__carte">
                  <span className="don-frise__vignette" aria-hidden="true">
                    {don.projetImage ? <img src={urlMedia(don.projetImage)} alt="" loading="lazy" /> : <IconeSoleil />}
                  </span>
                  <div className="don-frise__corps">
                    <p className="don-frise__pour">
                      {don.projetId ? (
                        <Link to={`/donateur/projets/${don.projetId}`}>{don.projetNom}</Link>
                      ) : (
                        'Fonds HOPE — là où le besoin est le plus grand'
                      )}
                    </p>
                    <p className="don-frise__meta">
                      <span>
                        {don.statut === 'RECEIVED' ? 'Reçu le ' : 'Promis le '}
                        {fmt.date(don.statut === 'RECEIVED' ? don.recuLe : don.creeLe)}
                      </span>
                      <span>{don.modePaiement}</span>
                      <span className="don-frise__reference">{don.reference}</span>
                      {don.frequence === 'MONTHLY' && <span className="don-frise__mensuel">Mensuel</span>}
                    </p>
                    {don.message && <p className="don-frise__message">« {don.message} »</p>}
                  </div>
                  <div className="don-frise__droite">
                    <strong className="don-frise__montant">{fmt.montant(don.montant, don.devise)}</strong>
                    <StatutDon statut={don.statut} />
                  </div>
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
