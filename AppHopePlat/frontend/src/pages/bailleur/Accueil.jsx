import { useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';

import { IconeChevronDroit } from '../../components/admin/AdminIcons.jsx';
import PublicationFil from '../../components/admin/PublicationFil.jsx';
import { JaugeHorizon } from '../../components/admin/PublicationProjet.jsx';
import { useChargement } from '../../hooks/useChargement.js';
import * as service from '../../services/bailleur.service.js';
import * as fmt from '../../utils/format.js';
import {
  BarreRepartition,
  Panneau,
  Pastille,
  STATUTS_VERSEMENT,
  TEINTES_VERSEMENT,
} from './composants.jsx';
import FenetreRapportProjet from './RapportProjet.jsx';

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
 * Accueil de l'espace bailleur.
 *
 * Le meme accueil que ceux de l'administration et des benevoles : un
 * bandeau de bienvenue, puis les projets en cours en fil de publications
 * -- qui, quand, ou, ce qu'il fait, sa photo, son financement -- avec une
 * seule action, voir le projet. Le bailleur n'a pas de fiche projet : voir
 * le projet ouvre son rapport a jour, comme sur la page Projets.
 *
 * Ce qui reste propre au partenaire l'encadre : ses quatre chiffres en
 * tete, et dans la colonne de droite ses derniers versements, ou vont les
 * fonds, et d'ou viennent ceux de HOPE. Le detail des engagements --
 * promis, recu, affecte -- est sur la page Partenariat.
 *
 * Les chiffres sont des agregats calcules a la volee : aucun n'est
 * stocke, sinon ils se desynchroniseraient des la saisie du versement
 * suivant.
 */
export default function Accueil() {
  const { bailleur } = useOutletContext();
  const { donnees, chargement, erreur } = useChargement(() => service.tableauDeBord(), []);
  const [rapportDe, setRapportDe] = useState(null);

  const i = donnees?.indicateurs ?? {};
  const projets = (donnees?.projets ?? []).filter((p) => p.status === 'IN_PROGRESS');
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
          Accueil
          <span className="trait-hope" aria-hidden="true" />
        </p>
        <h1 className="accueil__salutation">Bienvenue, {organisation}</h1>
        <p className="accueil__accroche">
          Ce que votre organisation a engagé, ce qui est arrivé, et les projets que cela fait
          avancer à Madagascar.
        </p>
      </section>

      {erreur && <p className="alerte-bailleur">{erreur}</p>}

      {chargement && !donnees ? (
        <p className="vide-bailleur">Chargement de votre accueil…</p>
      ) : (
        <>
          {/* ---------- Les quatre chiffres du partenariat ---------- */}
          <div className="kpi">
            <Kpi
              libelle="Montant engagé"
              valeur={fmt.montant(i.montantEngage)}
              note={
                Number(i.montantAttendu) > 0
                  ? `${fmt.montant(i.montantAttendu)} encore attendus`
                  : undefined
              }
              teinte="violet"
            />
            <Kpi
              libelle="Taux d’exécution"
              valeur={`${i.tauxExecution ?? 0} %`}
              note={`${fmt.montant(i.montantRecu)} reçus`}
              teinte="orange"
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
              Les projets en cours, en fil de publications. Ceux que le
              partenaire finance viennent en tete : l'API les classe ainsi.
            */}
            <div className="accueil__pile">
              <section className="fil-accueil" aria-labelledby="fil-bailleur-titre">
                <div className="fil-accueil__entete">
                  <div>
                    <h2 className="fil-accueil__titre" id="fil-bailleur-titre">
                      Projets en cours
                    </h2>
                    <p className="fil-accueil__sous-titre">Ce qui est financé, ce qui manque encore</p>
                  </div>
                  <Link className="btn btn--neutre btn--petit fil-accueil__tous" to="/bailleur/projets">
                    Tous les projets
                    <IconeChevronDroit />
                  </Link>
                </div>

                {projets.length === 0 ? (
                  <Panneau>
                    <p className="vide-bailleur">Aucun projet en cours pour l’instant.</p>
                  </Panneau>
                ) : (
                  projets.map((projet, rang) => (
                    <PublicationFil
                      key={projet.id}
                      projet={commePublication(projet)}
                      rang={Math.min(rang, 5)}
                      onVoir={() => setRapportDe(projet)}
                      lienAjoutVisuel={null}
                      compteurs={<FinancementDuProjet projet={projet} />}
                    />
                  ))
                )}
              </section>
            </div>

            {/* ---------- Ce qui est propre au partenaire ---------- */}
            <div className="accueil__pile">
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

      <FenetreRapportProjet projet={rapportDe} onFermer={() => setRapportDe(null)} />
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
