import { useMemo, useState } from 'react';

import FenetreTache, { COULEURS_TACHE, STATUTS_TACHE } from '../../components/admin/FenetreTache.jsx';
import { TacheModale } from '../../components/admin/modales.jsx';
import {
  Alerte,
  Badge,
  BarreOutils,
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

const FILTRES = {
  toutes: {},
  demandes: { demandes: '1' },
  a_faire: { statut: 'a_faire' },
  en_cours: { statut: 'en_cours' },
  livree: { statut: 'livree' },
};

export default function TachesPage() {
  const [filtre, setFiltre] = useState('toutes');
  const [recherche, setRecherche] = useState('');
  const [ouverte, setOuverte] = useState(null);
  const [ajout, setAjout] = useState(false);

  const { donnees, chargement, erreur, recharger } = useChargement(
    () => taskService.listerTout(FILTRES[filtre]),
    [filtre]
  );

  const { donnees: projets } = useChargement(
    () => projectService.lister({ status: 'IN_PROGRESS', pageSize: 200 }),
    []
  );
  const { donnees: benevoles } = useChargement(() => taskService.benevoles(), []);

  const toutes = useMemo(() => donnees?.items ?? [], [donnees]);
  const compteurs = donnees?.counts ?? {};

  const taches = useMemo(() => {
    const plier = (texte) =>
      String(texte ?? '')
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '')
        .toLowerCase();
    const mots = plier(recherche).split(/\s+/).filter(Boolean);
    if (mots.length === 0) return toutes;
    return toutes.filter((tache) => {
      const texte = plier(
        [
          tache.titre,
          tache.projetNom,
          LIBELLES_PRIORITE[tache.priorite],
          STATUTS_TACHE[tache.statut],
          ...(tache.equipe ?? []).map((p) => `${p.prenom ?? ''} ${p.nom ?? ''}`),
        ].join(' ')
      );
      return mots.every((mot) => texte.includes(mot));
    });
  }, [toutes, recherche]);

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

        <BarreOutils
          recherche={recherche}
          onRecherche={setRecherche}
          placeholder="Rechercher une tâche, un projet, un bénévole…"
          compteur={recherche.trim() ? `${taches.length} sur ${toutes.length}` : `${toutes.length} tâche(s)`}
        />

        <Tableau
          chargement={chargement && !donnees}
          lignes={taches}
          cleLigne={(tache) => tache.id}
          onLigne={(tache) => setOuverte(tache.id)}
          colonnes={[
            {
              cle: 'titre',
              titre: 'Tâche',
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
              titre={
                recherche.trim() && toutes.length > 0
                  ? 'Aucune tâche ne correspond'
                  : filtre === 'demandes'
                    ? 'Aucune demande à valider'
                    : 'Aucune tâche'
              }
              texte={
                recherche.trim() && toutes.length > 0
                  ? 'Essayez un autre mot : titre, projet, bénévole, priorité ou statut.'
                  : filtre === 'demandes'
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

function DateDeFin({ tache }) {
  if (!tache.echeance) return '—';
  const delai = delaiRestant(tache.echeance, tache.statut);

  return (
    <div>
      <div className="table__principal">{fmt.date(tache.echeance)}</div>
      {delai && (
        <div className={`table__secondaire${delai.pressant ? ' table__secondaire--alerte' : ''}`}>
          {delai.texte.replace('À rendre ', '')}
        </div>
      )}
    </div>
  );
}

function tailleVoulue({ benevolesMin, benevolesMax }) {
  if (benevolesMin && benevolesMax) return `${benevolesMin} à ${benevolesMax}`;
  if (benevolesMin) return `au moins ${benevolesMin}`;
  if (benevolesMax) return `au plus ${benevolesMax}`;
  return '—';
}
