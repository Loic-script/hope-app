import { Navigate, Route, Routes } from 'react-router-dom';

import AdminLayout from '../layouts/AdminLayout.jsx';
import AdminLogin from '../pages/AdminLogin.jsx';
import AdminLoginSuccess from '../pages/AdminLoginSuccess.jsx';
import AdminHome from '../pages/admin/AdminHome.jsx';
import BudgetPage from '../pages/admin/BudgetPage.jsx';
import DonorsPage from '../pages/admin/DonorsPage.jsx';
import ImpactPage from '../pages/admin/ImpactPage.jsx';
import MessagesPage from '../pages/admin/MessagesPage.jsx';
import NotificationsPage from '../pages/admin/NotificationsPage.jsx';
import ProjectDetailPage from '../pages/admin/ProjectDetailPage.jsx';
import ProjectFormPage from '../pages/admin/ProjectFormPage.jsx';
import ProjectsPage from '../pages/admin/ProjectsPage.jsx';
import SettingsPage from '../pages/admin/SettingsPage.jsx';
import StatisticsPage from '../pages/admin/StatisticsPage.jsx';
import RequireAuth from './RequireAuth.jsx';

/**
 * Table de routage de l'application HOPE.
 *
 *   /admin/login   formulaire de connexion (seule route publique)
 *   /admin/...     espace administrateur, protege par RequireAuth
 *
 * Les huit sections du menu : accueil, projets, impact, budget,
 * notifications, donateurs, messages, statistiques.
 */
export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/admin" replace />} />
      <Route path="/admin/login" element={<AdminLogin />} />

      <Route element={<RequireAuth />}>
        {/* Page de verification de bout en bout, conservee depuis l'etape 1. */}
        <Route path="/admin/login-success" element={<AdminLoginSuccess />} />

        <Route element={<AdminLayout />}>
          <Route path="/admin" element={<AdminHome />} />

          <Route path="/admin/projects" element={<ProjectsPage />} />
          <Route path="/admin/projects/new" element={<ProjectFormPage />} />
          <Route path="/admin/projects/:id" element={<ProjectDetailPage />} />
          <Route path="/admin/projects/:id/edit" element={<ProjectFormPage />} />

          <Route path="/admin/impact" element={<ImpactPage />} />
          <Route path="/admin/budget" element={<BudgetPage />} />
          <Route path="/admin/notifications" element={<NotificationsPage />} />
          <Route path="/admin/donors" element={<DonorsPage />} />
          <Route path="/admin/messages" element={<MessagesPage />} />
          <Route path="/admin/statistics" element={<StatisticsPage />} />
          <Route path="/admin/settings" element={<SettingsPage />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/admin" replace />} />
    </Routes>
  );
}
