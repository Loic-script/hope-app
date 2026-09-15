import { Link } from 'react-router-dom';

import { Vignette } from '../../components/preuves/MediasPreuve.jsx';
import { useChargement } from '../../hooks/useChargement.js';
import * as service from '../../services/bailleur.service.js';
import * as fmt from '../../utils/format.js';
import { EntetePage, Panneau, Pastille } from './composants.jsx';

/** Les natures de preuve, et la teinte de leur pastille. */
export const TYPES = {
  PHOTO: 'Photo',
  VIDEO: 'Vidéo',
  DOCUMENT: 'Document',
  TESTIMONY: 'Témoignage',
};

/**
 * Preuves terrain des projets finances.
 *
 * Elles ne sont pas saisies ici : elles remontent du back-office et sont
 * filtrees par les affectations du bailleur -- un partenaire voit ce que
 * ses projets ont produit, pas ceux des autres.
 *
 * L'ecran montrait la fiche d'une preuve sans jamais son contenu : le
 * nom du fichier, et rien de plus. Il montre desormais les images
 * elles-memes, comme le back-office, puisque c'est precisement ce qu'un
 * bailleur vient chercher.
 */
export default function Preuves() {
  const { donnees, chargement, erreur } = useChargement(() => service.preuves(), []);
  const items = donnees ?? [];

  // Regroupees par projet : c'est ainsi que le bailleur les lit.
  const parProjet = items.reduce((groupes, preuve) => {
    const cle = preuve.projetNom ?? 'Projet inconnu';
    groupes[cle] = groupes[cle] ?? [];
    groupes[cle].push(preuve);
    return groupes;
  }, {});

  return (
    <>
      <EntetePage
        titre="Preuves terrain"
        accroche="Ce que les équipes ont constaté sur les projets que vous financez."
      />

      {erreur && <p className="alerte-bailleur">{erreur}</p>}

      {chargement && items.length === 0 ? (
        <p className="vide-bailleur">Chargement…</p>
      ) : items.length === 0 ? (
        <Panneau>
          <p className="vide-bailleur">
            Aucune preuve publiée pour l’instant. Les équipes documentent le terrain au fil des
            actions et les preuves des projets que vous financez apparaîtront ici.
          </p>
        </Panneau>
      ) : (
        Object.entries(parProjet).map(([projet, preuves]) => (
          <Panneau
            key={projet}
            titre={projet}
            sousTitre={`${preuves.length} preuve${preuves.length > 1 ? 's' : ''}`}
          >
            <ul className="preuves">
              {preuves.map((preuve) => (
                <LignePreuve key={preuve.id} preuve={preuve} />
              ))}
            </ul>
          </Panneau>
        ))
      )}
    </>
  );
}

/**
 * Une preuve dans la liste.
 *
 * Le lien de la description s'etire sur toute la ligne via son ::after :
 * la vignette ouvre la lecture elle aussi, sans qu'il faille viser le
 * texte.
 */
function LignePreuve({ preuve }) {
  return (
    <li className="preuve preuve--cliquable">
      <Vignette preuve={preuve} charger={service.urlDuFichierPreuve} />

      <div className="preuve__corps">
        <p className="preuve__projet">
          <Pastille teinte={preuve.proofType === 'TESTIMONY' ? 'violet' : 'bleu'}>
            {TYPES[preuve.proofType] ?? preuve.proofType}
          </Pastille>
        </p>
        <p className="preuve__description">
          <Link className="preuve__lien" to={`/bailleur/preuves/${preuve.id}`}>
            {preuve.description}
          </Link>
        </p>
        <p className="preuve__signature">
          {fmt.date(preuve.occurredOn ?? preuve.createdAt)}
          {preuve.location ? ` · ${preuve.location}` : ''}
          {preuve.files?.length > 0
            ? ` · ${preuve.files.length} fichier${preuve.files.length > 1 ? 's' : ''}`
            : ''}
        </p>
      </div>
    </li>
  );
}
