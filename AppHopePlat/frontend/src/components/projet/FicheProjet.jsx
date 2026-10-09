import { Link, useSearchParams } from 'react-router-dom';

import { LigneFiche, Onglets } from '../admin/ui.jsx';
import { PleineLieu } from '../IconesPleines.jsx';
import { PhotoAgrandissable } from '../VisionneuseImage.jsx';
import { BarreRepartition } from '../../pages/bailleur/composants.jsx';
import { urlMedia } from '../../services/api.js';
import * as fmt from '../../utils/format.js';

const ONGLETS = ['general', 'financement', 'impact'];

export default function FicheProjet({ donnees, lienRetour, libelleRetour, pastilles, action, votrePart = null }) {
  const [parametres, setParametres] = useSearchParams();
  const onglet = ONGLETS.includes(parametres.get('onglet')) ? parametres.get('onglet') : 'general';

  const projet = donnees.project;
  const impacts = donnees.impacts ?? [];

  function changerOnglet(cle) {
    setParametres(cle === 'general' ? {} : { onglet: cle }, { replace: true });
  }

  return (
    <div className="accueil-benevole projet-benevole fiche-projet">
      <p className="fil-retour">
        <Link to={lienRetour}>← {libelleRetour}</Link>
      </p>

      <section className="tete-projet">
        {projet.mediaUrl && (
          <div className="tete-projet__image">
            {projet.mediaType === 'VIDEO' ? (
              <video
                src={urlMedia(projet.mediaUrl)}
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
        <div className="tete-projet__corps">
          <p className="surtitre">
            <span className="trait-hope surtitre__trait" aria-hidden="true" />
            {projet.categoryName ?? 'Projet'}
          </p>
          <h1 className="accueil-benevole__titre">{projet.name}</h1>
          {projet.location && (
            <p className="tete-projet__lieu">
              <PleineLieu />
              {projet.location}
            </p>
          )}
          {projet.descriptionTitre && (
            <p className="tete-projet__annonce">{projet.descriptionTitre}</p>
          )}
          <div className="fiche-projet__tete-bas">
            <span className="fiche-projet__jetons">
              {pastilles}
              {projet.reference && <span className="fiche-projet__reference">{projet.reference}</span>}
            </span>
            {action}
          </div>
        </div>
      </section>

      <Onglets
        onglets={[
          { cle: 'general', label: 'Vue générale' },
          { cle: 'financement', label: 'Financement' },
          { cle: 'impact', label: 'Impact', compteur: impacts.length },
        ]}
        actif={onglet}
        onChange={changerOnglet}
      />

      {onglet === 'general' && <OngletGeneral projet={projet} avancement={donnees.progress} />}
      {onglet === 'financement' && (
        <OngletFinancement
          projet={projet}
          finance={donnees.finance}
          depenses={donnees.expensesByCategory ?? []}
          votrePart={votrePart}
        />
      )}
      {onglet === 'impact' && (
        <OngletImpact
          impacts={impacts}
          synthese={donnees.impactSummary ?? []}
          indicateurs={donnees.indicators ?? []}
        />
      )}
    </div>
  );
}

function OngletGeneral({ projet, avancement }) {
  const total = avancement.realisees + avancement.enCours + avancement.aVenir;

  return (
    <>
      {projet.description && (
        <section className="bloc">
          <h2 className="bloc__titre">Le projet</h2>
          <p className="projet-benevole__texte">{projet.description}</p>
        </section>
      )}

      <section className="bloc">
        <h2 className="bloc__titre">En bref</h2>
        <dl className="fiche projet-benevole__fiche">
          <LigneFiche terme="Catégorie">{projet.categoryName}</LigneFiche>
          <LigneFiche terme="Lieu">{projet.location}</LigneFiche>
          <LigneFiche terme="Responsable">{projet.managerName}</LigneFiche>
          <LigneFiche terme="Début">{projet.startDate ? fmt.date(projet.startDate) : null}</LigneFiche>
          {projet.completedAt && (
            <LigneFiche terme="Fin">{fmt.date(projet.completedAt)}</LigneFiche>
          )}
          <LigneFiche terme="Pour qui">{projet.beneficiaryProfile}</LigneFiche>
          <LigneFiche terme="Bénéficiaires accompagnés">
            {fmt.nombre(projet.beneficiariesCount)}
            {projet.beneficiaryTarget ? ` sur ${fmt.nombre(projet.beneficiaryTarget)} visés` : ''}
          </LigneFiche>
        </dl>
      </section>

      <section className="bloc">
        <h2 className="bloc__titre">Objectifs spécifiques</h2>
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

function OngletFinancement({ projet, finance, depenses, votrePart }) {
  const devise = projet.currency ?? 'MGA';
  const reste = Number(finance.remainingNeed) || 0;
  const totalDepenses = depenses.reduce((somme, d) => somme + Number(d.total), 0);

  return (
    <>
      <div className="cartes-chiffres">
        <CarteChiffre libelle="Budget nécessaire" valeur={fmt.montant(finance.requiredBudget, devise)} />
        <CarteChiffre
          libelle="Somme investie"
          valeur={fmt.montant(finance.fundedTotal, devise)}
          note={`${fmt.pourcent(finance.fundingRate)} du besoin`}
        />
        <CarteChiffre
          libelle="Dépensé"
          valeur={fmt.montant(finance.spentTotal, devise)}
          note={`${fmt.pourcent(finance.spendingRate)} des fonds reçus`}
        />
        <CarteChiffre
          libelle="Reste à financer"
          valeur={reste > 0 ? fmt.montant(reste, devise) : 'Budget atteint'}
          note={`${fmt.montant(finance.availableFunds, devise)} disponibles`}
        />
      </div>

      {votrePart && (
        <section className="bloc fiche-projet__votre-part">
          <p className="fiche-projet__votre-part-libelle">{votrePart.libelle}</p>
          <p className="fiche-projet__votre-part-montant">{votrePart.montant}</p>
          {votrePart.note && <p className="fiche-projet__votre-part-note">{votrePart.note}</p>}
        </section>
      )}

      <section className="bloc">
        <div className="bloc__entete">
          <h2 className="bloc__titre">D’où vient l’argent</h2>
          <p className="bloc__sous-titre">Des totaux par origine, jamais le nom d’un donateur</p>
        </div>
        <dl className="fiche projet-benevole__fiche">
          <LigneFiche terme="Dons affectés au projet">
            {fmt.montant(finance.designatedTotal, devise)}
            {finance.donationsCount > 0 ? ` (${finance.donationsCount} don${finance.donationsCount > 1 ? 's' : ''})` : ''}
          </LigneFiche>
          <LigneFiche terme="Fonds de HOPE">{fmt.montant(finance.investedHopeTotal, devise)}</LigneFiche>
          <LigneFiche terme="Affecté par les partenaires">
            {fmt.montant(finance.partenairesTotal, devise)}
            {finance.partenairesNombre > 0
              ? ` (${finance.partenairesNombre} partenaire${finance.partenairesNombre > 1 ? 's' : ''})`
              : ''}
          </LigneFiche>
          <LigneFiche terme="Fonds disponibles">{fmt.montant(finance.availableFunds, devise)}</LigneFiche>
        </dl>
      </section>

      <section className="bloc">
        <div className="bloc__entete">
          <h2 className="bloc__titre">Dépenses par poste</h2>
          <p className="bloc__sous-titre">
            {totalDepenses > 0 ? `${fmt.montant(totalDepenses, devise)} au total` : 'Aucune dépense'}
          </p>
        </div>
        {depenses.length > 0 ? (
          <BarreRepartition
            cleLibelle="categorie"
            lignes={depenses.map((d) => ({
              categorie: d.categorie,
              part: totalDepenses > 0 ? Math.round((Number(d.total) * 1000) / totalDepenses) / 10 : 0,
              montant: d.total,
            }))}
          />
        ) : (
          <p className="bloc__vide">Aucune dépense n’est encore enregistrée sur ce projet.</p>
        )}
      </section>
    </>
  );
}

export function OngletImpact({ impacts, synthese, indicateurs }) {
  const generaux = impacts.filter((impact) => !impact.objectiveId);
  const parObjectif = impacts.filter((impact) => impact.objectiveId);

  return (
    <>
      {synthese.length > 0 && (
        <div className="cartes-chiffres">
          {synthese.map((ligne) => (
            <div className="carte-chiffre carte-chiffre--impact" key={`${ligne.indicator}|${ligne.unit ?? ''}`}>
              <p className="carte-chiffre__libelle">{fmt.libelleIndicateur(ligne.indicator, indicateurs)}</p>
              <p className="carte-chiffre__valeur">
                {fmt.nombre(ligne.total)}
                {ligne.unit && <span className="carte-chiffre__unite">{ligne.unit}</span>}
              </p>
              <p className="carte-chiffre__variation">{fmt.nombre(ligne.entriesCount)} mesure(s)</p>
            </div>
          ))}
        </div>
      )}

      <section className="bloc">
        <div className="bloc__entete">
          <h2 className="bloc__titre">Impact général du projet</h2>
          <p className="bloc__sous-titre">Ce que le projet a produit dans son ensemble</p>
        </div>
        {generaux.length > 0 ? (
          <div className="impact-texte">
            {generaux.map((impact) => (
              <p className="impact-texte__paragraphe" key={impact.id}>
                <strong className="impact-texte__titre">{impact.title}</strong>
                {' : '}
                <strong className="impact-texte__valeur">
                  {fmt.nombre(impact.value)}
                  {impact.unit ? ` ${impact.unit}` : ''}
                </strong>
                <span className="impact-texte__date">, mesuré le {fmt.date(impact.measuredAt)}.</span>
                {impact.description && ` ${impact.description}`}
              </p>
            ))}
          </div>
        ) : (
          <p className="bloc__vide">Aucun impact général n’a encore été mesuré.</p>
        )}
      </section>

      <section className="bloc">
        <div className="bloc__entete">
          <h2 className="bloc__titre">Mesures par objectif</h2>
          <p className="bloc__sous-titre">Chaque mesure, et l’objectif qu’elle documente</p>
        </div>
        {parObjectif.length > 0 ? (
          <div className="table-enveloppe">
            <table className="table table--empilable">
              <thead>
                <tr>
                  <th className="table__centre">Impact</th>
                  <th className="table__centre">Objectif</th>
                  <th className="table__centre">Valeur</th>
                  <th className="table__centre">Mesuré le</th>
                </tr>
              </thead>
              <tbody>
                {parObjectif.map((impact) => (
                  <tr key={impact.id}>
                    <td className="table__centre" data-libelle="Impact">
                      <div className="table__principal">{impact.title}</div>
                      {impact.description && (
                        <div className="table__secondaire">{fmt.tronquer(impact.description, 70)}</div>
                      )}
                    </td>
                    <td className="table__centre" data-libelle="Objectif">
                      {impact.objectiveLabel}
                    </td>
                    <td className="table__centre" data-libelle="Valeur">
                      <strong>
                        {fmt.nombre(impact.value)} {impact.unit ?? ''}
                      </strong>
                    </td>
                    <td className="table__centre" data-libelle="Mesuré le">
                      {fmt.date(impact.measuredAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="bloc__vide">Aucune mesure n’est encore rattachée à un objectif.</p>
        )}
      </section>
    </>
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
