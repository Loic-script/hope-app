import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { ModaleConfirmation } from '../../components/admin/forms.jsx';
import {
  Alerte,
  Badge,
  Chargement,
  EntetePage,
  EtatVide,
  Panneau,
} from '../../components/admin/ui.jsx';
import VignettePreuve from '../../components/admin/VignettePreuve.jsx';
import { Carrousel, Galerie } from '../../components/preuves/MediasPreuve.jsx';
import { useChargement, useSoumission } from '../../hooks/useChargement.js';
import * as catalogService from '../../services/catalog.service.js';
import * as fieldProofService from '../../services/fieldProof.service.js';
import * as fmt from '../../utils/format.js';

export default function ProofDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [aSupprimer, setASupprimer] = useState(false);

  const [rangOuvert, setRangOuvert] = useState(null);

  const { donnees: preuve, chargement, erreur } = useChargement(
    () => fieldProofService.recuperer(id),
    [id]
  );
  const { donnees: catalogue } = useChargement(() => catalogService.recuperer(), []);

  const { donnees: voisines } = useChargement(
    () => (preuve ? fieldProofService.listerParProjet(preuve.projectId) : Promise.resolve(null)),
    [preuve?.projectId]
  );

  const { envoi, erreur: erreurAction, soumettre } = useSoumission();

  const libelles = catalogue?.labels?.proofType ?? {};

  async function supprimer() {
    await soumettre(() => fieldProofService.supprimer(preuve.id), {
      onSucces: () => navigate('/admin/proofs', { replace: true }),
    });
  }

  if (chargement && !preuve) return <Chargement texte="Chargement de la preuve…" />;
  if (erreur) return <Alerte>{erreur}</Alerte>;
  if (!preuve) return null;

  const autres = (voisines?.items ?? []).filter((element) => element.id !== preuve.id);
  const fichiers = preuve.files ?? [];
  const poids = fichiers.reduce((total, fichier) => total + (fichier.fileSize ?? 0), 0);

  return (
    <>
      <EntetePage
        fil={[{ label: 'Preuves terrain', to: '/admin/proofs' }]}
        titre={preuve.projectName}
        accroche={`${fmt.date(preuve.occurredOn)} · ajouté par ${fmt.auteurPreuve(preuve)}`}
        actions={
          <>
            <Link
              className="btn btn--neutre"
              to={`/admin/projects/${preuve.projectId}?onglet=impact`}
            >
              Ouvrir le projet
            </Link>
            <button type="button" className="btn btn--neutre" onClick={() => setASupprimer(true)}>
              Supprimer
            </button>
          </>
        }
      />

      {erreurAction && <Alerte>{erreurAction}</Alerte>}

      <div className="lecture">
        <div className="lecture__principal">
          <Galerie
            preuve={preuve}
            charger={fieldProofService.urlDuFichier}
            onOuvrir={setRangOuvert}
          />

          <div className="lecture__entete">
            <Badge valeur={preuve.proofType} libelles={libelles} />
            <p className="lecture__description">{preuve.description}</p>
          </div>

          <dl className="lecture__fiche">
            <div>
              <dt>Projet</dt>
              <dd>
                <Link to={`/admin/projects/${preuve.projectId}?onglet=impact`}>
                  {preuve.projectName}
                </Link>
                <span className="lecture__discret"> · {preuve.projectReference}</span>
              </dd>
            </div>
            <div>
              <dt>Date de l’action</dt>
              <dd>{fmt.date(preuve.occurredOn)}</dd>
            </div>
            <div>
              <dt>Publiée le</dt>
              <dd>{fmt.date(preuve.createdAt)}</dd>
            </div>
            <div>
              <dt>Auteur</dt>
              <dd>
                {preuve.authorVolunteerAccount ? (
                  <Link
                    className="table__lien"
                    to={`/admin/utilisateurs/compte/${preuve.authorVolunteerAccount}?depuis=benevoles`}
                  >
                    {fmt.auteurPreuve(preuve)}
                  </Link>
                ) : (
                  fmt.auteurPreuve(preuve)
                )}
              </dd>
            </div>
            {fichiers.length > 0 && (
              <div>
                <dt>Fichiers</dt>
                <dd>
                  {fichiers.length} fichier(s)
                  <span className="lecture__discret"> · {fmt.tailleFichier(poids)}</span>
                </dd>
              </div>
            )}
          </dl>
        </div>

        <Panneau titre="Autres preuves du projet" sousTitre={`${autres.length} preuve(s)`}>
          {autres.length === 0 ? (
            <EtatVide
              titre="Aucune autre preuve"
              texte="C’est la seule preuve publiée pour ce projet."
            />
          ) : (
            <ul className="suggestions">
              {autres.map((voisine) => (
                <li className="suggestion" key={voisine.id}>
                  <VignettePreuve preuve={voisine} />
                  <div className="suggestion__corps">
                    <Link className="suggestion__lien" to={`/admin/proofs/${voisine.id}`}>
                      {fmt.tronquer(voisine.description, 70)}
                    </Link>
                    <p className="suggestion__signature">
                      {libelles[voisine.proofType] ?? voisine.proofType} ·{' '}
                      {fmt.date(voisine.occurredOn)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panneau>
      </div>

      {rangOuvert !== null && (
        <Carrousel
          preuve={preuve}
          charger={fieldProofService.urlDuFichier}
          rang={rangOuvert}
          onRang={setRangOuvert}
          onFermer={() => setRangOuvert(null)}
        />
      )}

      <ModaleConfirmation
        ouverte={aSupprimer}
        titre="Supprimer cette preuve ?"
        message={`« ${fmt.tronquer(preuve.description, 90)} » sera retirée, ainsi que ses ${fichiers.length} fichier(s).`}
        onFermer={() => setASupprimer(false)}
        onConfirmer={supprimer}
        envoi={envoi}
        erreur={erreurAction}
        libelleConfirmer="Supprimer"
        danger
      />
    </>
  );
}
