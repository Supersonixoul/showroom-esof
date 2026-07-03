import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { brandsApi, categoriesApi, mediaUrl, productsApi, uploadMedia } from '../api/client';
import type { Product } from '../api/types';

export function ProductsPage() {
  const queryClient = useQueryClient();
  const { data: products, isLoading, error } = useQuery({
    queryKey: ['products'],
    queryFn: productsApi.list,
  });
  const { data: brands } = useQuery({ queryKey: ['brands'], queryFn: brandsApi.list });
  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: categoriesApi.list,
  });

  const [name, setName] = useState('');
  const [reference, setReference] = useState('');
  const [description, setDescription] = useState('');
  const [brandId, setBrandId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['products'] });

  const createMutation = useMutation({
    mutationFn: productsApi.create,
    onSuccess: () => {
      invalidate();
      resetForm();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Product> }) =>
      productsApi.update(id, data),
    onSuccess: () => {
      invalidate();
      resetForm();
    },
  });

  const removeMutation = useMutation({
    mutationFn: productsApi.remove,
    onSuccess: () => {
      invalidate();
      if (selectedId) setSelectedId(null);
    },
  });

  function resetForm() {
    setName('');
    setReference('');
    setDescription('');
    setBrandId('');
    setCategoryId('');
    setEditingId(null);
  }

  function startEdit(product: Product) {
    setEditingId(product.id);
    setName(product.name);
    setReference(product.reference ?? '');
    setDescription(product.description ?? '');
    setBrandId(product.brandId);
    setCategoryId(product.categoryId);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const data = {
      name,
      reference: reference || undefined,
      description: description || undefined,
      brandId,
      categoryId,
    };
    if (editingId) {
      updateMutation.mutate({ id: editingId, data });
    } else {
      createMutation.mutate(data);
    }
  }

  const saving = createMutation.isPending || updateMutation.isPending;
  const mutationError = createMutation.error || updateMutation.error;

  function brandName(id: string) {
    return brands?.find((b) => b.id === id)?.name ?? '—';
  }
  function categoryName(id: string) {
    return categories?.find((c) => c.id === id)?.name ?? '—';
  }

  return (
    <div>
      <div className="page-header">
        <h2>Produits</h2>
      </div>

      {error && (
        <div className="error-banner">Impossible de charger les produits.</div>
      )}
      {mutationError && (
        <div className="error-banner">{(mutationError as Error).message}</div>
      )}

      <form className="form-panel" onSubmit={handleSubmit}>
        <div className="form-row">
          <label>
            Nom
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </label>
          <label>
            Référence
            <input
              value={reference}
              onChange={(e) => setReference(e.target.value)}
            />
          </label>
        </div>
        <div className="form-row">
          <label>
            Marque
            <select
              value={brandId}
              onChange={(e) => setBrandId(e.target.value)}
              required
            >
              <option value="" disabled>
                Choisir…
              </option>
              {brands?.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Catégorie
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              required
            >
              <option value="" disabled>
                Choisir…
              </option>
              {categories?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="form-row">
          <label>
            Description
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </label>
        </div>
        <div className="actions">
          <button type="submit" className="primary" disabled={saving}>
            {editingId ? 'Enregistrer' : 'Ajouter'}
          </button>
          {editingId && (
            <button type="button" onClick={resetForm}>
              Annuler
            </button>
          )}
        </div>
      </form>

      {isLoading ? (
        <p className="muted">Chargement…</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Nom</th>
              <th>Marque</th>
              <th>Catégorie</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {products?.map((product) => (
              <tr key={product.id}>
                <td>{product.name}</td>
                <td className="muted">{brandName(product.brandId)}</td>
                <td className="muted">{categoryName(product.categoryId)}</td>
                <td>
                  <div className="actions">
                    <button
                      onClick={() =>
                        setSelectedId(
                          selectedId === product.id ? null : product.id,
                        )
                      }
                    >
                      {selectedId === product.id ? 'Fermer' : 'Détails'}
                    </button>
                    <button onClick={() => startEdit(product)}>
                      Modifier
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
            {products?.length === 0 && (
              <tr>
                <td colSpan={4} className="muted">
                  Aucun produit.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}

      {selectedId && <ProductDetail productId={selectedId} />}
    </div>
  );
}

function ProductDetail({ productId }: { productId: string }) {
  const queryClient = useQueryClient();
  const { data: product, isLoading } = useQuery({
    queryKey: ['products', productId],
    queryFn: () => productsApi.get(productId),
  });

  const [specLabel, setSpecLabel] = useState('');
  const [specValue, setSpecValue] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['products', productId] });
    queryClient.invalidateQueries({ queryKey: ['products'] });
  };

  const addSpecMutation = useMutation({
    mutationFn: (data: { label: string; value: string }) =>
      productsApi.addSpec(productId, data),
    onSuccess: () => {
      invalidate();
      setSpecLabel('');
      setSpecValue('');
    },
  });

  const removeSpecMutation = useMutation({
    mutationFn: (specId: string) => productsApi.removeSpec(productId, specId),
    onSuccess: invalidate,
  });

  const addImageMutation = useMutation({
    mutationFn: (data: { url: string; position?: number }) =>
      productsApi.addImage(productId, data),
    onSuccess: invalidate,
  });

  const removeImageMutation = useMutation({
    mutationFn: (imageId: string) => productsApi.removeImage(productId, imageId),
    onSuccess: invalidate,
  });

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const result = await uploadMedia(file);
      const position = product?.images?.length ?? 0;
      await addImageMutation.mutateAsync({ url: result.url, position });
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  if (isLoading || !product) {
    return <p className="muted">Chargement des détails…</p>;
  }

  return (
    <div className="form-panel">
      <h3>{product.name} — Caractéristiques &amp; images</h3>

      <h4>Caractéristiques</h4>
      <table style={{ marginBottom: 16 }}>
        <thead>
          <tr>
            <th>Label</th>
            <th>Valeur</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {product.specs?.map((spec) => (
            <tr key={spec.id}>
              <td>{spec.label}</td>
              <td>{spec.value}</td>
              <td>
                <button
                  className="danger"
                  onClick={() => removeSpecMutation.mutate(spec.id)}
                >
                  Supprimer
                </button>
              </td>
            </tr>
          ))}
          {(!product.specs || product.specs.length === 0) && (
            <tr>
              <td colSpan={3} className="muted">
                Aucune caractéristique.
              </td>
            </tr>
          )}
        </tbody>
      </table>
      <form
        className="form-row"
        onSubmit={(e) => {
          e.preventDefault();
          if (!specLabel || !specValue) return;
          addSpecMutation.mutate({ label: specLabel, value: specValue });
        }}
      >
        <label>
          Label
          <input
            value={specLabel}
            onChange={(e) => setSpecLabel(e.target.value)}
          />
        </label>
        <label>
          Valeur
          <input
            value={specValue}
            onChange={(e) => setSpecValue(e.target.value)}
          />
        </label>
        <div className="actions" style={{ alignItems: 'flex-end' }}>
          <button type="submit" disabled={addSpecMutation.isPending}>
            Ajouter
          </button>
        </div>
      </form>

      <h4 style={{ marginTop: 20 }}>Images</h4>
      <div className="form-row">
        {product.images?.map((image) => (
          <div key={image.id} style={{ textAlign: 'center' }}>
            <img className="thumb" src={mediaUrl(image.url)} alt="" style={{ width: 80, height: 80 }} />
            <div>
              <button
                className="danger"
                onClick={() => removeImageMutation.mutate(image.id)}
              >
                Supprimer
              </button>
            </div>
          </div>
        ))}
      </div>
      <div className="actions">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          disabled={uploading}
        />
        {uploading && <span className="muted">Envoi…</span>}
      </div>
    </div>
  );
}
