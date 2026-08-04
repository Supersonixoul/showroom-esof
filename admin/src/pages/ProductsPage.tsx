import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { brandsApi, categoriesApi, mediaUrl, productsApi } from '../api/client';
import type { Product } from '../api/types';
import { ImportProductsDialog } from '../components/ImportProductsDialog';
import { ProductForm } from '../components/ProductForm';
import { ProductStatusDialog } from '../components/ProductStatusDialog';
import { formatPrix } from '../utils/formatPrix';

export function ProductsPage() {
  const queryClient = useQueryClient();
  const { data: products, isLoading, error } = useQuery({
    queryKey: ['products'],
    queryFn: () => productsApi.list(),
  });
  const { data: brands } = useQuery({ queryKey: ['brands'], queryFn: brandsApi.list });
  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: categoriesApi.list,
  });

  const [editingId, setEditingId] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [statusProductId, setStatusProductId] = useState<string | null>(null);

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['products'] });

  const removeMutation = useMutation({
    mutationFn: productsApi.remove,
    onSuccess: invalidate,
  });

  const moveMutation = useMutation({
    mutationFn: ({ id, direction }: { id: string; direction: 'up' | 'down' }) =>
      productsApi.move(id, direction),
    onSuccess: invalidate,
  });

  const setVisibilityMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      productsApi.setVisibility(id, isActive),
    onSuccess: invalidate,
  });

  const mutationError = setVisibilityMutation.error;

  function brandName(id?: string | null) {
    if (!id) return '—';
    return brands?.find((b) => b.id === id)?.name ?? '—';
  }
  function categoryName(id: string) {
    return categories?.find((c) => c.id === id)?.name ?? '—';
  }

  const sortedProducts = [...(products ?? [])].sort((a, b) => {
    if (a.categoryId !== b.categoryId) {
      return categoryName(a.categoryId).localeCompare(categoryName(b.categoryId));
    }
    return a.displayOrder - b.displayOrder;
  });

  function isFirstInGroup(index: number) {
    if (index === 0) return true;
    return sortedProducts[index - 1].categoryId !== sortedProducts[index].categoryId;
  }

  function isLastInGroup(index: number) {
    if (index === sortedProducts.length - 1) return true;
    return sortedProducts[index + 1].categoryId !== sortedProducts[index].categoryId;
  }

  return (
    <div className="page-fill">
      <div>
        <div className="page-header">
          <h2>Produits</h2>
          <button type="button" onClick={() => setImportOpen(true)}>
            Importer depuis Excel
          </button>
        </div>

        {importOpen && (
          <ImportProductsDialog onClose={() => setImportOpen(false)} />
        )}

        {error && (
          <div className="error-banner">Impossible de charger les produits.</div>
        )}
        {mutationError && (
          <div className="error-banner">{(mutationError as Error).message}</div>
        )}

        <ProductForm
          key={editingId ?? 'create'}
          product={editingId ? products?.find((p) => p.id === editingId) ?? null : null}
          onSuccess={() => setEditingId(null)}
          onCancel={() => setEditingId(null)}
        />
      </div>

      <div className="scroll-area">
      {isLoading ? (
        <p className="muted">Chargement…</p>
      ) : (
        <table className="products-table">
          <thead>
            <tr>
              <th>Ordre</th>
              <th>Visible</th>
              <th>Photo</th>
              <th>Référence</th>
              <th>Nom</th>
              <th>Marque</th>
              <th>Catégorie</th>
              <th>Prix</th>
              <th>Stock</th>
              <th>Mise en avant</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {sortedProducts.map((product, index) => (
              <tr key={product.id} className={product.isActive ? undefined : 'row-hidden'}>
                <td>
                  <div className="reorder-buttons">
                    <button
                      type="button"
                      className="icon-btn"
                      disabled={isFirstInGroup(index)}
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
                      disabled={isLastInGroup(index)}
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
                  <input
                    type="checkbox"
                    checked={product.isActive}
                    disabled={setVisibilityMutation.isPending && setVisibilityMutation.variables?.id === product.id}
                    aria-label={product.isActive ? 'Masquer le produit' : 'Rendre visible le produit'}
                    onChange={(e) =>
                      setVisibilityMutation.mutate({ id: product.id, isActive: e.target.checked })
                    }
                  />
                  {!product.isActive && <span className="tag-hidden">Masqué</span>}
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
                <td className="muted">
                  <span className="cell-ellipsis cell-ellipsis-sm" title={product.reference || undefined}>
                    {product.reference || '—'}
                  </span>
                </td>
                <td>
                  <span className="cell-ellipsis" title={product.name}>
                    {product.name}
                  </span>
                </td>
                <td className="muted">
                  <span className="cell-ellipsis cell-ellipsis-sm" title={brandName(product.brandId)}>
                    {brandName(product.brandId)}
                  </span>
                </td>
                <td className="muted">
                  <span className="cell-ellipsis cell-ellipsis-sm" title={categoryName(product.categoryId)}>
                    {categoryName(product.categoryId)}
                  </span>
                </td>
                <td>{formatPrix(product.price)}</td>
                <td>
                  {product.quantiteStock > 0 ? (
                    <span className="badge-new">Disponible</span>
                  ) : (
                    <span className="badge-sale">Épuisé</span>
                  )}
                  {product.afficherQuantite && (
                    <span className="muted"> ({product.quantiteStock})</span>
                  )}
                </td>
                <td>
                  {product.isNew && <span className="badge-new">Nouveau</span>}
                  {product.onPromotion && <span className="badge-promo">Promo</span>}
                  {product.onSale && <span className="badge-sale">Solde</span>}
                </td>
                <td>
                  <div className="actions actions-inline products-table-actions">
                    <button onClick={() => setEditingId(product.id)}>
                      Modifier
                    </button>
                    <button onClick={() => setStatusProductId(product.id)}>
                      Statuts
                    </button>
                    <button
                      className="danger"
                      onClick={() => {
                        if (confirm(`Supprimer le produit "${product.name}" ?`)) {
                          removeMutation.mutate(product.id);
                        }
                      }}
                    >
                      Supprimer
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {sortedProducts.length === 0 && (
              <tr>
                <td colSpan={11} className="muted">
                  Aucun produit.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
      </div>

      {statusProductId && (
        <ProductStatusDialog
          product={sortedProducts.find((p) => p.id === statusProductId) as Product}
          onClose={() => setStatusProductId(null)}
        />
      )}
    </div>
  );
}
