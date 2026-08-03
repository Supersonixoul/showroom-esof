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

interface Props {
  /** Produit à modifier ; absent/`null` = création d'un nouveau produit. */
  product?: Product | null;
  onSuccess: (product: Product) => void;
  onCancel?: () => void;
}

/**
 * Formulaire de création/édition d'un produit — extrait de `ProductsPage`
 * pour être réutilisable ailleurs (ex. page « Articles d'une catégorie »)
 * sans dupliquer la logique. Ne fournit aucun habillage modal : à envelopper
 * dans `.modal-overlay`/`.modal` si besoin, ou à rendre inline comme dans
 * `ProductsPage`. Comportement identique à l'original.
 */
export function ProductForm({ product, onSuccess, onCancel }: Props) {
  const queryClient = useQueryClient();
  const editingId = product?.id ?? null;

  const { data: brands } = useQuery({ queryKey: ['brands'], queryFn: brandsApi.list });
  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: categoriesApi.list,
  });

  const [name, setName] = useState(product?.name ?? '');
  const [reference, setReference] = useState(product?.reference ?? '');
  const [description, setDescription] = useState(product?.description ?? '');
  const [price, setPrice] = useState(product?.price != null ? String(product.price) : '');
  const [quantiteStock, setQuantiteStock] = useState(String(product?.quantiteStock ?? 0));
  const [afficherQuantite, setAfficherQuantite] = useState(product?.afficherQuantite ?? false);
  const [brandId, setBrandId] = useState(product?.brandId ?? '');
  const [categoryId, setCategoryId] = useState(product?.categoryId ?? '');
  const [subcategoryId, setSubcategoryId] = useState(product?.subcategoryId ?? '');
  const [gammeId, setGammeId] = useState(product?.gammeId ?? '');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(
    product?.images && product.images.length > 0
      ? mediaUrl(product.images[0].url)
      : null,
  );
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

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['products'] });

  const createMutation = useMutation({
    mutationFn: productsApi.create,
    onSuccess: (created) => {
      invalidate();
      onSuccess(created);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Product> }) =>
      productsApi.update(id, data),
    onSuccess: (updated) => {
      invalidate();
      onSuccess(updated);
    },
  });

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
      quantiteStock: quantiteStock !== '' ? Number(quantiteStock) : undefined,
      afficherQuantite,
      brandId: brandId || null,
      categoryId,
      subcategoryId: subcategoryId || null,
      gammeId: gammeId || null,
    };
    const saved = editingId
      ? await updateMutation.mutateAsync({ id: editingId, data })
      : await createMutation.mutateAsync(data);

    if (imageFile) {
      setUploadingImage(true);
      try {
        const result = await uploadMedia(imageFile, 'products');
        await productsApi.addImage(saved.id, {
          url: result.url,
          position: saved.images?.length ?? 0,
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
  const mutationError = createMutation.error || updateMutation.error;

  return (
    <>
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
            Quantité en stock
            <input
              type="number"
              step="1"
              min="0"
              value={quantiteStock}
              onChange={(e) => setQuantiteStock(e.target.value)}
            />
          </label>
          <div className="checkbox-row">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={afficherQuantite}
                onChange={(e) => setAfficherQuantite(e.target.checked)}
              />
              Afficher la quantité exacte aux apps publiques
            </label>
          </div>
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
          {editingId && onCancel && (
            <button type="button" onClick={onCancel}>
              Annuler
            </button>
          )}
          {uploadingImage && <span className="muted">Envoi de l'image…</span>}
        </div>
      </form>
    </>
  );
}
