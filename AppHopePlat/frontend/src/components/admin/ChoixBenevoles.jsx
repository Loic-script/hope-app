import { useMemo, useState } from 'react';

import { IconeRecherche, IconeValide } from './AdminIcons.jsx';
import { urlMedia } from '../../services/api.js';
import { initiales } from '../../utils/format.js';

/** Le nom d'un benevole, ou son adresse tant qu'il n'en a pas donne. */
export function nomBenevole(benevole) {
  if (!benevole) return '';
  return `${benevole.prenom ?? ''} ${benevole.nom ?? ''}`.trim() || benevole.email;
}

/** Sans accents ni casse : "Hery Rasolofo" se trouve en tapant "hery". */
function normaliser(texte) {
  return String(texte ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

/**
 * Choisir des benevoles : une liste de visages, pas une liste de mots.
 *
 * Une liste deroulante ne montre que des noms, et l'equipe HOPE en
 * compte des dizaines. Ici, chaque ligne porte le visage, le nom et ce
 * que la personne sait faire -- c'est la-dessus qu'on decide a qui
 * confier une tache. La recherche filtre sur les trois.
 *
 * Ceux qui sont deja choisis remontent en tete, coches : on les voit
 * sans faire defiler, et un second clic les retire.
 *
 * @param {{ benevoles: object[], choisis: string[],
 *           onBasculer: (benevoleId: string) => void,
 *           disabled?: boolean, competencesDemandees?: string[] }} proprietes
 */
export default function ChoixBenevoles({
  benevoles = [],
  choisis = [],
  onBasculer,
  disabled = false,
  competencesDemandees = [],
}) {
  const [recherche, setRecherche] = useState('');

  const demandees = useMemo(
    () => new Set(competencesDemandees.map((c) => normaliser(c))),
    [competencesDemandees]
  );

  const listes = useMemo(() => {
    const cherche = normaliser(recherche.trim());
    const correspond = (benevole) =>
      cherche === '' ||
      normaliser(nomBenevole(benevole)).includes(cherche) ||
      normaliser(benevole.email).includes(cherche) ||
      (benevole.competences ?? []).some((c) => normaliser(c).includes(cherche));

    const trouves = benevoles.filter(correspond);
    // Les choisis d'abord : on les garde sous les yeux.
    return [
      ...trouves.filter((b) => choisis.includes(b.benevoleId)),
      ...trouves.filter((b) => !choisis.includes(b.benevoleId)),
    ];
  }, [benevoles, choisis, recherche]);

  return (
    <div className="choix-personnes">
      <div className="choix-personnes__recherche">
        <IconeRecherche />
        <input
          type="search"
          value={recherche}
          onChange={(evenement) => setRecherche(evenement.target.value)}
          placeholder="Rechercher un bénévole, une compétence…"
          aria-label="Rechercher un bénévole"
          disabled={disabled}
        />
      </div>

      {listes.length === 0 ? (
        <p className="choix-personnes__vide">Aucun bénévole ne correspond.</p>
      ) : (
        <ul className="choix-personnes__liste">
          {listes.map((benevole) => {
            const choisi = choisis.includes(benevole.benevoleId);
            const nom = nomBenevole(benevole);
            const photo = benevole.photoUrl ? urlMedia(benevole.photoUrl) : null;
            const competences = benevole.competences ?? [];

            return (
              <li key={benevole.benevoleId}>
                <button
                  type="button"
                  className={`personne-choix${choisi ? ' personne-choix--choisie' : ''}`}
                  aria-pressed={choisi}
                  onClick={() => onBasculer(benevole.benevoleId)}
                  disabled={disabled}
                >
                  <span className="personne-choix__visage" aria-hidden="true">
                    {photo ? <img src={photo} alt="" loading="lazy" /> : initiales(nom)}
                  </span>

                  <span className="personne-choix__texte">
                    <span className="personne-choix__nom">{nom}</span>
                    <span className="personne-choix__detail">
                      {competences.length > 0 ? (
                        competences.slice(0, 4).map((competence) => (
                          <span
                            className={`personne-choix__competence${
                              demandees.has(normaliser(competence))
                                ? ' personne-choix__competence--demandee'
                                : ''
                            }`}
                            key={competence}
                          >
                            {competence}
                          </span>
                        ))
                      ) : (
                        <span className="personne-choix__competence">Aucune compétence déclarée</span>
                      )}
                    </span>
                  </span>

                  <span className="personne-choix__marque" aria-hidden="true">
                    {choisi && <IconeValide />}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
