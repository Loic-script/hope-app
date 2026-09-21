import { Link, useOutletContext } from 'react-router-dom';

import {
  IconeBeneficiaires,
  IconeBudgets,
  IconeChevronDroit,
  IconeDepenses,
  IconeDonateurs,
  IconeDons,
  IconeGraphique,
  IconePlus,
  IconeProjets,
} from '../../components/admin/AdminIcons.jsx';
import FluxDesFonds from '../../components/admin/FluxDesFonds.jsx';
import PublicationProjet from '../../components/admin/PublicationProjet.jsx';
import {
  Alerte,
  Badge,
  Chargement,
  EtatVide,
  Panneau,
  Progression,
  Tableau,
} from '../../components/admin/ui.jsx';
import { useChargement } from '../../hooks/useChargement.js';
import * as catalogService from '../../services/catalog.service.js';
import * as dashboardService from '../../services/dashboard.service.js';
import * as fmt from '../../utils/format.js';

import photoBandeau from '../../assets/hope-bandeau.jpg';
import silhouette from '../../assets/hope-madagascar.png';

/**
 * Les quatre gestes du quotidien.
 *
 * Chacun ouvre directement le formulaire, les ecrans concernes sachant
 * lire le parametre qui le declenche.
 */
const RACCOURCIS = [
  { to: '/admin/projects/new', label: 'Créer un projet', Icone: IconeProjets },
  { to: '/admin/budget?depense=1', label: 'Enregistrer une dépense', Icone: IconeDepenses },
  { to: '/admin/beneficiaries?nouveau=1', label: 'Ajouter un bénéficiaire', Icone: IconeBeneficiaires },
  { to: '/admin/dons?don=1', label: 'Affecter un don', Icone: IconeDons },
];

/** Couleur de la pastille du fil d'activite selon la nature de l'ecriture. */
const TEINTES_ACTIVITE = {
  DONATION: 'vert',
  INVESTMENT: 'ambre',
  EXPENSE: 'ambre',
  PROJECT: 'bleu',
  PROJECT_COMPLETED: 'vert',
  BENEFICIARY: 'gris',
  MESSAGE: 'violet',
};

/** Une carte de chiffre cle. */
function CarteChiffre({ libelle, valeur, variation, Icone, teinte }) {
  return (
    <article className="carte-chiffre">
      <div>
        <p className="carte-chiffre__libelle">{libelle}</p>
        <p className="carte-chiffre__valeur">{valeur}</p>
        {variation && <p className="carte-chiffre__variation">{variation}</p>}
      </div>
      <span className={`carte-chiffre__icone carte-chiffre__icone--${teinte}`} aria-hidden="true">
        <Icone />
      </span>
    </article>
  );
}

/**
 * Accueil de l'espace administrateur.
 *
 * Quatre chiffres cles, la lecture du budget, les projets en cours, le fil
 * d'activite et les actions rapides. Pas de graphique ici : ils ont leur
 * ecran dedie.
 */
export default function AdminHome() {
  const { admin } = useOutletContext();

  const { donnees, chargement, erreur } = useChargement(
    () => dashboardService.recupererAccueil(),
    []
  );
  const { donnees: catalogue } = useChargement(() => catalogService.recuperer(), []);

  const libelles = catalogue?.labels ?? {};
  const stats = donnees?.stats;
  const tendances = donnees?.trends;

  // Le flux des fonds attend la meme forme que celle de l'ecran Budget.
  const resumeFonds = stats
    ? {
        designatedTotal: stats.donsAffectes,
        hopeTotal: stats.donsHope,
        investedTotal: stats.investi,
        availableTotal: stats.fondsDisponible,
        designatedShare: stats.partAffectee,
        hopeShare: stats.partHope,
      }
    : null;

  return (
    <>
      {/* ---------- Bandeau de bienvenue ---------- */}
      <section className="accueil__bandeau" style={{ '--photo-bandeau': `url(${photoBandeau})` }}>
        <p className="page-entete__fil">
          Accueil
          <span className="trait-hope" aria-hidden="true" />
        </p>
        <h1 className="accueil__salutation">Bienvenue, {admin?.adminLog ?? 'AdminHope'}</h1>
        <p className="accueil__accroche">
          Suivez les dons reçus, décidez de leur emploi et mesurez ce qu’ils changent pour les
          enfants et les familles de Madagascar.
        </p>
      </section>

      {erreur && <Alerte>{erreur}</Alerte>}

      {chargement && !donnees ? (
        <Chargement texte="Chargement du tableau de bord…" />
      ) : (
        <>
        

          {/* ---------- Deux colonnes ---------- */}
          <div className="accueil__colonnes" style={{ marginTop: '18px' }}>
            <div className="accueil__pile">
              {/* ---------- Les projets en cours, en publications ---------- */}
              <Panneau
                titre="Projets en cours"
                sousTitre="Ce qui est financé, ce qui manque encore"
                actions={
                  <Link className="btn btn--neutre btn--petit" to="/admin/projects">
                    Tous les projets
                    <IconeChevronDroit />
                  </Link>
                }
              >
                {donnees?.activeProjects?.length ? (
                  <div className="publications">
                    {donnees.activeProjects.map((projet, rang) => (
                      <PublicationProjet key={projet.id} projet={projet} rang={rang} />
                    ))}
                  </div>
                ) : (
                  <EtatVide
                    titre="Aucun projet en cours"
                    texte="Créez un projet pour commencer à suivre son financement et son impact."
                    action={
                      <Link className="btn btn--principal" to="/admin/projects/new">
                        <IconePlus />
                        Créer un projet
                      </Link>
                    }
                  />
                )}
              </Panneau>
            </div>
            <div className="accueil__pile">
              {/*
                Les quatre gestes du quotidien, a portee de clic depuis
                l'accueil. Chacun mene la ou l'action se fait, et non a une
                page d'ou il faudrait encore la chercher -- d'ou les
                parametres "?don=1" et "?nouveau=1", que les deux ecrans
                concernes savent lire.

                La depense fait exception : elle appartient toujours a un
                projet, et il faut donc en designer un d'abord.
              */}
              <Panneau titre="Actions rapides" serre>
                <div className="actions-rapides">
                  {RACCOURCIS.map(({ to, label, Icone }) => (
                    <Link className="action-rapide" to={to} key={to}>
                      <Icone />
                      {label}
                      <IconeChevronDroit className="action-rapide__chevron" />
                    </Link>
                  ))}
                </div>
              </Panneau>

              <section className="carte-mission">
                <p className="carte-mission__label">Notre mission</p>
                <h2 className="carte-mission__titre">
                  Un avenir meilleur
                  <br />
                  pour Madagascar
                </h2>
                <p className="carte-mission__texte">
                  Chaque don suivi jusqu’à son impact, c’est un enfant scolarisé, une mère
                  autonome, une famille qui tient debout.
                </p>
                <div className="trait-hope carte-mission__trait" />
                <img src={silhouette} alt="" aria-hidden="true" />
              </section>
            </div>
          </div>
        </>
      )}
    </>
  );
}
