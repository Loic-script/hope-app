import { useState } from 'react';

import FenetreTache, { COULEURS_TACHE, STATUTS_TACHE } from '../../components/admin/FenetreTache.jsx';
import { TacheModale } from '../../components/admin/modales.jsx';
import {
  Alerte,
  Badge,
  BoutonAjout,
  EntetePage,
  EtatVide,
  Onglets,
  Panneau,
  Tableau,
} from '../../components/admin/ui.jsx';
import Visage from '../../components/admin/Visage.jsx';
import { useChargement } from '../../hooks/useChargement.js';
import * as projectService from '../../services/project.service.js';
import * as taskService from '../../services/task.service.js';
import * as fmt from '../../utils/format.js';
import { delaiRestant, LIBELLES_PRIORITE, TEINTES_PRIORITE } from '../../utils/priorites.js';

/** Les onglets, et le filtre que chacun envoie au serveur. */
const FILTRES = {
  toutes: {},
  demandes: { demandes: '1' },
  a_faire: { statut: 'a_faire' },
  en_cours: { statut: 'en_cours' },
  livree: { statut: 'livree' },
};

/**
 * Toutes les taches, tous projets confondus.
 *
 * L'onglet de chaque projet ne montre que les siennes ; ici l'equipe voit
 * d'un coup ce qui attend une decision -- les demandes des benevoles --
 * ce qui n'a encore personne, et ce qui avance. Un clic sur une tache
 * ouvre sa fenetre : equipe, demandes, preuve.
 */
export default function TachesPage() {
  const [filtre, setFiltre] = useState('toutes');
  const [ouverte, setOuverte] = useState(null);
  const [ajout, setAjout] = useState(false);

  const { donnees, chargement, erreur, recharger } = useChargement(
    () => taskService.listerTout(FILTRES[filtre]),
    [filtre]
  );

  /*
   * De quoi creer une tache d'ici : la liste des projets -- il faut bien
   * en choisir un -- et celle des benevoles affectables, pour poser
   * l'equipe tout de suite. Chargees une fois, a l'ouverture de la page.
   */
  const { donnees: projets } = useChargement(
    () => projectService.lister({ status: 'IN_PROGRESS', pageSize: 200 }),
    []
  );
  const { donnees: benevoles } = useChargement(() => taskService.benevoles(), []);

  const taches = donnees?.items ?? [];
  const compteurs = donnees?.counts ?? {};

  const onglets = [
    { cle: 'toutes', label: 'Toutes', compteur: compteurs.toutes ?? 0 },
    { cle: 'demandes', label: 'Demandes à valider', compteur: compteurs.demandes ?? 0 },
    { cle: 'a_faire', label: 'À faire', compteur: compteurs.aFaire ?? 0 },
    { cle: 'en_cours', label: 'En cours', compteur: compteurs.enCours ?? 0 },
    { cle: 'livree', label: 'Livrées', compteur: compteurs.livree ?? 0 },
  ];

  return (
    <>
      <EntetePage
        fil={[{ label: 'Accueil', to: '/admin' }, { label: 'Tâches' }]}
        titre="Tâches"
        accroche="Les tâches de tous les projets, leur équipe, et les demandes des bénévoles à valider. Les plus urgentes d’abord."
        actions={<BoutonAjout onClick={() => setAjout(true)}>Ajouter une tâche</BoutonAjout>}
      />

      {erreur && <Alerte>{erreur}</Alerte>}

      <Panneau>
        <Onglets onglets={onglets} actif={filtre} onChange={setFiltre} />

        <Tableau
          chargement={chargement && !donnees}
          lignes={taches}
          cleLigne={(tache) => tache.id}
          onLigne={(tache) => setOuverte(tache.id)}
          colonnes={[
            {
              cle: 'titre',
              titre: 'Tâche',
              // La colonne qui porte le texte : tout ce qui reste de
              // largeur lui revient.
              largeur: '30%',
              rendu: (tache) => (
                <div>
                  <button
                    type="button"
                    className="table__principal lien-tache"
                    onClick={() => setOuverte(tache.id)}
                    aria-haspopup="dialog"
                  >
                    {tache.titre}
                  </button>
                  <div className="table__secondaire">{tache.projetNom}</div>
                </div>
              ),
            },
            {
              cle: 'priorite',
              titre: 'Priorité',
              aligne: 'centre',
              largeur: '110px',
              rendu: (tache) => (
                <Badge
                  valeur={tache.priorite ?? 'moyenne'}
                  libelles={LIBELLES_PRIORITE}
                  couleur={TEINTES_PRIORITE[tache.priorite ?? 'moyenne']}
                />
              ),
            },
            {
              cle: 'echeance',
              titre: 'Date de fin',
              aligne: 'centre',
              // La date tient sur une ligne, le delai sur la suivante :
              // 175 px evitent que les deux se coupent en trois.
              largeur: '175px',
              rendu: (tache) => <DateDeFin tache={tache} />,
            },
            {
              cle: 'equipeTaille',
              titre: 'Équipe voulue',
              aligne: 'centre',
              largeur: '120px',
              rendu: (tache) => tailleVoulue(tache),
            },
            {
              cle: 'statut',
              titre: 'Statut',
              aligne: 'centre',
              largeur: '110px',
              rendu: (tache) => (
                <Badge valeur={tache.statut} libelles={STATUTS_TACHE} couleur={COULEURS_TACHE[tache.statut]} />
              ),
            },
            {
              cle: 'equipe',
              titre: 'Équipe',
              largeur: '210px',
              rendu: (tache) => <EquipeEnBref equipe={tache.equipe} />,
            },
            {
              cle: 'demandes',
              titre: 'Demandes',
              aligne: 'centre',
              largeur: '120px',
              rendu: (tache) =>
                tache.demandes.length > 0 ? (
                  <Badge
                    valeur="demandes"
                    libelles={{ demandes: `${tache.demandes.length} à valider` }}
                    couleur="ambre"
                  />
                ) : (
                  '—'
                ),
            },
          ]}
          vide={
            <EtatVide
              titre={filtre === 'demandes' ? 'Aucune demande à valider' : 'Aucune tâche'}
              texte={
                filtre === 'demandes'
                  ? 'Quand un bénévole demande une tâche, elle apparaît ici.'
                  : 'Créez-en une avec le bouton « Ajouter une tâche », ou depuis l’onglet Tâches d’un projet.'
              }
            />
          }
        />
      </Panneau>

      {ouverte && (
        <FenetreTache tacheId={ouverte} lienProjet onFermer={() => setOuverte(null)} onChange={recharger} />
      )}

      <TacheModale
        ouverte={ajout}
        projets={projets?.items ?? []}
        benevoles={benevoles ?? []}
        onFermer={() => setAjout(false)}
        onEnregistre={() => {
          setAjout(false);
          recharger();
        }}
      />
    </>
  );
}

