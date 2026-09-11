import { useChargement } from '../../hooks/useChargement.js';
import * as service from '../../services/bailleur.service.js';
import * as fmt from '../../utils/format.js';
import {
  ChaineEngagement,
  EntetePage,
  Panneau,
  Pastille,
  STATUTS_ENGAGEMENT,
  STATUTS_VERSEMENT,
  TEINTES_VERSEMENT,
  TYPES_SOUTIEN,
} from './composants.jsx';

/**
 * Page Partenariat : les engagements, regroupes par nature de soutien.
 *
 * La barre de progression ne se lit pas de la meme facon selon le type.
 * Pour un financement, elle rapporte le verse au promis ; pour un
 * mecenat de competences ou un don materiel, la quantite realisee a la
 * quantite engagee. Confondre les deux ferait afficher 0 % a un
 * partenaire qui a deja tenu la moitie de sa parole.
 */
export default function Partenariat() {
  const { donnees, chargement, erreur } = useChargement(() => service.partenariat(), []);

  if (chargement && !donnees) {
    return <p className="vide-bailleur">Chargement de vos engagements…</p>;
  }
  if (erreur) return <p className="alerte-bailleur">{erreur}</p>;

  const groupes = (donnees?.groupes ?? []).filter((g) => g.engagements.length > 0);

  return (
    <>
      <EntetePage
        titre="Partenariat"
        accroche="Vos engagements avec HOPE, et où en est chacun d’eux."
      />

      {groupes.length === 0 ? (
        <p className="vide-bailleur">
          Aucun engagement enregistré. L’équipe HOPE saisit les conventions signées et elles
          apparaîtront ici.
        </p>
      ) : (
        groupes.map((groupe) => (
          <section key={groupe.type} className="groupe">
            <h2 className="groupe__titre">
              {TYPES_SOUTIEN[groupe.type]}
              <span className="groupe__compte">{groupe.engagements.length}</span>
            </h2>

            {groupe.engagements.map((engagement) => (
              <CarteEngagement key={engagement.id} engagement={engagement} />
            ))}
          </section>
        ))
      )}
    </>
  );
}

/** Un engagement, sa progression, ses versements et ses affectations. */
function CarteEngagement({ engagement }) {
  const financier = engagement.typeSoutien === 'financier';

  return (
    <article className="engagement">
      <header className="engagement__entete">
        <div>
          <h3 className="engagement__titre">{engagement.intitule}</h3>
          <p className="engagement__meta">
            {engagement.referenceConvention && <>Convention {engagement.referenceConvention} · </>}
            signée le {fmt.date(engagement.dateSignature)}
            {engagement.dateFin && <> · jusqu’au {fmt.date(engagement.dateFin)}</>}
          </p>
        </div>
        <div className="engagement__jetons">
          <Pastille teinte={engagement.statut === 'en_cours' ? 'bleu' : 'gris'}>
            {STATUTS_ENGAGEMENT[engagement.statut]}
          </Pastille>
          {engagement.affectationLibre && (
            <Pastille teinte="violet">HOPE choisit les projets</Pastille>
          )}
        </div>
      </header>

      {financier ? (
        <ChaineEngagement
          promis={engagement.montantEngage}
          recu={engagement.montantRecu}
          affecte={engagement.montantAffecte}
          devise={engagement.devise}
        />
      ) : (
        <div className="quantite">
          <div className="quantite__chiffres">
            <strong>
              {fmt.nombre(engagement.quantiteRealisee, 0)} / {fmt.nombre(engagement.quantiteEngagee, 0)}
            </strong>
            <span>
              {engagement.unite}
              {Number(engagement.quantiteEngagee) > 1 ? 's' : ''} réalisée
              {Number(engagement.quantiteRealisee) > 1 ? 's' : ''}
            </span>
          </div>
          <div className="quantite__rail">
            <span
              className="quantite__plein"
              style={{ width: `${Math.min(100, engagement.avancement)}%` }}
            />
          </div>
          {engagement.valorisation && (
            <p className="quantite__valorisation">
              Valorisation estimée : {fmt.montant(engagement.valorisation)}
            </p>
          )}
        </div>
      )}

      {financier && engagement.resteAAffecter > 0 && (
        <p className="engagement__reste">
          {fmt.montant(engagement.resteAAffecter)} restent à attribuer à des projets.
        </p>
      )}

      <div className="engagement__details">
        {engagement.versements.length > 0 && (
          <div className="engagement__bloc">
            <h4 className="engagement__sous-titre">Versements</h4>
            <ul className="lignes">
              {engagement.versements.map((versement) => (
                <li key={versement.id} className="ligne">
                  <div className="ligne__gauche">
                    <strong>{fmt.montant(versement.montant, versement.devise)}</strong>
                    <span className="ligne__meta">
                      {versement.numeroTranche ? `Tranche ${versement.numeroTranche}` : 'Versement'}
                      {versement.moyen && ` · ${versement.moyen}`}
                      {versement.referenceBancaire && ` · ${versement.referenceBancaire}`}
                    </span>
                  </div>
                  <div className="ligne__droite">
                    <Pastille teinte={TEINTES_VERSEMENT[versement.statut]}>
                      {STATUTS_VERSEMENT[versement.statut]}
                    </Pastille>
                    <span className="ligne__date">
                      {versement.dateRecue
                        ? fmt.date(versement.dateRecue)
                        : versement.datePrevue
                          ? `prévu le ${fmt.date(versement.datePrevue)}`
                          : '—'}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {engagement.affectations.length > 0 && (
          <div className="engagement__bloc">
            <h4 className="engagement__sous-titre">Projets financés</h4>
            <ul className="lignes">
              {engagement.affectations.map((affectation) => (
                <li key={affectation.id} className="ligne">
                  <div className="ligne__gauche">
                    <strong>{affectation.projetNom}</strong>
                    {affectation.commentaire && (
                      <span className="ligne__meta">{affectation.commentaire}</span>
                    )}
                  </div>
                  <span className="ligne__date">{fmt.montant(affectation.montant)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </article>
  );
}
