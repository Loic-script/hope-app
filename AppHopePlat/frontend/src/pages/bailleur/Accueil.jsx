import { useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';

import { IconeChevronDroit } from '../../components/admin/AdminIcons.jsx';
import { elementsDuFil, FiltresFil } from '../../components/admin/FilActualite.jsx';
import PublicationActualite from '../../components/admin/PublicationActualite.jsx';
import PublicationFil from '../../components/admin/PublicationFil.jsx';
import { JaugeHorizon } from '../../components/admin/PublicationProjet.jsx';
import { useChargement } from '../../hooks/useChargement.js';
import { useColonneCollante } from '../../hooks/useColonneCollante.js';
import { messageErreur } from '../../services/api.js';
import * as service from '../../services/bailleur.service.js';
import * as fmt from '../../utils/format.js';
import {
  BarreRepartition,
  Panneau,
  Pastille,
  STATUTS_VERSEMENT,
  TEINTES_VERSEMENT,
} from './composants.jsx';

import photoBandeau from '../../assets/hope-bandeau.jpg';

/** Sur l'accueil, les cinq derniers versements ; la page Partenariat a le reste. */
const VERSEMENTS_ACCUEIL = 5;

/**
 * Un projet de l'espace bailleur, sous la forme qu'attend la publication
 * du fil -- celle des projets de l'administration.
 *
 * L'API du bailleur ne rend une image que si c'est une photo : une video
 * laisse la place au logo.
 */
function commePublication(projet) {
  return {
    id: projet.id,
    name: projet.name,
    reference: projet.reference,
    categoryName: projet.categorie,
    location: projet.location,
    startDate: projet.startDate,
    descriptionTitre: projet.descriptionTitre,
    description: projet.description,
    mediaUrl: projet.photoUrl,
    mediaType: projet.photoUrl ? 'PHOTO' : null,
    currency: projet.currency,
  };
}

/**
 * Le financement d'un projet, tel qu'un partenaire le lit.
 *
 * La jauge porte la "somme investie" de la fiche projet et du rapport :
 * dons recus et fonds de HOPE. Les affectations des partenaires n'y
 * entrent pas ; celle du bailleur se lit a part, en dessous.
 */
function FinancementDuProjet({ projet }) {
  const devise = projet.currency ?? 'MGA';
  const budget = Number(projet.requiredBudget) || 0;
  const finance = Number(projet.montantFinance) || 0;

  return (
    <>
      <JaugeHorizon
        taux={projet.tauxFinancement}
        recu={finance}
        manque={Math.max(0, budget - finance)}
        devise={devise}
      />
      <p className="fil-post__chiffres">
        <span>
          Budget <strong>{fmt.montant(budget, devise)}</strong>
        </span>
        {projet.beneficiaryTarget ? (
          <span>
            <strong>{fmt.nombre(projet.beneficiaryTarget)}</strong> bénéficiaires visés
          </span>
        ) : null}
        {projet.financeParMoi && (
          <span className="fil-post__votre-part">
            Votre affectation <strong>{fmt.montant(projet.montantAffecte, devise)}</strong>
          </span>
        )}
      </p>
    </>
  );
}

/**
 * Une publication de l'equipe dans le fil : une actualite, ou un appel a
 * financement.
 *
 * L'appel porte la collecte du projet lie -- la somme investie, dons et
 * fonds HOPE, face a son budget -- et le bouton "Financer ce projet".
 * Le bouton ne debite rien : il enregistre une intention et previent
 * l'equipe, qui prend contact hors ligne et cree ensuite l'engagement
 * reel. L'ecran le dit explicitement : personne ne doit croire avoir
 * paye en cliquant.
 */
function ActualiteDuFil({ publication, rang, onInteret, ouverts }) {
  const appel = publication.type === 'appel_financement';
  const devise = publication.devise ?? 'MGA';
  const budget = Number(publication.budgetProjet) || 0;
  const finance = Number(publication.montantFinance) || 0;

  const [ouvert, setOuvert] = useState(false);
  const [message, setMessage] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const [refus, setRefus] = useState('');
  const [confirmation, setConfirmation] = useState('');

  async function envoyer() {
    setEnvoi(true);
    setRefus('');
    try {
      const resultat = await service.manifesterUnInteret({
        publicationId: publication.id,
        projetId: publication.projetId ?? undefined,
        message,
      });
      setConfirmation(resultat.message);
      setOuvert(false);
      onInteret();
    } catch (echec) {
      setRefus(messageErreur(echec, 'Votre intérêt n’a pas pu être transmis.'));
    } finally {
      setEnvoi(false);
    }
  }

  // Un budget atteint ou un projet termine ne cherche plus de partenaire :
  // pas de bouton. Un interet deja exprime reste affiche.
  const proposeLeBouton =
    appel && (publication.interetManifeste || !(publication.objectifAtteint || publication.projetTermine));

  // La barre suit le projet lie ; un appel dont le projet a ete supprime
  // n'en a plus.
  const collecte =
    appel && publication.avancement !== null ? (
      <>
        <JaugeHorizon
          taux={publication.avancement}
          recu={finance}
          manque={Math.max(0, budget - finance)}
          devise={devise}
        />
        <p className="fil-post__chiffres">
          <span>
            Budget du projet <strong>{fmt.montant(budget, devise)}</strong>
          </span>
          <span>Reçus : dons et fonds HOPE</span>
          {publication.projetTermine && <span>Ce projet est terminé.</span>}
        </p>
      </>
    ) : null;

  const actions =
    appel && (proposeLeBouton || confirmation || refus) ? (
      <div className="fil-post__interet">
        {refus && <p className="alerte-bailleur">{refus}</p>}
        {confirmation ? (
          <p className="succes-bailleur">{confirmation}</p>
        ) : publication.interetManifeste ? (
          <p className="actu__deja">
            Votre intérêt est enregistré. L’équipe HOPE vous contacte pour formaliser le partenariat.
          </p>
        ) : ouvert ? (
          <div className="interet">
            <label className="interet__label" htmlFor={`message-${publication.id}`}>
              Un mot pour l’équipe ? (facultatif)
            </label>
            <textarea
              id={`message-${publication.id}`}
              className="interet__saisie"
              rows={3}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Le montant que nous pourrions engager, nos contraintes de calendrier…"
            />
            <p className="interet__avertissement">
              Aucun montant ne sera débité. Vous manifestez un intérêt ; l’équipe HOPE vous contacte
              pour établir la convention.
            </p>
            <div className="interet__actions">
              <button type="button" className="bouton-bailleur" onClick={envoyer} disabled={envoi}>
                {envoi ? 'Envoi…' : 'Transmettre mon intérêt'}
              </button>
              <button
                type="button"
                className="bouton-bailleur bouton-bailleur--discret"
                onClick={() => setOuvert(false)}
                disabled={envoi}
              >
                Annuler
              </button>
            </div>
          </div>
        ) : (
          <button type="button" className="bouton-bailleur" onClick={() => setOuvert(true)}>
            Financer ce projet
          </button>
        )}
      </div>
    ) : undefined;

  // Une actualite liee a un projet en cours se soutient depuis le fil ;
  // un appel a son propre bouton, "Financer ce projet".
  const lienDon =
    !appel && publication.projetId && ouverts?.has(publication.projetId)
      ? `/bailleur/faire-un-don?projet=${publication.projetId}`
      : null;

  return (
    <PublicationActualite
      publication={publication}
      rang={rang}
      appel={appel}
      lienDon={lienDon}
      lienProjet={publication.projetId ? `/bailleur/projets/${publication.projetId}` : null}
      compteurs={collecte}
      actions={actions}
    />
  );
}

/**
 * Actualites : la page d'entree de l'espace bailleur.
 *
 * Elle reunit l'ancien accueil et l'ancienne page Actualites, sur le
 * modele de l'accueil de l'administration : un bandeau de bienvenue, puis
 * le fil d'actualite -- les projets en cours et les publications de
 * l'equipe (actualites et appels a financement) dans un meme fil, que
 * trois filtres separent. Un projet s'y lit comme un message : qui, quand,
 * ou, ce qu'il fait, sa photo, son financement, et une seule action, voir
 * le projet -- sa fiche dans l'espace bailleur.
 *
 * Ce qui reste propre au partenaire l'encadre : ses chiffres en tete, et
 * dans la colonne de droite ses derniers versements, ou vont les fonds,
 * et d'ou viennent ceux de HOPE. Le detail des engagements --
 * promis, recu, affecte -- est sur la page Partenariat.
 *
 * Les chiffres sont des agregats calcules a la volee : aucun n'est
 * stocke, sinon ils se desynchroniseraient des la saisie du versement
 * suivant.
 */
export default function Accueil() {
  const { bailleur } = useOutletContext();
  // La colonne de droite suit l'ecran, comme celle de l'administrateur.
  const colonne = useColonneCollante();
  const { donnees, chargement, erreur } = useChargement(() => service.tableauDeBord(), []);
  const { donnees: publications, recharger: rechargerFil } = useChargement(() => service.fil(), []);
  const [filtre, setFiltre] = useState('tout');

  const i = donnees?.indicateurs ?? {};
  const projets = (donnees?.projets ?? []).filter((p) => p.status === 'IN_PROGRESS');
  const actualites = publications ?? [];
  const fil = elementsDuFil(projets, actualites, filtre);
  // Les projets qu'on peut encore soutenir : en cours, budget non atteint.
  const ouverts = new Set(projets.filter((p) => Number(p.tauxFinancement) < 100).map((p) => p.id));
  const versements = (donnees?.versements ?? []).slice(0, VERSEMENTS_ACCUEIL);
  const origine = donnees?.origineDesFonds ?? {};
  const distinctions = donnees?.distinctions ?? [];
  const zones = donnees?.zones ?? [];

  const organisation =
    bailleur?.raisonSociale || `${bailleur?.prenom ?? ''} ${bailleur?.nom ?? ''}`.trim() || 'partenaire';

  return (
    <>
      {/* ---------- Bandeau de bienvenue ---------- */}
      <section className="accueil__bandeau" style={{ '--photo-bandeau': `url(${photoBandeau})` }}>
        <p className="page-entete__fil">
          Actualités
          <span className="trait-hope" aria-hidden="true" />
        </p>
        <h1 className="accueil__salutation">Bienvenue, {organisation}</h1>
        <p className="accueil__accroche">
          Ce que votre organisation a engagé, les projets que cela fait avancer à Madagascar,
          et les nouvelles de HOPE.
        </p>
      </section>

      {erreur && <p className="alerte-bailleur">{erreur}</p>}

      {chargement && !donnees ? (
        <p className="vide-bailleur">Chargement de votre accueil…</p>
      ) : (
        <>
          {/*
            Les trois chiffres du partenariat. Le taux d'execution a ete
            retire ; ce qui a ete recu se lit sous le montant engage.
          */}
          <div className="kpi">
            <Kpi
              libelle="Montant engagé"
              valeur={fmt.montant(i.montantEngage)}
              note={[
                `${fmt.montant(i.montantRecu)} reçus`,
                Number(i.montantAttendu) > 0 ? `${fmt.montant(i.montantAttendu)} attendus` : null,
              ]
                .filter(Boolean)
                .join(' · ')}
              teinte="violet"
            />
            <Kpi libelle="Projets financés" valeur={fmt.nombre(i.projetsFinances)} teinte="bleu" />
            <Kpi
              libelle="Bénéficiaires touchés"
              valeur={fmt.nombre(i.beneficiairesTouches)}
              teinte="vert"
            />
          </div>

          <div className="accueil__colonnes accueil__colonnes--bailleur">
            {/*
              Le fil d'actualite : les projets en cours et les
              publications de l'equipe. Sous le filtre Projets, ceux que le
              partenaire finance viennent en tete : l'API les classe ainsi.
            */}
            <div className="accueil__pile">
              <section className="fil-accueil" aria-labelledby="fil-bailleur-titre">
                <div className="fil-accueil__entete">
                  <div>
                    <h2 className="fil-accueil__titre" id="fil-bailleur-titre">
                      Fil d’actualité
                    </h2>
                    <p className="fil-accueil__sous-titre">
                      Les projets en cours, les nouvelles de HOPE et ses appels à financement
                    </p>
                  </div>
                  <Link className="btn btn--neutre btn--petit fil-accueil__tous" to="/bailleur/projets">
                    Tous les projets
                    <IconeChevronDroit />
                  </Link>
                </div>

                <FiltresFil
                  actif={filtre}
                  onChange={setFiltre}
                  compteurs={{
                    tout: projets.length + actualites.length,
                    projet: projets.length,
                    actualite: actualites.length,
                  }}
                />

                {fil.length === 0 ? (
                  <Panneau>
                    <p className="vide-bailleur">
                      {filtre === 'actualite'
                        ? 'Aucune publication pour l’instant.'
                        : 'Aucun projet en cours pour l’instant.'}
                    </p>
                  </Panneau>
                ) : (
                  fil.map(({ type, cle, element }, rang) =>
                    type === 'projet' ? (
                      <PublicationFil
                        key={cle}
                        projet={commePublication(element)}
                        rang={Math.min(rang, 5)}
                        lien={`/bailleur/projets/${element.id}`}
                        lienDon={
                          Number(element.tauxFinancement) >= 100 ? null : `/bailleur/faire-un-don?projet=${element.id}`
                        }
                        lienAjoutVisuel={null}
                        compteurs={<FinancementDuProjet projet={element} />}
                      />
                    ) : (
                      <ActualiteDuFil
                        key={cle}
                        publication={element}
                        rang={Math.min(rang, 5)}
                        onInteret={rechargerFil}
                        ouverts={ouverts}
                      />
                    )
                  )
                )}
              </section>
            </div>

            {/* ---------- Ce qui est propre au partenaire ---------- */}
            <div className="accueil__pile" ref={colonne}>
              <Panneau
                titre="Derniers versements reçus"
                actions={
                  <Link className="lien-bailleur" to="/bailleur/partenariat">
                    Tout l’historique
                  </Link>
                }
              >
                {versements.length === 0 ? (
                  <p className="vide-bailleur">Aucun versement enregistré à ce jour.</p>
                ) : (
                  <ul className="lignes">
                    {versements.map((versement) => (
                      <li key={versement.id} className="ligne">
                        <div className="ligne__gauche">
                          <strong>{fmt.montant(versement.montant, versement.devise)}</strong>
                          <span className="ligne__meta">{versement.engagementIntitule}</span>
                        </div>
                        <div className="ligne__droite">
                          <Pastille teinte={TEINTES_VERSEMENT[versement.statut]}>
                            {STATUTS_VERSEMENT[versement.statut]}
                          </Pastille>
                          <span className="ligne__date">{fmt.date(versement.dateRecue)}</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </Panneau>

              <Panneau titre="Répartition par domaine">
                <BarreRepartition lignes={donnees?.domaines ?? []} cleLibelle="domaine" />
              </Panneau>

              <Panneau titre="Zones d’intervention">
                {zones.length === 0 ? (
                  <p className="vide-bailleur">Aucune zone à afficher.</p>
                ) : (
                  <ul className="lignes">
                    {zones.map((zone) => (
                      <li key={zone.zone} className="ligne">
                        <div className="ligne__gauche">
                          <strong>{zone.zone}</strong>
                          <span className="ligne__meta">
                            {zone.projets} projet{zone.projets > 1 ? 's' : ''}
                          </span>
                        </div>
                        <span className="ligne__date">{fmt.montant(zone.montant)}</span>
                      </li>
                    ))}
                  </ul>
                )}

                {distinctions.length > 0 && (
                  <div className="distinctions">
                    <p className="distinctions__titre">Distinctions</p>
                    {distinctions.map((distinction) => (
                      <span
                        key={distinction.code}
                        className="distinction"
                        title={distinction.regle ?? ''}
                      >
                        {distinction.libelle}
                      </span>
                    ))}
                  </div>
                )}
              </Panneau>

              <Panneau titre="Origine des fonds HOPE" sousTitre="Toutes sources confondues">
                <BarreRepartition
                  lignes={[
                    {
                      domaine: 'Financements institutionnels',
                      part: origine.partInstitutionnel ?? 0,
                      montant: origine.institutionnel,
                    },
                    {
                      domaine: 'Dons individuels',
                      part: origine.partIndividuel ?? 0,
                      montant: origine.individuel,
                    },
                  ]}
                />
              </Panneau>
            </div>
          </div>
        </>
      )}
    </>
  );
}

/** Un chiffre cle du haut de page. */
function Kpi({ libelle, valeur, note, teinte }) {
  return (
    <article className={`kpi__carte kpi__carte--${teinte}`}>
      <p className="kpi__libelle">{libelle}</p>
      <p className="kpi__valeur">{valeur}</p>
      {note && <p className="kpi__note">{note}</p>}
    </article>
  );
}
