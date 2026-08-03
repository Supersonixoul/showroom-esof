import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { categoriesApi, mediaUrl, productsApi } from '../api/client';
import type { Product } from '../api/types';
import { ProductForm } from '../components/ProductForm';
import { formatPrix } from '../utils/formatPrix';

/**
 * Liste des articles d'une catégorie, ouverte depuis le bouton « Détails »
 * de CategoriesPage. Réutilise `ProductForm` (partagé avec ProductsPage)
 * pour la modification, enveloppé ici dans une modale.
 */
export function CategoryProductsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const {
    data: categories,
    isLoading: categoriesLoading,
    error: categoriesError,
  } = useQuery({ queryKey: ['categories'], queryFn: categoriesApi.list });

  const category = categories?.find((c) => c.id === id);

  const {
    data: products,
    isLoading: productsLoading,
    error: productsError,
    refetch,
  } = useQuery({
    queryKey: ['products', 'byCategory', id],
    queryFn: () => productsApi.list(id),
    enabled: !!category,
  });

  const [search, setSearch] = useState('');
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  function handleSaved() {
    setEditingProduct(null);
    queryClient.invalidateQueries({ queryKey: ['products'] });
    setSuccessMessage('Produit enregistré avec succès.');
    setTimeout(() => setSuccessMessage(null), 3000);
  }

  const normalizedSearch = search.trim().toLowerCase();
  const filteredProducts = (products ?? []).filter((product) => {
    if (!normalizedSearch) return true;
    return (
      product.name.toLowerCase().includes(normalizedSearch) ||
      (product.reference ?? '').toLowerCase().includes(normalizedSearch)
    );
  });

  if (categoriesLoading) {
    return <p className="muted">Chargement…</p>;
  }

  if (categoriesError) {
    return (
      <div className="page-fill">
        <div className="error-banner">
          Impossible de charger les catégories.{' '}
          <button type="button" onClick={() => navigate('/categories')}>
            ← Retour aux catégories
          </button>
        </div>
      </div>
    );
  }

  if (!category) {
    return (
      <div className="page-fill">
        <div className="error-banner">Catégorie introuvable.</div>
        <button type="button" onClick={() => navigate('/categories')}>
          ← Retour aux catégories
        </button>
      </div>
    );
  }

  return (
    <div className="page-fill">
      <div>
        <div className="page-header">
          <h2>Articles — {category.name}</h2>
          <button type="button" onClick={() => navigate('/categories')}>
            ← Retour aux catégories
          </button>
        </div>

        <p className="muted">{products?.length ?? 0} article(s)</p>

        {successMessage && (
          <div className="success-banner">{successMessage}</div>
        )}

        {productsError && (
          <div className="error-banner">
            Impossible de charger les articles de cette catégorie.{' '}
            <button type="button" onClick={() => refetch()}>
              Réessayer
            </button>
          </div>
        )}

        <div className="form-row" style={{ alignItems: 'flex-end' }}>
          <label>
            Rechercher (référence, désignation)
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Ex. REF-001, écran…"
            />
          </label>
        </div>
      </div>

      <div className="scroll-area">
        {productsLoading ? (
          <p className="muted">Chargement…</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Photo</th>
                <th>Référence</th>
                <th>Désignation</th>
                <th>Marque</th>
                <th>Sous-catégorie</th>
                <th>Prix</th>
                <th>Visibilité</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.map((product) => (
                <tr key={product.id} className={product.isActive ? undefined : 'row-hidden'}>
                  <td>
                    <div className="product-photo-frame" style={{ width: 48, height: 48 }}>
                      {product.images && product.images.length > 0 ? (
                        <img
                          src={mediaUrl(
                            product.images[0].imageVariants?.thumb ?? product.images[0].url,
                          )}
                          alt=""
                          loading="lazy"
                        />
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </div>
                  </td>
                  <td className="muted">{product.reference || '—'}</td>
                  <td>{product.name}</td>
                  <td className="muted">{product.brand?.name ?? '—'}</td>
                  <td className="muted">{product.subcategory?.name ?? '—'}</td>
                  <td>{formatPrix(product.price)}</td>
                  <td>
                    {product.isActive ? (
                      <span className="badge badge-success">Visible</span>
                    ) : (
                      <span className="tag-hidden">Masqué</span>
                    )}
                  </td>
                  <td>
                    <div className="actions">
                      <button onClick={() => setEditingProduct(product)}>
                        Modifier
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredProducts.length === 0 && (
                <tr>
                  <td colSpan={8} className="muted">
                    {products && products.length > 0
                      ? 'Aucun article ne correspond à la recherche.'
                      : 'Aucun article dans cette catégorie.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {editingProduct && (
        <div className="modal-overlay" onClick={() => setEditingProduct(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="page-header">
              <h3>Modifier — {editingProduct.name}</h3>
              <button
                type="button"
                onClick={() => setEditingProduct(null)}
                aria-label="Fermer"
              >
                ✕
              </button>
            </div>
            <ProductForm
              product={editingProduct}
              onSuccess={handleSaved}
              onCancel={() => setEditingProduct(null)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
