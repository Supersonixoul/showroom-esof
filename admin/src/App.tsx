import type { ReactNode } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './auth/AuthContext';
import { Layout } from './components/Layout';
import { LoginPage } from './pages/LoginPage';
import { BrandsPage } from './pages/BrandsPage';
import { GammesPage } from './pages/GammesPage';
import { CategoriesPage } from './pages/CategoriesPage';
import { SubcategoriesPage } from './pages/SubcategoriesPage';
import { ProductsPage } from './pages/ProductsPage';
import { VideosPage } from './pages/VideosPage';
import { CommerciauxPage } from './pages/CommerciauxPage';
import { ProfessionnelsPage } from './pages/ProfessionnelsPage';

function RequireAuth({ children }: { children: ReactNode }) {
  const { token } = useAuth();
  const location = useLocation();
  if (!token) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return <>{children}</>;
}

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        element={
          <RequireAuth>
            <Layout />
          </RequireAuth>
        }
      >
        <Route index element={<Navigate to="/brands" replace />} />
        <Route path="/brands" element={<BrandsPage />} />
        <Route path="/gammes" element={<GammesPage />} />
        <Route path="/categories" element={<CategoriesPage />} />
        <Route path="/subcategories" element={<SubcategoriesPage />} />
        <Route path="/products" element={<ProductsPage />} />
        <Route path="/videos" element={<VideosPage />} />
        <Route path="/commerciaux" element={<CommerciauxPage />} />
        <Route path="/professionnels" element={<ProfessionnelsPage />} />
      </Route>
    </Routes>
  );
}

export default App;
