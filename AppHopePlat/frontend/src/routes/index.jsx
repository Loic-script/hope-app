import { Navigate, Route, Routes } from 'react-router-dom';

import AdminLayout from '../layouts/AdminLayout.jsx';
import AdminLogin from '../pages/AdminLogin.jsx';
import AdminLoginSuccess from '../pages/AdminLoginSuccess.jsx';
import AdminHome from '../pages/admin/AdminHome.jsx';
import BeneficiariesPage from '../pages/admin/BeneficiariesPage.jsx';
import BudgetPage from '../pages/admin/BudgetPage.jsx';
import DonorsPage from '../pages/admin/DonorsPage.jsx';
import ImpactPage from '../pages/admin/ImpactPage.jsx';
import NotificationsPage from '../pages/admin/NotificationsPage.jsx';
import ProjectDetailPage from '../pages/admin/ProjectDetailPage.jsx';
import ProjectFormPage from '../pages/admin/ProjectFormPage.jsx';
import ProjectsPage from '../pages/admin/ProjectsPage.jsx';
import ProofDetailPage from '../pages/admin/ProofDetailPage.jsx';
import ProofsPage from '../pages/admin/ProofsPage.jsx';
import Redirection from '../pages/Redirection.jsx';
import Authentification from '../pages/Authentification.jsx';
import BienvenueDonateur from '../pages/donateur/Bienvenue.jsx';
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
import DeclarerOrganisation from '../pages/bailleur/DeclarerOrganisation.jsx';
import OrganisationBailleur from '../pages/bailleur/Organisation.jsx';
import PartenariatBailleur from '../pages/bailleur/Partenariat.jsx';
import RapportsBailleur from '../pages/bailleur/Rapports.jsx';
import TableauDeBordBailleur from '../pages/bailleur/TableauDeBord.jsx';
import RequireBailleur from './RequireBailleur.jsx';
import SettingsPage from '../pages/admin/SettingsPage.jsx';
import StatisticsPage from '../pages/admin/StatisticsPage.jsx';
import FundersPage from '../pages/admin/FundersPage.jsx';
import VolunteersPage from '../pages/admin/VolunteersPage.jsx';
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
        {/* Hors de la coquille a rail : il n'y a pas encore
            d'organisation a afficher dedans. */}
        <Route path="/bailleur/declarer-organisation" element={<DeclarerOrganisation />} />

        <Route element={<BailleurLayout />}>
          <Route path="/bailleur" element={<TableauDeBordBailleur />} />
          <Route path="/bailleur/partenariat" element={<PartenariatBailleur />} />
          <Route path="/bailleur/rapports" element={<RapportsBailleur />} />
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
          <Route path="/admin/projects/new" element={<ProjectFormPage />} />
          <Route path="/admin/projects/:id" element={<ProjectDetailPage />} />

          <Route path="/admin/beneficiaries" element={<BeneficiariesPage />} />

          <Route path="/admin/proofs" element={<ProofsPage />} />
          <Route path="/admin/proofs/:id" element={<ProofDetailPage />} />
          <Route path="/admin/projects/:id/edit" element={<ProjectFormPage />} />

          <Route path="/admin/impact" element={<ImpactPage />} />
          <Route path="/admin/budget" element={<BudgetPage />} />
          <Route path="/admin/notifications" element={<NotificationsPage />} />
          <Route path="/admin/donors" element={<DonorsPage />} />
          {/* La messagerie commune : l'equipe y est un participant
              comme un autre. Le courrier des donateurs garde son ecran. */}
          <Route path="/admin/conversations" element={<ConversationsEspace />} />
          {/* La conversation a son adresse : sur un telephone,
              c'est une page a elle, et le lien se partage. */}
          <Route path="/admin/conversations/:id" element={<ConversationsEspace />} />
          <Route path="/admin/volunteers" element={<VolunteersPage />} />
          <Route path="/admin/funders" element={<FundersPage />} />
          <Route path="/admin/statistics" element={<StatisticsPage />} />
          <Route path="/admin/settings" element={<SettingsPage />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/admin" replace />} />
    </Routes>
  );
}
