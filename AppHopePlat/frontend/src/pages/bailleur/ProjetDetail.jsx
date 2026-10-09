import { Link, useParams, useSearchParams } from 'react-router-dom';

import { LigneFiche, Onglets } from '../../components/admin/ui.jsx';
import FeuilleRapport from '../../components/FeuilleRapport.jsx';
import { OngletImpact } from '../../components/projet/FicheProjet.jsx';
import { PhotoAgrandissable } from '../../components/VisionneuseImage.jsx';
import { useChargement } from '../../hooks/useChargement.js';
import { urlMedia } from '../../services/api.js';
import * as service from '../../services/bailleur.service.js';
import * as fmt from '../../utils/format.js';
import { BarreRepartition, Pastille } from './composants.jsx';
import { ouvertAuFinancement, STATUTS_PROJET } from './Projets.jsx';

const ONGLETS = ['general', 'financement', 'depenses', 'beneficiaires', 'impact', 'rapport'];

export default function ProjetDetail() {
  const { id } = useParams();
  const [parametres, setParametres] = useSearchParams();
  const onglet = ONGLETS.includes(parametres.get('onglet')) ? parametres.get('onglet') : 'general';

  const { donnees, chargement, erreur } = useChargement(() => service.projet(id), [id]);

  if (chargement && !donnees) return <p className="vide-bailleur">Chargement du projet…</p>;
  if (erreur) return <p className="alerte-bailleur">{erreur}</p>;
  if (!donnees) return null;

  const projet = donnees.project;
  const finance = donnees.finance;
  const depenses = donnees.expensesByCategory ?? [];
  const beneficiaires = donnees.beneficiaires ?? null;
  const impacts = donnees.impacts ?? [];
  const devise = projet.currency ?? 'MGA';
  const statut = STATUTS_PROJET[projet.status] ?? STATUTS_PROJET.IN_PROGRESS;
  const financable = ouvertAuFinancement({
    status: projet.status,
    tauxFinancement: finance.fundingRate,
  });

  function changerOnglet(cle) {
    setParametres(cle === 'general' ? {} : { onglet: cle }, { replace: true });
  }

  return (
    <div className="fiche-projet-bailleur">
      <p className="fil-retour">
        <Link to="/bailleur/projets">← Tous les projets</Link>
      </p>

      {projet.mediaUrl && (
        <div
          className={`couverture-projet${
            projet.mediaType === 'VIDEO' ? ' couverture-projet--video' : ''
          }`}
        >
          {projet.mediaType === 'VIDEO' ? (
            <video
              src={`${urlMedia(projet.mediaUrl)}#t=0.5`}
              controls
              playsInline
              preload="metadata"
              aria-label={`Vidéo du projet ${projet.name}`}
            />
          ) : (
            <PhotoAgrandissable
              src={urlMedia(projet.mediaUrl)}
              alt={projet.name}
              legende={projet.name}
            />
          )}
        </div>
      )}

      <header className="page-bailleur__entete">
        <div>
          <p className="surtitre">
            <span className="trait-hope surtitre__trait" aria-hidden="true" />
            {[projet.categoryName, projet.reference].filter(Boolean).join(' · ')}
          </p>
          <h1 className="page-bailleur__titre">{projet.name}</h1>
          {projet.descriptionTitre && (
            <p className="page-bailleur__accroche">{projet.descriptionTitre}</p>
          )}
          <p className="fiche-projet-bailleur__jetons">
            <Pastille teinte={statut.teinte}>{statut.libelle}</Pastille>
            {projet.financeParMoi && <Pastille teinte="violet">Vous financez</Pastille>}
            {projet.location && <span className="fiche-projet-bailleur__lieu">{projet.location}</span>}
          </p>
        </div>
        {financable && (
          <div className="page-bailleur__actions">
            <Link className="bouton-bailleur" to={`/bailleur/faire-un-don?projet=${projet.id}`}>
              Financer ce projet
            </Link>
          </div>
        )}
      </header>

      <div className="resume-financier">
        <div className="resume-financier__bloc">
          <p className="resume-financier__libelle">Budget nécessaire</p>
          <p className="resume-financier__valeur">{fmt.montant(finance.requiredBudget, devise)}</p>
          <p className="resume-financier__detail">
            {projet.beneficiaryTarget
              ? `${fmt.nombre(projet.beneficiaryTarget)} bénéficiaires visés`
              : 'Objectif de bénéficiaires non fixé'}
          </p>
        </div>
        <div className="resume-financier__bloc">
          <p className="resume-financier__libelle">Somme investie</p>
          <p className="resume-financier__valeur">{fmt.montant(finance.fundedTotal, devise)}</p>
          <p className="resume-financier__detail">{fmt.pourcent(finance.fundingRate)} du besoin</p>
        </div>
        <div className="resume-financier__bloc">
          <p className="resume-financier__libelle">Dépensé</p>
          <p className="resume-financier__valeur">{fmt.montant(finance.spentTotal, devise)}</p>
          <p className="resume-financier__detail">
            {fmt.pourcent(finance.spendingRate)} des fonds reçus
          </p>
        </div>
        <div className="resume-financier__bloc">
          <p className="resume-financier__libelle">Fonds disponibles</p>
          <p className="resume-financier__valeur">{fmt.montant(finance.availableFunds, devise)}</p>
          <p className="resume-financier__detail">
            Besoin restant : {fmt.montant(finance.remainingNeed, devise)}
          </p>
        </div>
      </div>

      <Onglets
        onglets={[
          { cle: 'general', label: 'Vue générale' },
          { cle: 'financement', label: 'Financement' },
          {
            cle: 'depenses',
            label: 'Dépenses',
            compteur: depenses.reduce((total, poste) => total + Number(poste.nombre ?? 0), 0),
          },
          {
            cle: 'beneficiaires',
            label: 'Bénéficiaires',
            compteur: beneficiaires?.accompagnes ?? 0,
          },
          { cle: 'impact', label: 'Impact', compteur: impacts.length },
          { cle: 'rapport', label: 'Rapport' },
        ]}
        actif={onglet}
        onChange={changerOnglet}
      />

      {onglet === 'general' && <OngletGeneral projet={projet} avancement={donnees.progress} />}
      {onglet === 'financement' && (
        <OngletFinancement projet={projet} finance={finance} devise={devise} />
      )}
      {onglet === 'depenses' && (
        <OngletDepenses depenses={depenses} finance={finance} devise={devise} />
      )}
      {onglet === 'beneficiaires' && (
        <OngletBeneficiaires projet={projet} resume={beneficiaires} />
      )}
      {onglet === 'impact' && (
        <OngletImpact
          impacts={impacts}
          synthese={donnees.impactSummary ?? []}
          indicateurs={donnees.indicators ?? []}
        />
      )}
      {onglet === 'rapport' && <OngletRapport projet={projet} />}
    </div>
  );
}

