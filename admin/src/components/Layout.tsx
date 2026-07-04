import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { SyncIndicator } from './SyncIndicator';

const links = [
  { to: '/brands', label: 'Marques' },
  { to: '/categories', label: 'Catégories' },
  { to: '/products', label: 'Produits' },
  { to: '/videos', label: 'Vidéos' },
];

export function Layout() {
  const { user, logout } = useAuth();

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <h1 className="logo">Showroom ESOF</h1>
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
