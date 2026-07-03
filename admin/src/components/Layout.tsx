import { NavLink, Outlet } from 'react-router-dom';
import { SyncIndicator } from './SyncIndicator';

const links = [
  { to: '/brands', label: 'Marques' },
  { to: '/categories', label: 'Catégories' },
  { to: '/products', label: 'Produits' },
  { to: '/videos', label: 'Vidéos' },
];

export function Layout() {
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
        </div>
      </aside>
      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}
