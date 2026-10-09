import { useState } from 'react';
import { Link, useLocation, useOutletContext } from 'react-router-dom';

import { IconeChevronDroit } from '../../components/admin/AdminIcons.jsx';
import ActionsActualite, { idsActualites, useReactionsActualites } from '../../components/ActionsActualite.jsx';
import { elementsDuFil, FiltresFil } from '../../components/admin/FilActualite.jsx';
import PublicationActualite from '../../components/admin/PublicationActualite.jsx';
import PublicationFil from '../../components/admin/PublicationFil.jsx';
import { IconeCoeur, IconeFleche, IconeMainsCoeur, IconeRecuCoche, IconeSoleil } from '../../components/HopeIcons.jsx';
import { useChargement } from '../../hooks/useChargement.js';
import { useColonneCollante } from '../../hooks/useColonneCollante.js';
import { urlMedia } from '../../services/api.js';
import * as service from '../../services/donateur.service.js';
import * as fmt from '../../utils/format.js';
import {
  JaugeProjet,
  MontantAnime,
  NombreAnime,
  projetCommePublication,
  StatutDon,
  totalPrincipal,
} from './commun.jsx';

function FinancementDuProjet({ projet }) {
  return (
    <>
      <JaugeProjet projet={projet} />
      <p className="fil-post__chiffres don-fil__chiffres">
        <span>
          Objectif <strong>{fmt.montant(projet.objectif, projet.devise)}</strong>
        </span>
        {projet.atteint && <span className="don-fil__atteint">Objectif atteint, merci !</span>}
      </p>
    </>
  );
}

