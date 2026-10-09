import { useState } from 'react';
import { Link } from 'react-router-dom';

import { ModaleConfirmation } from '../../components/admin/forms.jsx';
import { PreuveModale } from '../../components/admin/modales.jsx';
import {
  Alerte,
  Badge,
  BoutonAjout,
  Chargement,
  EntetePage,
  EtatVide,
  Panneau,
} from '../../components/admin/ui.jsx';
import VignettePreuve from '../../components/admin/VignettePreuve.jsx';
import { useChargement, useSoumission } from '../../hooks/useChargement.js';
import * as catalogService from '../../services/catalog.service.js';
import * as fieldProofService from '../../services/fieldProof.service.js';
import * as projectService from '../../services/project.service.js';
import * as fmt from '../../utils/format.js';

export default function ProofsPage() {
  const [aSupprimer, setASupprimer] = useState(null);
  const [aPublier, setAPublier] = useState({ ouverte: false, projet: null });

  const { donnees, chargement, erreur, recharger } = useChargement(
    () => fieldProofService.lister(),
    []
  );
  const { donnees: projets } = useChargement(() => projectService.lister({ pageSize: 200 }), []);
  const { donnees: catalogue } = useChargement(() => catalogService.recuperer(), []);
  const TYPES = catalogue?.labels?.proofType ?? {};

  const { envoi, erreur: erreurAction, soumettre } = useSoumission();

  const preuves = donnees?.items ?? [];
  const stats = donnees?.stats;
  const silencieux = donnees?.silentProjects ?? [];
  const seuil = donnees?.silenceThresholdDays ?? 15;

  function documenter(projet) {
    setAPublier({ ouverte: true, projet });
  }

  const projetsOuverts = (projets?.items ?? []).filter(
    (projet) => projet.status !== 'ARCHIVED'
  );

  async function supprimer() {
    await soumettre(() => fieldProofService.supprimer(aSupprimer.id), {
      onSucces: () => {
        setASupprimer(null);
        recharger();
      },
    });
  }

  return (
    <>
      <EntetePage
        fil={[{ label: 'Back-office' }]}
        titre="Preuves terrain"
        accroche="Une photo et deux lignes suffisent — c’est ce qui alimentera le suivi de don de chaque donateur et de chaque bailleur."
        actions={
          <BoutonAjout onClick={() => setAPublier({ ouverte: true, projet: null })}>
            Ajouter une preuve
          </BoutonAjout>
        }
      />

      {erreur && <Alerte>{erreur}</Alerte>}

      {stats && (
        <div className="cartes-chiffres">
          <div className="carte-chiffre">
            <p className="carte-chiffre__libelle">Preuves ce mois-ci</p>
            <p className="carte-chiffre__valeur">{fmt.nombre(stats.preuvesCeMois)}</p>
          </div>
          <div className="carte-chiffre">
            <p className="carte-chiffre__libelle">Contributeurs actifs</p>
            <p className="carte-chiffre__valeur">{fmt.nombre(stats.contributeursActifs)}</p>
          </div>
          <div className="carte-chiffre">
            <p className="carte-chiffre__libelle">Projets sans preuve · 15 j</p>
            <p className="carte-chiffre__valeur">{fmt.nombre(stats.projetsSansPreuve)}</p>
          </div>
          <div className="carte-chiffre">
            <p className="carte-chiffre__libelle">Délai moyen de publication</p>
            <p className="carte-chiffre__valeur">
              {stats.delaiMoyenJours === null ? '—' : `${stats.delaiMoyenJours} j`}
            </p>
          </div>
        </div>
      )}

      {silencieux.length > 0 && (
        <Panneau
          titre={`${silencieux.length} projet(s) sans preuve depuis plus de ${seuil} jours`}
          sousTitre="Un donateur qui revient voir son projet n’y trouverait rien de neuf."
        >
          <ul className="silence">
            {silencieux.map((projet) => (
              <li className="silence__ligne" key={projet.id}>
                <span className="silence__projet">
                  <Link to={`/admin/projects/${projet.id}`}>{projet.name}</Link>
                  <span className="silence__reference">{projet.reference}</span>
                </span>
                <span className="silence__duree">
                  {projet.lastProofAt
                    ? `dernière preuve il y a ${projet.daysSinceProof} jours`
                    : `aucune preuve depuis ${projet.daysSinceProof} jours`}
                </span>
                <button
                  type="button"
                  className="btn btn--neutre btn--petit"
                  onClick={() => documenter(projet)}
                >
                  Documenter
                </button>
              </li>
            ))}
          </ul>
        </Panneau>
      )}

      <Panneau titre="Preuves publiées récemment" sousTitre={`${preuves.length} preuve(s)`}>
          {chargement && !donnees ? (
            <Chargement texte="Chargement des preuves…" />
          ) : preuves.length === 0 ? (
            <EtatVide
              titre="Aucune preuve publiée"
              texte="Publiez la première : c’est elle qui montrera au donateur ce que son don a permis."
              action={
                <BoutonAjout onClick={() => setAPublier({ ouverte: true, projet: null })}>
                  Ajouter une preuve
                </BoutonAjout>
              }
            />
          ) : (
            <ul className="preuves">
              {preuves.map((preuve) => (
                <li className="preuve preuve--cliquable" key={preuve.id}>
                  <VignettePreuve preuve={preuve} />

                  <div className="preuve__corps">
                    <p className="preuve__projet">
                      <Link to={`/admin/projects/${preuve.projectId}`}>{preuve.projectName}</Link>
                      <Badge valeur={preuve.proofType} libelles={TYPES} />
                    </p>
                    <p className="preuve__description">
                      <Link className="preuve__lien" to={`/admin/proofs/${preuve.id}`}>
                        {preuve.description}
                      </Link>
                    </p>
                    <p className="preuve__signature">
                      {fmt.date(preuve.occurredOn)} · ajouté par {fmt.auteurPreuve(preuve)}
                    </p>
                  </div>

                  <button
                    type="button"
                    className="btn btn--neutre btn--petit preuve__action"
                    onClick={() => setASupprimer(preuve)}
                  >
                    Supprimer
                  </button>
                </li>
              ))}
            </ul>
          )}
      </Panneau>

      <PreuveModale
        ouverte={aPublier.ouverte}
        projet={aPublier.projet}
        projets={projetsOuverts}
        libelles={TYPES}
        onFermer={() => setAPublier({ ouverte: false, projet: null })}
        onEnregistre={() => {
          setAPublier({ ouverte: false, projet: null });
          recharger();
        }}
      />

      <ModaleConfirmation
        ouverte={aSupprimer !== null}
        titre="Supprimer cette preuve ?"
        message={
          aSupprimer
            ? `« ${fmt.tronquer(aSupprimer.description, 90)} » sera retirée, ainsi que ses ${aSupprimer.files?.length ?? 0} fichier(s).`
            : ''
        }
        libelleConfirmer="Supprimer"
        danger
        envoi={envoi}
        erreur={erreurAction}
        onFermer={() => setASupprimer(null)}
        onConfirmer={supprimer}
      />
    </>
  );
}