function OngletGeneral({ projet, avancement }) {
  const total = avancement.realisees + avancement.enCours + avancement.aVenir;

  return (
    <>
      <section className="bloc">
        <h2 className="bloc__titre">Informations du projet</h2>
        <dl className="fiche">
          <LigneFiche terme="Identifiant">{projet.reference}</LigneFiche>
          <LigneFiche terme="Catégorie">{projet.categoryName}</LigneFiche>
          <LigneFiche terme="Localisation">{projet.location}</LigneFiche>
          <LigneFiche terme="Responsable">{projet.managerName}</LigneFiche>
          <LigneFiche terme="Début">{projet.startDate ? fmt.date(projet.startDate) : null}</LigneFiche>
          {projet.completedAt && <LigneFiche terme="Fin">{fmt.date(projet.completedAt)}</LigneFiche>}
          <LigneFiche terme="Public bénéficiaire">{projet.beneficiaryProfile}</LigneFiche>
          <LigneFiche terme="Bénéficiaires accompagnés">
            {fmt.nombre(projet.beneficiariesCount)}
            {projet.beneficiaryTarget ? ` sur ${fmt.nombre(projet.beneficiaryTarget)} visés` : ''}
          </LigneFiche>
        </dl>
      </section>

      {(projet.descriptionTitre || projet.description) && (
        <section className="bloc">
          <h2 className="bloc__titre">Description</h2>
          {projet.descriptionTitre && <p className="bloc-texte__titre">{projet.descriptionTitre}</p>}
          {projet.description && <p className="projet-benevole__texte">{projet.description}</p>}
        </section>
      )}

      <section className="bloc">
        <div className="bloc__entete">
          <h2 className="bloc__titre">Objectifs spécifiques</h2>
          {projet.objectives?.length > 0 && (
            <p className="bloc__sous-titre">{projet.objectives.length} objectif(s)</p>
          )}
        </div>
        {projet.objectives?.length > 0 ? (
          <ol className="objectifs">
            {projet.objectives.map((objectif) => (
              <li className="objectifs__ligne" key={objectif.id}>
                {objectif.label}
              </li>
            ))}
          </ol>
        ) : (
          <p className="bloc__vide">L’équipe n’a pas encore fixé d’objectifs à ce projet.</p>
        )}
      </section>

      <section className="bloc">
        <div className="bloc__entete">
          <h2 className="bloc__titre">Avancement des actions</h2>
          <p className="bloc__sous-titre">
            {total > 0 ? `${avancement.realisees} réalisée(s) sur ${total}` : 'Aucune action planifiée'}
          </p>
        </div>
        {total > 0 ? (
          <>
            <div className="fiche-projet__avancement">
              <p>
                <strong>{fmt.nombre(avancement.realisees)}</strong> réalisée(s)
              </p>
              <p>
                <strong>{fmt.nombre(avancement.enCours)}</strong> en cours
              </p>
              <p>
                <strong>{fmt.nombre(avancement.aVenir)}</strong> à venir
              </p>
            </div>
            {avancement.dernieresRealisees.length > 0 && (
              <ul className="fiche-projet__realisees">
                {avancement.dernieresRealisees.map((titre) => (
                  <li key={titre}>{titre}</li>
                ))}
              </ul>
            )}
          </>
        ) : (
          <p className="bloc__vide">L’équipe n’a pas encore planifié d’actions sur ce projet.</p>
        )}
      </section>

      {projet.outcome && (
        <section className="bloc">
          <h2 className="bloc__titre">Résultat du projet</h2>
          <p className="projet-benevole__texte">{projet.outcome}</p>
        </section>
      )}
    </>
  );
}

