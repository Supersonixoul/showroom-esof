import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  brandsApi,
  categoriesApi,
  gammesApi,
  mediaUrl,
  productsApi,
  subcategoriesApi,
  uploadMedia,
} from '../api/client';
import type { Product } from '../api/types';
import { ImportProductsDialog } from '../components/ImportProductsDialog';
import { formatPrix } from '../utils/formatPrix';

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
  const [price, setPrice] = useState('');
  const [brandId, setBrandId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [subcategoryId, setSubcategoryId] = useState('');
  const [gammeId, setGammeId] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const { data: subcategories } = useQuery({
    queryKey: ['subcategories', categoryId],
    queryFn: () => subcategoriesApi.list(categoryId),
    enabled: !!categoryId,
  });
  const { data: gammes } = useQuery({
    queryKey: ['gammes', brandId],
    queryFn: () => gammesApi.list(brandId),
    enabled: !!brandId,
  });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);

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

  function resetForm() {
    setName('');
    setReference('');
    setDescription('');
    setPrice('');
    setBrandId('');
    setCategoryId('');
    setSubcategoryId('');
    setGammeId('');
    setEditingId(null);
    setImageFile(null);
    setImagePreview(null);
    if (imageInputRef.current) imageInputRef.current.value = '';
  }

  function startEdit(product: Product) {
    setEditingId(product.id);
    setName(product.name);
    setReference(product.reference ?? '');
    setDescription(product.description ?? '');
    setPrice(product.price != null ? String(product.price) : '');
    setBrandId(product.brandId ?? '');
    setCategoryId(product.categoryId);
    setSubcategoryId(product.subcategoryId ?? '');
    setGammeId(product.gammeId ?? '');
    setImageFile(null);
    setImagePreview(
      product.images && product.images.length > 0
        ? mediaUrl(product.images[0].url)
        : null,
    );
    if (imageInputRef.current) imageInputRef.current.value = '';
  }

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setImageFile(file);
    setImagePreview(file ? URL.createObjectURL(file) : null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const data = {
      name,
      reference: reference || undefined,
      description: description || undefined,
      price: price !== '' ? Number(price) : undefined,
      brandId: brandId || null,
      categoryId,
      subcategoryId: subcategoryId || null,
      gammeId: gammeId || null,
    };
    const product = editingId
      ? await updateMutation.mutateAsync({ id: editingId, data })
      : await createMutation.mutateAsync(data);

    if (imageFile) {
      setUploadingImage(true);
      try {
        const result = await uploadMedia(imageFile, 'products');
        await productsApi.addImage(product.id, {
          url: result.url,
          position: product.images?.length ?? 0,
        });
        invalidate();
      } catch (err) {
        alert((err as Error).message);
      } finally {
        setUploadingImage(false);
      }
    }
  }

  const saving = createMutation.isPending || updateMutation.isPending;
  const mutationError =
    createMutation.error || updateMutation.error || setVisibilityMutation.error;

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

        <form className="form-panel" onSubmit={handleSubmit}>
        <div className="form-row">
          <label style={{ flex: '0 1 calc((100% - 36px) / 4)' }}>
            Référence
            <input
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              maxLength={30}
            />
          </label>
          <label>
            Nom
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </label>
        </div>
        <div className="form-row">
          <label>
            Marque (optionnel)
            <select
              value={brandId}
              onChange={(e) => {
                setBrandId(e.target.value);
                setGammeId('');
              }}
            >
              <option value="">Aucune</option>
              {brands?.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Gamme (optionnel)
            <select
              value={gammeId}
              onChange={(e) => setGammeId(e.target.value)}
              disabled={!brandId}
            >
              <option value="">Aucune</option>
              {gammes?.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Catégorie
            <select
              value={categoryId}
              onChange={(e) => {
                setCategoryId(e.target.value);
                setSubcategoryId('');
              }}
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
          <label>
            Sous-catégorie (optionnel)
            <select
              value={subcategoryId}
              onChange={(e) => setSubcategoryId(e.target.value)}
              disabled={!categoryId}
            >
              <option value="">Aucune</option>
              {subcategories?.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
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
          <label>
            Prix (F)
            <input
              type="number"
              step="1"
              min="0"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
          </label>
        </div>
        <div className="form-row">
          <label>
            Image
            <div className="actions" style={{ alignItems: 'center' }}>
              {imagePreview && (
                <div className="product-photo-frame" style={{ width: 60, height: 60 }}>
                  <img src={imagePreview} alt="" loading="lazy" />
                </div>
              )}
              <button
                type="button"
                onClick={() => imageInputRef.current?.click()}
              >
                Choisir une image
              </button>
              {imageFile && <span className="muted">{imageFile.name}</span>}
              <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                style={{ display: 'none' }}
              />
            </div>
          </label>
        </div>
        <div className="actions">
          <button type="submit" className="primary" disabled={saving || uploadingImage}>
            {editingId ? 'Enregistrer' : 'Ajouter'}
          </button>
          {editingId && (
            <button type="button" onClick={resetForm}>
              Annuler
            </button>
          )}
          {uploadingImage && <span className="muted">Envoi de l'image…</span>}
        </div>
        </form>
      </div>

      <div className="scroll-area">
      {isLoading ? (
        <p className="muted">Chargement…</p>
      ) : (
        <table>
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
                <td className="muted">{product.reference || '—'}</td>
                <td>{product.name}</td>
                <td className="muted">{brandName(product.brandId)}</td>
                <td className="muted">{categoryName(product.categoryId)}</td>
                <td>{formatPrix(product.price)}</td>
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
            {sortedProducts.length === 0 && (
              <tr>
                <td colSpan={9} className="muted">
                  Aucun produit.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}

      {selectedId && <ProductDetail productId={selectedId} />}
      </div>
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

  const moveImageMutation = useMutation({
    mutationFn: ({ imageId, direction }: { imageId: string; direction: 'up' | 'down' }) =>
      productsApi.moveImage(productId, imageId, direction),
    onSuccess: invalidate,
  });

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const result = await uploadMedia(file, 'products');
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
      {product.images && product.images.length > 0 && (
        <div
          className="product-photo-main"
          style={{ width: '100%', maxWidth: 480, height: 320, marginBottom: 12 }}
        >
          <img
            src={mediaUrl(
              product.images[0].imageVariants?.medium ?? product.images[0].url,
            )}
            srcSet={
              product.images[0].imageVariants
                ? `${mediaUrl(product.images[0].imageVariants.medium)} 800w, ${mediaUrl(product.images[0].imageVariants.full)} 1600w`
                : undefined
            }
            sizes="(max-width: 640px) 100vw, 480px"
            alt=""
            loading="lazy"
          />
        </div>
      )}
      <div className="form-row">
        {product.images?.map((image, index) => (
          <div key={image.id} style={{ textAlign: 'center' }}>
            <div className="product-photo-frame" style={{ width: 80, height: 80, margin: '0 auto' }}>
              <img src={mediaUrl(image.imageVariants?.thumb ?? image.url)} alt="" loading="lazy" />
            </div>
            <div className="reorder-buttons" style={{ justifyContent: 'center' }}>
              <button
                type="button"
                className="icon-btn"
                disabled={index === 0}
                aria-label="Précédente"
                title="Précédente"
                onClick={() =>
                  moveImageMutation.mutate({ imageId: image.id, direction: 'up' })
                }
              >
                ←
              </button>
              <button
                type="button"
                className="icon-btn"
                disabled={index === (product.images?.length ?? 0) - 1}
                aria-label="Suivante"
                title="Suivante"
                onClick={() =>
                  moveImageMutation.mutate({ imageId: image.id, direction: 'down' })
                }
              >
                →
              </button>
            </div>
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
