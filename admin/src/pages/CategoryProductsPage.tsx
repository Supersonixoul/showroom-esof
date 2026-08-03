import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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

  const moveMutation = useMutation({
    mutationFn: ({ id: productId, direction }: { id: string; direction: 'up' | 'down' }) =>
      productsApi.move(productId, direction),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
    onError: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });

  const removeMutation = useMutation({
    mutationFn: (productId: string) => productsApi.remove(productId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      setSuccessMessage('Article supprimé.');
      setTimeout(() => setSuccessMessage(null), 3000);
    },
  });

  const setVisibilityMutation = useMutation({
    mutationFn: ({ id: productId, isActive }: { id: string; isActive: boolean }) =>
      productsApi.setVisibility(productId, isActive),
    onMutate: async ({ id: productId, isActive }) => {
      const queryKey = ['products', 'byCategory', id];
      const previous = queryClient.getQueryData<Product[]>(queryKey);
      queryClient.setQueryData<Product[]>(queryKey, (old) =>
        old?.map((p) => (p.id === productId ? { ...p, isActive } : p)),
      );
      return { previous, queryKey };
    },
    onError: (_err, _vars, context) => {
      if (context) {
        queryClient.setQueryData(context.queryKey, context.previous);
      }
    },
    onSuccess: () => {
      setSuccessMessage('Visibilité mise à jour.');
      setTimeout(() => setSuccessMessage(null), 3000);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });

  const mutationError = moveMutation.error || setVisibilityMutation.error || removeMutation.error;
  const isSearchActive = search.trim() !== '';

  function productIndex(productId: string) {
    return (products ?? []).findIndex((p) => p.id === productId);
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

        {mutationError && (
          <div className="error-banner">{(mutationError as Error).message}</div>
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
          <table className="category-products-table">
            <thead>
              <tr>
                <th>Ordre</th>
                <th>Photo</th>
                <th>Référence</th>
                <th>Désignation</th>
                <th>Marque</th>
                <th>Sous-catégorie</th>
                <th>Prix</th>
                <th>Visible</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.map((product) => {
                const globalIndex = productIndex(product.id);
                const isFirst = globalIndex === 0;
                const isLast = globalIndex === (products?.length ?? 0) - 1;
                return (
                  <tr key={product.id} className={product.isActive ? undefined : 'row-hidden'}>
                    <td>
                      <div className="reorder-buttons">
                        <button
                          type="button"
                          className="icon-btn"
                          disabled={isSearchActive || isFirst}
                          aria-label="Monter"
                          title="Monter"
                          onClick={() =>
                            moveMutation.mutate({ id: product.id, direction: 'up' })
                          }
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          className="icon-btn"
                          disabled={isSearchActive || isLast}
                          aria-label="Descendre"
                          title="Descendre"
                          onClick={() =>
                            moveMutation.mutate({ id: product.id, direction: 'down' })
                          }
                        >
                          ↓
                        </button>
                      </div>
                    </td>
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
                    <td>
                      <span className="cell-clamp" title={product.name}>
                        {product.name}
                      </span>
                    </td>
                    <td className="muted">{product.brand?.name ?? '—'}</td>
                    <td className="muted">{product.subcategory?.name ?? '—'}</td>
                    <td>{formatPrix(product.price)}</td>
                    <td>
                      <label className="checkbox-label">
                        <input
                          type="checkbox"
                          checked={product.isActive}
                          disabled={
                            setVisibilityMutation.isPending &&
                            setVisibilityMutation.variables?.id === product.id
                          }
                          aria-label={
                            product.isActive ? 'Masquer le produit' : 'Rendre visible le produit'
                          }
                          onChange={(e) =>
                            setVisibilityMutation.mutate({
                              id: product.id,
                              isActive: e.target.checked,
                            })
                          }
                        />
                        Visible
                      </label>
                    </td>
                    <td>
                      <div className="actions actions-inline">
                        <button onClick={() => setEditingProduct(product)}>
                          Modifier
                        </button>
                        <button
                          className="danger"
                          disabled={removeMutation.isPending && removeMutation.variables === product.id}
                          onClick={() => {
                            if (
                              confirm(
                                `Supprimer l'article "${product.name}" ? Cette action est irréversible.`,
                              )
                            ) {
                              removeMutation.mutate(product.id);
                            }
                          }}
                        >
                          {removeMutation.isPending && removeMutation.variables === product.id
                            ? 'Suppression…'
                            : 'Supprimer'}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredProducts.length === 0 && (
                <tr>
                  <td colSpan={9} className="muted">
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
