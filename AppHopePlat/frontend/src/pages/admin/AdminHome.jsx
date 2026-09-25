import { Link, useOutletContext } from 'react-router-dom';

import {
  IconeBeneficiaires,
  IconeChevronDroit,
  IconeDepenses,
  IconeDons,
  IconePlus,
  IconeProjets,
} from '../../components/admin/AdminIcons.jsx';
import PublicationFil from '../../components/admin/PublicationFil.jsx';
import {
  Alerte,
  Chargement,
  EtatVide,
  Panneau,
} from '../../components/admin/ui.jsx';
import { useChargement } from '../../hooks/useChargement.js';
import * as dashboardService from '../../services/dashboard.service.js';

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
              {/*
                Les projets en cours, en fil de publications : chacun se
                lit comme un message d'un reseau social -- qui, quand, ou,
                ce qu'il fait, sa photo en grand, son financement -- avec
                une seule action, voir le projet.
              */}
              <section className="fil-accueil" aria-labelledby="fil-accueil-titre">
                <div className="fil-accueil__entete">
                  <div>
                    <h2 className="fil-accueil__titre" id="fil-accueil-titre">
                      Projets en cours
                    </h2>
                    <p className="fil-accueil__sous-titre">Ce qui est financé, ce qui manque encore</p>
                  </div>
                  <Link className="btn btn--neutre btn--petit" to="/admin/projects">
                    Tous les projets
                    <IconeChevronDroit />
                  </Link>
                </div>

                {donnees?.activeProjects?.length ? (
                  donnees.activeProjects.map((projet, rang) => (
                    <PublicationFil key={projet.id} projet={projet} rang={rang} />
                  ))
                ) : (
                  <Panneau>
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
                  </Panneau>
                )}
              </section>
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
