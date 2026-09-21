import { useState } from 'react';

import FenetreTache, { COULEURS_TACHE, STATUTS_TACHE } from '../../components/admin/FenetreTache.jsx';
import {
  Alerte,
  Badge,
  EntetePage,
  EtatVide,
  Onglets,
  Panneau,
  Tableau,
} from '../../components/admin/ui.jsx';
import Visage from '../../components/admin/Visage.jsx';
import { useChargement } from '../../hooks/useChargement.js';
import * as taskService from '../../services/task.service.js';
import * as fmt from '../../utils/format.js';

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

  const { donnees, chargement, erreur, recharger } = useChargement(
    () => taskService.listerTout(FILTRES[filtre]),
    [filtre]
  );

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
        accroche="Les tâches de tous les projets, leur équipe, et les demandes des bénévoles à valider."
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
              cle: 'echeance',
              titre: 'Échéance',
              rendu: (tache) => (tache.echeance ? fmt.date(tache.echeance) : '—'),
            },
            {
              cle: 'statut',
              titre: 'Statut',
              rendu: (tache) => (
                <Badge valeur={tache.statut} libelles={STATUTS_TACHE} couleur={COULEURS_TACHE[tache.statut]} />
              ),
            },
            {
              cle: 'equipe',
              titre: 'Équipe',
              rendu: (tache) => <EquipeEnBref equipe={tache.equipe} />,
            },
            {
              cle: 'demandes',
              titre: 'Demandes',
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
                  : 'Les tâches se créent depuis l’onglet Tâches de chaque projet.'
              }
            />
          }
        />
      </Panneau>

      {ouverte && (
        <FenetreTache tacheId={ouverte} lienProjet onFermer={() => setOuverte(null)} onChange={recharger} />
      )}
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
