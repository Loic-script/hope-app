import { useState } from 'react';

import { useChargement } from '../../hooks/useChargement.js';
import { messageErreur, urlMedia } from '../../services/api.js';
import * as service from '../../services/bailleur.service.js';
import * as fmt from '../../utils/format.js';
import { EntetePage, Pastille } from './composants.jsx';

/**
 * Fil d'actualite de l'espace partenaire.
 *
 * Deux natures de carte : l'actualite, purement informative, et l'appel
 * a financement, qui porte une barre de collecte et un bouton.
 *
 * Le bouton ne debite rien. Il enregistre une intention et previent
 * l'equipe, qui prend contact hors ligne et cree ensuite l'engagement
 * reel. L'ecran le dit explicitement : personne ne doit croire avoir
 * paye en cliquant.
 */
export default function Actualites() {
  const { donnees, chargement, erreur, recharger } = useChargement(() => service.fil(), []);
  const items = donnees ?? [];

  return (
    <>
      <EntetePage
        titre="Actualités"
        accroche="Les nouvelles de HOPE et les projets qui cherchent un partenaire."
      />

      {erreur && <p className="alerte-bailleur">{erreur}</p>}

      {chargement && items.length === 0 ? (
        <p className="vide-bailleur">Chargement du fil…</p>
      ) : items.length === 0 ? (
        <p className="vide-bailleur">Aucune publication pour l’instant.</p>
      ) : (
        <div className="fil">
          {items.map((publication) => (
            <Carte key={publication.id} publication={publication} onInteret={recharger} />
          ))}
        </div>
      )}
    </>
  );
}

/** Une carte du fil. */
function Carte({ publication, onInteret }) {
  const appel = publication.type === 'appel_financement';

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

  return (
    <article className={`actu${appel ? ' actu--appel' : ''}`}>
      <div className="actu__haut">
        <Pastille teinte={appel ? 'ambre' : 'bleu'}>
          {appel ? 'Appel à financement' : 'Actualité'}
        </Pastille>
        <span className="actu__date">{fmt.date(publication.publieLe)}</span>
      </div>

      {publication.mediaUrl && (
        <div className="actu__visuel">
          <img src={urlMedia(publication.mediaUrl)} alt="" loading="lazy" />
        </div>
      )}

      <h2 className="actu__titre">{publication.titre}</h2>
      {publication.projetNom && (
        <p className="actu__projet">{publication.projetNom}</p>
      )}
      {publication.corps && <p className="actu__corps">{publication.corps}</p>}

      {/*
        La barre suit le projet lie : la somme investie -- dons et fonds
        HOPE -- face a son budget, le meme chiffre que la page Projets.
        Un appel dont le projet a ete supprime n'a plus de barre.
      */}
      {appel && publication.avancement !== null && (
        <div className="collecte">
          <div className="collecte__chiffres">
            <strong>{fmt.montant(publication.montantFinance, publication.devise ?? 'MGA')}</strong>
            <span>
              de dons et de fonds HOPE, sur un budget de{' '}
              {fmt.montant(publication.budgetProjet, publication.devise ?? 'MGA')}
            </span>
          </div>
          <div className="collecte__rail">
            <span
              className="collecte__plein"
              style={{ width: `${Math.min(100, publication.avancement ?? 0)}%` }}
            />
          </div>
          <p className="collecte__reste">
            {publication.projetTermine
              ? 'Ce projet est terminé.'
              : publication.objectifAtteint
              ? 'Le budget de ce projet est atteint.'
              : `${fmt.montant(
                  Math.max(
                    0,
                    Number(publication.budgetProjet ?? 0) - Number(publication.montantFinance ?? 0)
                  ),
                  publication.devise ?? 'MGA'
                )} restent à financer`}
          </p>
        </div>
      )}

      {refus && <p className="alerte-bailleur">{refus}</p>}
      {confirmation && <p className="succes-bailleur">{confirmation}</p>}

      {/* Un budget atteint ou un projet termine ne cherche plus de
          partenaire : pas de bouton. Un interet deja exprime reste affiche. */}
      {appel &&
        !confirmation &&
        (publication.interetManifeste || !(publication.objectifAtteint || publication.projetTermine)) && (
        publication.interetManifeste ? (
          <p className="actu__deja">
            Votre intérêt est enregistré. L’équipe HOPE vous contacte pour formaliser le
            partenariat.
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
              Aucun montant ne sera débité. Vous manifestez un intérêt ; l’équipe HOPE vous
              contacte pour établir la convention.
            </p>
            <div className="interet__actions">
              <button
                type="button"
                className="bouton-bailleur"
                onClick={envoyer}
                disabled={envoi}
              >
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
        )
      )}
    </article>
  );
}
