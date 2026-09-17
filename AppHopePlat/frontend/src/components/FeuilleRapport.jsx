/**
 * Un rapport, mis en page comme le document imprime.
 *
 * Bandeau de la charte, titre, periode, puis les sections telles qu'elles
 * sont redigees. Le contenu arrive en blocs -- le vocabulaire dont le PDF
 * est compose -- et rien d'autre : ce composant ne charge rien, il sert
 * aussi bien l'apercu du partenaire que l'onglet Rapport de la fiche
 * projet.
 *
 * @param {{ titre: string, sousTitre?: string, blocs: Array|null,
 *           pied?: string, pleine?: boolean }} props
 *   pleine : la feuille prend sa hauteur naturelle au lieu de defiler
 *   dans une fenetre.
 */
export default function FeuilleRapport({ titre, sousTitre, blocs, pied, pleine = false }) {
  return (
    <article className={`feuille${pleine ? ' feuille--pleine' : ''}`}>
      <header className="feuille__bandeau">
        <span className="feuille__marque">HOPE</span>
        <span className="feuille__signature">Hope for a Better Life — Madagascar</span>
      </header>

      <div className="feuille__corps">
        <h3 className="feuille__titre">{titre}</h3>
        {sousTitre && <p className="feuille__soustitre">{sousTitre}</p>}

        {blocs ? (
          blocs.map((bloc, index) => <Bloc key={index} bloc={bloc} />)
        ) : (
          <p className="feuille__note">
            Ce document n’a pas de version lisible en ligne. Téléchargez-le pour le consulter.
          </p>
        )}

        {pied && <p className="feuille__pied">{pied}</p>}
      </div>
    </article>
  );
}

/**
 * Un bloc du document : titre de section, paragraphe, puce, ou tableau
 * de deux colonnes pour les chiffres.
 */
function Bloc({ bloc }) {
  if (bloc.t === 'h2') return <h4 className="feuille__section">{bloc.texte}</h4>;
  if (bloc.t === 'p') return <p className="feuille__paragraphe">{bloc.texte}</p>;
  if (bloc.t === 'puce') {
    return (
      <p className="feuille__puce">
        <span aria-hidden="true">•</span>
        {bloc.texte}
      </p>
    );
  }
  if (bloc.t === 'kv') {
    return (
      <dl className="feuille__chiffres">
        {(bloc.lignes ?? []).map(([libelle, valeur], index) => (
          <div className="feuille__chiffre" key={index}>
            <dt>{libelle}</dt>
            <dd>{valeur}</dd>
          </div>
        ))}
      </dl>
    );
  }
  return null;
}
