import { Suspense, lazy } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';

import AdminLayout from '../layouts/AdminLayout.jsx';
import AdminLogin from '../pages/AdminLogin.jsx';
import AdminLoginSuccess from '../pages/AdminLoginSuccess.jsx';
import AdminHome from '../pages/admin/AdminHome.jsx';
import BeneficiariesPage from '../pages/admin/BeneficiariesPage.jsx';
import BudgetPage from '../pages/admin/BudgetPage.jsx';
import DonsPage from '../pages/admin/DonsPage.jsx';
import ImpactPage from '../pages/admin/ImpactPage.jsx';
import NotificationsPage from '../pages/admin/NotificationsPage.jsx';
import ProjectDetailPage from '../pages/admin/ProjectDetailPage.jsx';
import ProjectFormPage from '../pages/admin/ProjectFormPage.jsx';
import ProjectsPage from '../pages/admin/ProjectsPage.jsx';
import TachesPage from '../pages/admin/TachesPage.jsx';
import ProofDetailPage from '../pages/admin/ProofDetailPage.jsx';
import ProofsPage from '../pages/admin/ProofsPage.jsx';
import Redirection from '../pages/Redirection.jsx';
import Authentification from '../pages/Authentification.jsx';
import BienvenueDonateur from '../pages/donateur/Bienvenue.jsx';

/*
 * Le parcours d'accueil du donateur se charge a part : il embarque la
 * liste des pays et leurs regles de numerotation, dont aucun autre
 * ecran n'a besoin. Les autres espaces ne les telechargent pas.
 */
const ParcoursDonateur = lazy(() => import('../pages/donateur/Parcours.jsx'));
import RequireDonateur from './RequireDonateur.jsx';
import BenevoleLayout from '../layouts/BenevoleLayout.jsx';
import ConversationsEspace from '../pages/espace/Conversations.jsx';
import NotificationsEspace from '../pages/espace/NotificationsEspace.jsx';
import MesTaches from '../pages/benevole/MesTaches.jsx';
import ProjetDetail from '../pages/benevole/ProjetDetail.jsx';
import ProjetsBenevole from '../pages/benevole/Projets.jsx';
import MonJournal from '../pages/benevole/MonJournal.jsx';
import CompleterProfil from '../pages/benevole/CompleterProfil.jsx';
import MonProfil from '../pages/benevole/MonProfil.jsx';
import VueDensemble from '../pages/benevole/VueDensemble.jsx';
import RequireBenevole from './RequireBenevole.jsx';
import BailleurLayout from '../layouts/BailleurLayout.jsx';
import ActualitesBailleur from '../pages/bailleur/Actualites.jsx';
import OrganisationBailleur from '../pages/bailleur/Organisation.jsx';
import PartenariatBailleur from '../pages/bailleur/Partenariat.jsx';
import ProjetsBailleur from '../pages/bailleur/Projets.jsx';
import RapportsBailleur from '../pages/bailleur/Rapports.jsx';
import TableauDeBordBailleur from '../pages/bailleur/TableauDeBord.jsx';
import RequireBailleur from './RequireBailleur.jsx';
import SettingsPage from '../pages/admin/SettingsPage.jsx';
import ProfilUtilisateurPage from '../pages/admin/ProfilUtilisateurPage.jsx';
import UtilisateursPage from '../pages/admin/UtilisateursPage.jsx';
import StatisticsPage from '../pages/admin/StatisticsPage.jsx';
import PublicationsPage from '../pages/admin/PublicationsPage.jsx';
import RequireAuth from './RequireAuth.jsx';

/**
 * Table de routage de l'application HOPE.
 *
 *   /                page d'entree : l'admin, ou les utilisateurs
 *   /authentification connexion et inscription des utilisateurs
 *   /donateur        espace donateur (page de bienvenue seulement)
 *   /admin/login     connexion administrateur
 *   /benevole/...    espace benevole : projets, taches, journal
 *   /bailleur/...    espace partenaire : suivi des financements
 *   /admin/...     espace administrateur, protege par RequireAuth
 *
 * Les huit sections du menu : accueil, projets, impact, budget,
 * notifications, donateurs, messages, statistiques.
 */
