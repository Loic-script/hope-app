import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { Carrousel, Galerie, Vignette } from '../../components/preuves/MediasPreuve.jsx';
import { useChargement } from '../../hooks/useChargement.js';
import * as service from '../../services/bailleur.service.js';
import * as fmt from '../../utils/format.js';
import { EntetePage, Panneau, Pastille } from './composants.jsx';
import { TYPES } from './Preuves.jsx';

/**
 * Lecture d'une preuve, cote bailleur.
 *
 * Meme lecture que le back-office -- mosaique, puis carrousel -- moins
 * ce qui ne regarde pas un partenaire : l'auteur de la preuve et les
 * boutons qui la modifient.
 *
 * La preuve est cherchee dans la liste de l'espace plutot que demandee
 * une par une : cette liste ne porte que les projets finances, donc
 * l'adresse d'une preuve voisine ne mene nulle part. Une verification de
 * moins a ecrire, et une de moins a oublier.
 */
export default function PreuveDetail() {
  const { id } = useParams();
  const [rangOuvert, setRangOuvert] = useState(null);

  const { donnees, chargement, erreur } = useChargement(() => service.preuves(), []);
  const items = donnees ?? [];

  const preuve = items.find((element) => String(element.id) === String(id)) ?? null;

  if (chargement && items.length === 0) return <p className="vide-bailleur">Chargement…</p>;
  if (erreur) return <p className="alerte-bailleur">{erreur}</p>;

  if (!preuve) {
    return (
      <>
        <EntetePage
          titre="Preuve introuvable"
          accroche="Cette preuve n’existe pas, ou elle porte sur un projet que vous ne financez pas."
        />
        <Panneau>
          <p className="vide-bailleur">
            <Link to="/bailleur/preuves">Revenir aux preuves terrain</Link>
          </p>
        </Panneau>
      </>
    );
  }

  const autres = items.filter(
    (element) => element.projetId === preuve.projetId && element.id !== preuve.id
  );
  const fichiers = preuve.files ?? [];
  const poids = fichiers.reduce((total, fichier) => total + (fichier.fileSize ?? 0), 0);

  return (
    <>
      <EntetePage
        titre={preuve.projetNom}
        accroche={`${fmt.date(preuve.occurredOn ?? preuve.createdAt)}${
          preuve.location ? ` · ${preuve.location}` : ''
        }`}
        actions={
          <Link className="bouton-bailleur bouton-bailleur--discret" to="/bailleur/preuves">
            Toutes les preuves
          </Link>
        }
      />

      <div className="lecture">
        <div className="lecture__principal">
          <Galerie
            preuve={preuve}
            charger={service.urlDuFichierPreuve}
            onOuvrir={setRangOuvert}
          />

          {/* Ce qui decrit la preuve vient sous les images, comme sous
              une video : le propos d'abord, la fiche ensuite. */}
          <div className="lecture__entete">
            <Pastille teinte={preuve.proofType === 'TESTIMONY' ? 'violet' : 'bleu'}>
              {TYPES[preuve.proofType] ?? preuve.proofType}
            </Pastille>
            <p className="lecture__description">{preuve.description}</p>
          </div>

          <dl className="lecture__fiche">
            <div>
              <dt>Projet</dt>
              <dd>
                {preuve.projetNom}
                {preuve.projetReference && (
                  <span className="lecture__discret"> · {preuve.projetReference}</span>
                )}
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
            {preuve.location && (
              <div>
                <dt>Lieu</dt>
                <dd>{preuve.location}</dd>
              </div>
            )}
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

        {/* La colonne de droite : les autres preuves du meme projet. */}
        <Panneau titre="Autres preuves du projet" sousTitre={`${autres.length} preuve(s)`}>
          {autres.length === 0 ? (
            <p className="vide-bailleur">C’est la seule preuve publiée pour ce projet.</p>
          ) : (
            <ul className="suggestions">
              {autres.map((voisine) => (
                <li className="suggestion" key={voisine.id}>
                  <Vignette preuve={voisine} charger={service.urlDuFichierPreuve} />
                  <div className="suggestion__corps">
                    {/* Le lien s'etire sur toute la ligne via son ::after. */}
                    <Link className="suggestion__lien" to={`/bailleur/preuves/${voisine.id}`}>
                      {fmt.tronquer(voisine.description, 70)}
                    </Link>
                    <p className="suggestion__signature">
                      {TYPES[voisine.proofType] ?? voisine.proofType} ·{' '}
                      {fmt.date(voisine.occurredOn ?? voisine.createdAt)}
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
          charger={service.urlDuFichierPreuve}
          rang={rangOuvert}
          onRang={setRangOuvert}
          onFermer={() => setRangOuvert(null)}
        />
      )}
    </>
  );
}
