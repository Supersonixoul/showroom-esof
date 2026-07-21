import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { SyncIndicator } from './SyncIndicator';

const links = [
  { to: '/brands', label: 'Marques' },
  { to: '/gammes', label: 'Gammes' },
  { to: '/categories', label: 'Catégories' },
  { to: '/subcategories', label: 'Sous-Catégories' },
  { to: '/products', label: 'Produits' },
  { to: '/videos', label: 'Vidéos' },
];

export function Layout() {
  const { user, logout } = useAuth();

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-header">
          <h1 className="logo">Showroom ESOF</h1>
          <label className="nav-toggle-btn" htmlFor="nav-toggle">
            ☰
          </label>
        </div>
        <input type="checkbox" id="nav-toggle" className="nav-toggle-checkbox" />
        <nav>
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) =>
                isActive ? 'nav-link nav-link--active' : 'nav-link'
              }
            >
              {link.label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">
          <SyncIndicator />
          {user && (
            <div style={{ marginTop: 12, fontSize: 13 }}>
              <div className="muted">{user.name}</div>
              <button onClick={logout} style={{ marginTop: 6 }}>
                Se déconnecter
              </button>
            </div>
          )}
        </div>
      </aside>
      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}