/**
 * Les anciennes adresses des ecrans Donateurs, Benevoles et Bailleurs,
 * reunis dans "Utilisateurs". Les liens deja envoyes -- notifications,
 * messagerie, favoris -- menent au bon onglet, ancre comprise ; le
 * journal des dons (?onglet=dons) et l'enregistrement d'un don (?don=1)
 * menent a l'ecran des dons.
 */
function VersUtilisateurs({ onglet }) {
  const { search, hash } = useLocation();
  const parametres = new URLSearchParams(search);
  if (onglet === 'donateurs' && parametres.get('don') === '1') {
    return <Navigate to="/admin/dons?don=1" replace />;
  }
  if (onglet === 'donateurs' && parametres.get('onglet') === 'dons') {
    return <Navigate to="/admin/dons" replace />;
  }
  return <Navigate to={`/admin/utilisateurs?onglet=${onglet}${hash}`} replace />;
}

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Redirection />} />
      <Route path="/admin/login" element={<AdminLogin />} />

      {/* ----- Porte unique des utilisateurs ----- */}
      <Route path="/authentification" element={<Authentification />} />

      {/* ----- Espace donateur : une page de bienvenue, pour l instant ----- */}
      <Route element={<RequireDonateur />}>
        <Route path="/donateur" element={<BienvenueDonateur />} />
        {/* Le parcours d'accueil, ouvert des l'inscription. */}
        <Route
          path="/donateur/completer-profil"
          element={
            <Suspense
              fallback={
                <div className="verification" role="status" aria-live="polite">
                  <span className="verification__rotation" aria-hidden="true" />
                  <p>Préparation de votre espace…</p>
                </div>
              }
            >
              <ParcoursDonateur />
            </Suspense>
          }
        />
      </Route>

      {/*
        * Les anciennes adresses d'acces par espace menent desormais a la
        * porte unique. Les liens et favoris deja donnes continuent de
        * fonctionner, et il n'y a plus deux facons de s'inscrire.
        */}
      <Route path="/benevole/login" element={<Navigate to="/authentification" replace />} />
      <Route path="/benevole/inscription" element={<Navigate to="/authentification" replace />} />
      <Route path="/bailleur/login" element={<Navigate to="/authentification" replace />} />
      <Route path="/bailleur/inscription" element={<Navigate to="/authentification" replace />} />

      <Route element={<RequireBailleur />}>
        {/* L'organisation nait avec le compte : ce formulaire n'existe
            plus. Un favori ou un lien deja envoye mene a la fiche, dans
            les parametres du compte. */}
        <Route
          path="/bailleur/declarer-organisation"
          element={<Navigate to="/bailleur/organisation" replace />}
        />

        <Route element={<BailleurLayout />}>
          <Route path="/bailleur" element={<TableauDeBordBailleur />} />
          <Route path="/bailleur/partenariat" element={<PartenariatBailleur />} />
          <Route path="/bailleur/rapports" element={<RapportsBailleur />} />
          <Route path="/bailleur/projets" element={<ProjetsBailleur />} />
          {/* Les preuves terrain ont quitte l'espace bailleur. Une ancienne
              adresse -- un favori, une notification deja envoyee -- mene
              au tableau de bord plutot qu'a une page blanche. */}
          <Route path="/bailleur/preuves" element={<Navigate to="/bailleur" replace />} />
          <Route path="/bailleur/preuves/:id" element={<Navigate to="/bailleur" replace />} />
          <Route path="/bailleur/actualites" element={<ActualitesBailleur />} />
          <Route path="/bailleur/organisation" element={<OrganisationBailleur />} />
          <Route path="/bailleur/notifications" element={<NotificationsEspace />} />
          <Route path="/bailleur/messages" element={<ConversationsEspace />} />
          {/* La conversation a son adresse : sur un telephone,
              c'est une page a elle, et le lien se partage. */}
          <Route path="/bailleur/messages/:id" element={<ConversationsEspace />} />
        </Route>
      </Route>

      <Route element={<RequireBenevole />}>
        {/* Hors de la coquille a onglets : on remplit sa fiche avant
            d'entrer dans l'espace. */}
        <Route path="/benevole/completer-profil" element={<CompleterProfil />} />

        <Route element={<BenevoleLayout />}>
          <Route path="/benevole" element={<VueDensemble />} />
          {/* L'entree de l'espace : ce que HOPE mene, puis les taches
              qu'il y a a y prendre. */}
          <Route path="/benevole/projets" element={<ProjetsBenevole />} />
          <Route path="/benevole/projets/:id" element={<ProjetDetail />} />
          {/* Les missions ont ete retirees : l'espace ne propose plus que
              des taches. Les anciennes adresses -- dans un favori, ou dans
              une notification deja envoyee -- menent aux taches plutot
              qu'a une page blanche. */}
          <Route path="/benevole/missions" element={<Navigate to="/benevole/taches" replace />} />
          <Route
            path="/benevole/missions/:id"
            element={<Navigate to="/benevole/taches" replace />}
          />
          <Route path="/benevole/taches" element={<MesTaches />} />
          <Route path="/benevole/journal" element={<MonJournal />} />
          <Route path="/benevole/profil" element={<MonProfil />} />
          {/* Communs aux espaces : le meme ecran, servi par le client
              axios que la coque fournit. */}
          <Route path="/benevole/notifications" element={<NotificationsEspace />} />
          <Route path="/benevole/messages" element={<ConversationsEspace />} />
          {/* La conversation a son adresse : sur un telephone,
              c'est une page a elle, et le lien se partage. */}
          <Route path="/benevole/messages/:id" element={<ConversationsEspace />} />
        </Route>
      </Route>

      <Route element={<RequireAuth />}>
        {/* Page de verification de bout en bout, conservee depuis l'etape 1. */}
        <Route path="/admin/login-success" element={<AdminLoginSuccess />} />

        <Route element={<AdminLayout />}>
          <Route path="/admin" element={<AdminHome />} />

          <Route path="/admin/projects" element={<ProjectsPage />} />
          <Route path="/admin/taches" element={<TachesPage />} />
          <Route path="/admin/projects/new" element={<ProjectFormPage />} />
          <Route path="/admin/projects/:id" element={<ProjectDetailPage />} />

          <Route path="/admin/beneficiaries" element={<BeneficiariesPage />} />

          <Route path="/admin/proofs" element={<ProofsPage />} />
          <Route path="/admin/proofs/:id" element={<ProofDetailPage />} />
          <Route path="/admin/projects/:id/edit" element={<ProjectFormPage />} />

          <Route path="/admin/impact" element={<ImpactPage />} />
          <Route path="/admin/budget" element={<BudgetPage />} />
          <Route path="/admin/notifications" element={<NotificationsPage />} />
          {/* Donateurs, benevoles et bailleurs : un seul ecran, trois
              onglets, et le profil de chacun. Le journal des dons a gardé
              le sien. */}
          <Route path="/admin/utilisateurs" element={<UtilisateursPage />} />
          <Route path="/admin/utilisateurs/:genre/:id" element={<ProfilUtilisateurPage />} />
          <Route path="/admin/dons" element={<DonsPage />} />
          <Route path="/admin/donors" element={<VersUtilisateurs onglet="donateurs" />} />
          {/* La messagerie commune : l'equipe y est un participant
              comme un autre. Le courrier des donateurs garde son ecran. */}
          <Route path="/admin/conversations" element={<ConversationsEspace />} />
          {/* La conversation a son adresse : sur un telephone,
              c'est une page a elle, et le lien se partage. */}
          <Route path="/admin/conversations/:id" element={<ConversationsEspace />} />
          <Route path="/admin/volunteers" element={<VersUtilisateurs onglet="benevoles" />} />
          <Route path="/admin/funders" element={<VersUtilisateurs onglet="bailleurs" />} />
          <Route path="/admin/actualites" element={<PublicationsPage />} />
          <Route path="/admin/statistics" element={<StatisticsPage />} />
          <Route path="/admin/settings" element={<SettingsPage />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/admin" replace />} />
    </Routes>
  );
}
