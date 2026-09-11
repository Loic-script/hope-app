import { useChargement } from '../../hooks/useChargement.js';
import * as service from '../../services/bailleur.service.js';
import * as fmt from '../../utils/format.js';
import { EntetePage, Panneau, Pastille } from './composants.jsx';

/** Les trois natures de preuve. */
const TYPES = { PHOTO: 'Photo', DOCUMENT: 'Document', TESTIMONY: 'Témoignage' };

/**
 * Preuves terrain des projets finances.
 *
 * Elles ne sont pas saisies ici : elles remontent du back-office et
 * sont filtrees par les affectations du bailleur. Le fichier lui-meme
 * reste derriere le jeton de l'espace administrateur ; cet ecran en
 * montre la fiche, pas le contenu.
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
            <ul className="liste-preuves">
              {preuves.map((preuve) => (
                <li key={preuve.id} className="preuve-part">
                  <div className="preuve-part__haut">
                    <Pastille teinte={preuve.proofType === 'TESTIMONY' ? 'violet' : 'bleu'}>
                      {TYPES[preuve.proofType] ?? preuve.proofType}
                    </Pastille>
                    <span className="preuve-part__date">
                      {fmt.date(preuve.occurredOn ?? preuve.createdAt)}
                    </span>
                  </div>

                  {preuve.description && <p className="preuve-part__texte">{preuve.description}</p>}

                  <p className="preuve-part__meta">
                    {preuve.location && <>{preuve.location} · </>}
                    {preuve.fileName ?? 'Sans fichier joint'}
                  </p>
                </li>
              ))}
            </ul>
          </Panneau>
        ))
      )}
    </>
  );
}