function OngletFinancement({ projet, finance, devise }) {
  return (
    <>
      {projet.financeParMoi && (
        <section className="bloc fiche-projet__votre-part">
          <p className="fiche-projet__votre-part-libelle">Votre affectation</p>
          <p className="fiche-projet__votre-part-montant">
            {fmt.montant(finance.votreAffectation, devise)}
          </p>
          <p className="fiche-projet__votre-part-note">
            Le montant que votre organisation a attribué à ce projet. Il s’ajoute à la somme
            investie, qui ne compte que les dons et les fonds de HOPE.
          </p>
        </section>
      )}

      <section className="bloc">
        <div className="bloc__entete">
          <h2 className="bloc__titre">D’où vient l’argent</h2>
          <p className="bloc__sous-titre">Des totaux par origine, jamais le nom d’un donateur</p>
        </div>
        <dl className="fiche">
          <LigneFiche terme="Dons affectés au projet">
            {fmt.montant(finance.designatedTotal, devise)}
            {finance.donationsCount > 0
              ? ` (${finance.donationsCount} don${finance.donationsCount > 1 ? 's' : ''})`
              : ''}
          </LigneFiche>
          <LigneFiche terme="Fonds de HOPE">
            {fmt.montant(finance.investedHopeTotal, devise)}
          </LigneFiche>
          <LigneFiche terme="Affecté par les partenaires">
            {fmt.montant(finance.partenairesTotal, devise)}
            {finance.partenairesNombre > 0
              ? ` (${finance.partenairesNombre} partenaire${finance.partenairesNombre > 1 ? 's' : ''})`
              : ''}
          </LigneFiche>
          <LigneFiche terme="Fonds disponibles">
            {fmt.montant(finance.availableFunds, devise)}
          </LigneFiche>
          <LigneFiche terme="Reste à financer">
            {Number(finance.remainingNeed) > 0
              ? fmt.montant(finance.remainingNeed, devise)
              : 'Budget atteint'}
          </LigneFiche>
        </dl>
      </section>
    </>
  );
}