/** Les visages de l'equipe, serres ; au-dela de quatre, un compte. */
export function EquipeEnBref({ equipe = [] }) {
  if (equipe.length === 0) return <span className="budget__hors">Personne</span>;
  const nom = (p) => `${p.prenom ?? ''} ${p.nom ?? ''}`.trim();
  return (
    <span className="equipe-bref" title={equipe.map(nom).join(', ')}>
      {equipe.slice(0, 4).map((p) => (
        <Visage key={p.benevoleId} src={p.photoUrl} nom={nom(p)} />
      ))}
      {equipe.length > 4 && <span className="equipe-bref__plus">+{equipe.length - 4}</span>}
      {equipe.length === 1 && <span className="equipe-bref__nom">{nom(equipe[0])}</span>}
    </span>
  );
}

/**
 * La date de fin, et ce qu'il en reste.
 *
 * Le seul jour ne dit pas s'il presse : "12/10" demande un calcul,
 * "A rendre dans 2 jours" non. Les deux se lisent donc ensemble.
 */
function DateDeFin({ tache }) {
  if (!tache.echeance) return '—';
  const delai = delaiRestant(tache.echeance, tache.statut);

  return (
    <div>
      <div className="table__principal">{fmt.date(tache.echeance)}</div>
      {delai && (
        <div className={`table__secondaire${delai.pressant ? ' table__secondaire--alerte' : ''}`}>
          {/* "À rendre dans 88 jours" tiendrait sur trois lignes dans une
              colonne de tableau : le verbe est deja dans l entete. */}
          {delai.texte.replace('À rendre ', '')}
        </div>
      )}
    </div>
  );
}

/** "2 à 4", "au moins 2", "au plus 4" : la taille d'equipe voulue. */
function tailleVoulue({ benevolesMin, benevolesMax }) {
  if (benevolesMin && benevolesMax) return `${benevolesMin} à ${benevolesMax}`;
  if (benevolesMin) return `au moins ${benevolesMin}`;
  if (benevolesMax) return `au plus ${benevolesMax}`;
  return '—';
}