export default function Actualites() {
  const { donateur } = useOutletContext();
  const parcoursTermine = Boolean(useLocation().state?.parcoursTermine);
  const colonne = useColonneCollante();

  const { donnees: projetsBruts } = useChargement(() => service.listerProjets(), []);
  const { donnees: actualites } = useChargement(() => service.actualites(), []);
  const { donnees: dons } = useChargement(() => service.mesDons(), []);
  const [filtre, setFiltre] = useState('tout');

  const projets = projetsBruts?.items ?? [];
  const fil = elementsDuFil(projets, actualites ?? [], filtre);
  const reactions = useReactionsActualites('donateur', idsActualites(actualites));
  const principal = totalPrincipal(dons?.synthese);
  const aSoutenir = projets.find((p) => !p.atteint);
  const derniers = (dons?.items ?? []).slice(0, 3);

  return (
    <div className="espace-donateur">
      <section className="don-hero" aria-labelledby="don-hero-titre">
        <span className="don-hero__halo don-hero__halo--un" aria-hidden="true" />
        <span className="don-hero__halo don-hero__halo--deux" aria-hidden="true" />
        <span className="don-hero__soleil" aria-hidden="true">
          <IconeSoleil />
        </span>

        <div className="don-hero__texte">
          <p className="surtitre surtitre--clair">
            <span className="trait-hope surtitre__trait" aria-hidden="true" />
            Accueil
          </p>
          <h1 className="don-hero__titre" id="don-hero-titre">
            Bonjour, {donateur?.prenom || 'cher donateur'}
          </h1>
          <p className="don-hero__accroche">
            Chaque don est suivi jusqu’à ce qu’il change une vie à Madagascar. Voici ce que HOPE
            mène, et ce que vous rendez possible.
          </p>
          <div className="don-hero__actions">
            <Link className="don-cta" to="/donateur/faire-un-don">
              <IconeCoeur />
              Faire un don
              <IconeFleche />
            </Link>
            <Link className="don-cta don-cta--clair" to="/donateur/projets">
              Découvrir les projets
            </Link>
          </div>
        </div>

        <ul className="don-hero__chiffres">
          <li className="don-hero__chiffre" style={{ '--rang': 0 }}>
            <span className="don-hero__icone" aria-hidden="true">
              <IconeMainsCoeur />
            </span>
            <strong>
              {principal ? <MontantAnime valeur={principal.recu} devise={principal.devise} delai={300} /> : '—'}
            </strong>
            <span>donnés à HOPE</span>
          </li>
          <li className="don-hero__chiffre" style={{ '--rang': 1 }}>
            <span className="don-hero__icone" aria-hidden="true">
              <IconeSoleil />
            </span>
            <strong>
              <NombreAnime valeur={dons ? dons.synthese.projetsSoutenus : null} delai={420} />
            </strong>
            <span>{dons?.synthese.projetsSoutenus > 1 ? 'projets soutenus' : 'projet soutenu'}</span>
          </li>
          <li className="don-hero__chiffre" style={{ '--rang': 2 }}>
            <span className="don-hero__icone" aria-hidden="true">
              <IconeRecuCoche />
            </span>
            <strong>
              <NombreAnime valeur={dons ? dons.synthese.nombreEnAttente : null} delai={540} />
            </strong>
            <span>{dons?.synthese.nombreEnAttente > 1 ? 'promesses en attente' : 'promesse en attente'}</span>
          </li>
        </ul>
      </section>

      {parcoursTermine && (
        <p className="don-bienvenue" role="status">
          Merci, votre profil de donateur est complet. Bienvenue chez vous !
        </p>
      )}

      <div className="accueil__colonnes accueil__colonnes--donateur">
        <div className="accueil__pile">
          <section className="fil-accueil" aria-labelledby="fil-donateur-titre">
            <div className="fil-accueil__entete">
              <div>
                <h2 className="fil-accueil__titre" id="fil-donateur-titre">
                  Fil d’actualité
                </h2>
                <p className="fil-accueil__sous-titre">
                  Les projets que vous pouvez soutenir, et les nouvelles de HOPE
                </p>
              </div>
              <Link className="btn btn--neutre btn--petit fil-accueil__tous" to="/donateur/projets">
                Tous les projets
                <IconeChevronDroit />
              </Link>
            </div>

            <FiltresFil
              actif={filtre}
              onChange={setFiltre}
              compteurs={{
                tout: projets.length + (actualites ?? []).length,
                projet: projets.length,
                actualite: (actualites ?? []).length,
              }}
            />

            {fil.length === 0 ? (
              <p className="don-vide">
                {filtre === 'actualite'
                  ? 'Aucune actualité pour l’instant.'
                  : 'Aucun projet ouvert aux dons pour l’instant.'}
              </p>
            ) : (
              fil.map(({ type, cle, element }, rang) =>
                type === 'projet' ? (
                  <PublicationFil
                    key={cle}
                    projet={projetCommePublication(element)}
                    rang={Math.min(rang, 5)}
                    lien={`/donateur/projets/${element.id}`}
                    lienDon={element.atteint ? null : `/donateur/faire-un-don?projet=${element.id}`}
                    lienAjoutVisuel={null}
                    compteurs={<FinancementDuProjet projet={element} />}
                  />
                ) : (
                  <PublicationActualite
                    key={cle}
                    publication={element}
                    rang={Math.min(rang, 5)}
                    actions={
                      <ActionsActualite
                        publication={element}
                        etat={reactions.etats[element.id]}
                        onJaime={reactions.basculer}
                        onCommenter={reactions.commenter}
                      />
                    }
                  />
                )
              )
            )}
          </section>
        </div>

        <aside className="accueil__pile" ref={colonne} aria-label="Pour vous">
          {aSoutenir && (
            <section className="don-carte don-besoin">
              <p className="don-carte__surtitre">Un projet a besoin de vous</p>
              {aSoutenir.image && (
                <div className="don-besoin__image">
                  <img src={urlMedia(aSoutenir.image)} alt="" loading="lazy" />
                </div>
              )}
              <h2 className="don-besoin__titre">
                <Link to={`/donateur/projets/${aSoutenir.id}`}>{aSoutenir.nom}</Link>
              </h2>
              {aSoutenir.lieu && <p className="don-besoin__lieu">{aSoutenir.lieu}</p>}
              <JaugeProjet projet={aSoutenir} />
              <Link className="don-cta don-cta--plein" to={`/donateur/faire-un-don?projet=${aSoutenir.id}`}>
                <IconeCoeur />
                Soutenir ce projet
              </Link>
            </section>
          )}

          <section className="don-carte">
            <div className="don-carte__entete">
              <h2 className="don-carte__titre">Mes derniers dons</h2>
              <Link className="don-lien" to="/donateur/mes-dons">
                Tout voir
              </Link>
            </div>
            {derniers.length === 0 ? (
              <div className="don-carte__vide">
                <p>Votre premier don apparaîtra ici, avec son suivi.</p>
                <Link className="don-lien" to="/donateur/faire-un-don">
                  Faire mon premier don
                </Link>
              </div>
            ) : (
              <ul className="don-mini">
                {derniers.map((don, rang) => (
                  <li key={don.id} className="don-mini__ligne" style={{ '--rang': rang }}>
                    <div className="don-mini__texte">
                      <strong>{fmt.montant(don.montant, don.devise)}</strong>
                      <span>{don.projetNom ?? 'Fonds HOPE'}</span>
                    </div>
                    <StatutDon statut={don.statut} />
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="don-carte don-transparence">
            <h2 className="don-carte__titre">Ce que HOPE fait de votre don</h2>
            <ul className="don-transparence__liste">
              <li>
                <span aria-hidden="true">1</span>
                L’équipe confirme votre don dès réception du paiement.
              </li>
              <li>
                <span aria-hidden="true">2</span>
                Il finance le projet choisi, ou le besoin le plus urgent.
              </li>
              <li>
                <span aria-hidden="true">3</span>
                Vous suivez son emploi et son impact, projet par projet.
              </li>
            </ul>
          </section>
        </aside>
      </div>
    </div>
  );
}