function OngletDepenses({ depenses, finance, devise }) {
  const total = depenses.reduce((somme, poste) => somme + Number(poste.total), 0);
  const part = (poste) => (total > 0 ? Math.round((Number(poste.total) * 1000) / total) / 10 : 0);

  return (
    <>
      <section className="bloc">
        <div className="bloc__entete">
          <h2 className="bloc__titre">Dépenses par poste</h2>
          <p className="bloc__sous-titre">
            {total > 0
              ? `${fmt.montant(total, devise)} dépensés, soit ${fmt.pourcent(finance.spendingRate)} des fonds reçus`
              : 'Aucune dépense enregistrée'}
          </p>
        </div>

        {depenses.length > 0 ? (
          <>
            <BarreRepartition
              cleLibelle="categorie"
              lignes={depenses.map((poste) => ({
                categorie: poste.categorie,
                part: part(poste),
                montant: poste.total,
              }))}
            />

            <div className="table-enveloppe">
              <table className="table table--empilable">
                <thead>
                  <tr>
                    <th>Poste</th>
                    <th className="table__nombre">Dépenses</th>
                    <th className="table__nombre">Montant</th>
                    <th className="table__nombre">Part</th>
                  </tr>
                </thead>
                <tbody>
                  {depenses.map((poste) => (
                    <tr key={poste.categorie}>
                      <td data-libelle="Poste">{poste.categorie}</td>
                      <td className="table__nombre" data-libelle="Dépenses">
                        {fmt.nombre(poste.nombre)}
                      </td>
                      <td className="table__nombre" data-libelle="Montant">
                        <strong>{fmt.montant(poste.total, devise)}</strong>
                      </td>
                      <td className="table__nombre" data-libelle="Part">
                        {fmt.pourcent(part(poste))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <p className="bloc__vide">Aucune dépense n’est encore enregistrée sur ce projet.</p>
        )}
      </section>

      <p className="fiche-projet-bailleur__note">
        Les dépenses sont présentées par poste. Le détail de chaque ligne et ses justificatifs
        restent dans le dossier de l’équipe HOPE, qui peut vous les transmettre sur demande.
      </p>
    </>
  );
}

function toutInconnu(lignes) {
  const inconnus = ['Non précisé', 'Âge non renseigné', 'Lieu non précisé'];
  return lignes.every((ligne) => inconnus.includes(ligne.libelle));
}

function OngletBeneficiaires({ projet, resume }) {
  if (!resume) {
    return <p className="bloc__vide">Les bénéficiaires de ce projet ne sont pas encore renseignés.</p>;
  }

  const repartitions = [
    { titre: 'Par situation', lignes: resume.parType },
    { titre: 'Par genre', lignes: resume.parGenre },
    { titre: 'Par tranche d’âge', lignes: resume.parAge },
    { titre: 'Par lieu', lignes: resume.parLieu },
  ].filter((groupe) => groupe.lignes?.length > 0 && !toutInconnu(groupe.lignes));

  return (
    <>
      <div className="cartes-chiffres">
        <CarteChiffre
          libelle="Bénéficiaires accompagnés"
          valeur={fmt.nombre(resume.accompagnes)}
          note={projet.beneficiaryProfile || 'Personnes suivies par le projet'}
        />
        <CarteChiffre
          libelle="Objectif du projet"
          valeur={resume.cible ? fmt.nombre(resume.cible) : '—'}
          note={resume.cible ? 'Bénéficiaires visés' : 'Objectif non fixé'}
        />
        <CarteChiffre
          libelle="Part de l’objectif"
          valeur={resume.part !== null ? fmt.pourcent(resume.part) : '—'}
          note={resume.part !== null ? 'De l’objectif atteint' : 'Sans objectif chiffré'}
        />
        <CarteChiffre
          libelle="Sorties du projet"
          valeur={fmt.nombre(resume.sortis)}
          note="Personnes qui ne sont plus suivies"
        />
      </div>

      {resume.accompagnes === 0 ? (
        <p className="bloc__vide">Aucun bénéficiaire n’est encore rattaché à ce projet.</p>
      ) : (
        repartitions.map((groupe) => (
          <section className="bloc" key={groupe.titre}>
            <div className="bloc__entete">
              <h2 className="bloc__titre">{groupe.titre}</h2>
              <p className="bloc__sous-titre">
                {fmt.nombre(resume.accompagnes)} personne(s) accompagnée(s)
              </p>
            </div>
            <BarreRepartition
              cleLibelle="libelle"
              lignes={groupe.lignes.map((ligne) => ({
                libelle: ligne.libelle,
                part: Math.round((ligne.nombre * 1000) / resume.accompagnes) / 10,
                nombre: ligne.nombre,
              }))}
            />
          </section>
        ))
      )}

      <p className="fiche-projet-bailleur__note">
        Aucune identité ne quitte l’espace de l’équipe : ni nom, ni date de naissance, ni note de
        suivi. Ce sont des comptes, et rien d’autre.
      </p>
    </>
  );
}

function OngletRapport({ projet }) {
  const { donnees: rapport, chargement, erreur } = useChargement(
    () => service.rapportProjet(projet.id),
    [projet.id]
  );

  return (
    <section className="bloc">
      <div className="bloc__entete">
        <h2 className="bloc__titre">Rapport du projet</h2>
        <p className="bloc__sous-titre">Composé avec les données du jour</p>
      </div>

      {erreur ? (
        <p className="feuille__note feuille__note--echec">{erreur}</p>
      ) : chargement || !rapport ? (
        <p className="feuille__note">Composition du rapport…</p>
      ) : (
        <FeuilleRapport
          titre={rapport.titre}
          sousTitre={rapport.sousTitre}
          blocs={rapport.blocs}
          pied={[rapport.projet?.nom, rapport.projet?.reference].filter(Boolean).join(' · ')}
        />
      )}
    </section>
  );
}

function CarteChiffre({ libelle, valeur, note }) {
  return (
    <div className="carte-chiffre">
      <div>
        <p className="carte-chiffre__libelle">{libelle}</p>
        {note && <p className="carte-chiffre__variation">{note}</p>}
      </div>
      <p className="carte-chiffre__valeur">{valeur}</p>
    </div>
  );
}
