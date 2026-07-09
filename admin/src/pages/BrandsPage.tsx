import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { brandsApi, mediaUrl, uploadMedia } from '../api/client';
import type { Brand } from '../api/types';

export function BrandsPage() {
  const queryClient = useQueryClient();
  const { data: brands, isLoading, error } = useQuery({
    queryKey: ['brands'],
    queryFn: brandsApi.list,
  });

  const [name, setName] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['brands'] });

  const createMutation = useMutation({
    mutationFn: brandsApi.create,
    onSuccess: () => {
      invalidate();
      resetForm();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Brand> }) =>
      brandsApi.update(id, data),
    onSuccess: () => {
      invalidate();
      resetForm();
    },
  });

  const removeMutation = useMutation({
    mutationFn: brandsApi.remove,
    onSuccess: invalidate,
  });

  function resetForm() {
    setName('');
    setLogoUrl('');
    setEditingId(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const result = await uploadMedia(file, 'brands');
      setLogoUrl(result.url);
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  function startEdit(brand: Brand) {
    setEditingId(brand.id);
    setName(brand.name);
    setLogoUrl(brand.logoUrl ?? '');
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const data = { name, logoUrl: logoUrl || undefined };
    if (editingId) {
      updateMutation.mutate({ id: editingId, data });
    } else {
      createMutation.mutate(data);
    }
  }

  const saving = createMutation.isPending || updateMutation.isPending;
  const mutationError = createMutation.error || updateMutation.error;

  return (
    <div>
      <div className="page-header">
        <h2>Marques</h2>
      </div>

      {error && (
        <div className="error-banner">Impossible de charger les marques.</div>
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
            Logo
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              disabled={uploading}
            />
          </label>
        </div>
        <div className="form-row">
          <label>
            Logo (URL manuelle, optionnel)
            <input
              value={logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
              placeholder="https://…"
            />
          </label>
        </div>
        {logoUrl && (
          <div className="form-row">
            <img className="thumb" src={mediaUrl(logoUrl)} alt="Aperçu logo" />
          </div>
        )}
        <div className="actions">
          {uploading && <span className="muted">Envoi…</span>}
          <button type="submit" className="primary" disabled={saving || uploading}>
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
              <th>Logo</th>
              <th>Nom</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {brands?.map((brand) => (
              <tr key={brand.id}>
                <td>
                  {brand.logoUrl ? (
                    <img className="thumb" src={mediaUrl(brand.logoUrl)} alt="" />
                  ) : (
                    <span className="muted">—</span>
                  )}
                </td>
                <td>{brand.name}</td>
                <td>
                  <div className="actions">
                    <button onClick={() => startEdit(brand)}>Modifier</button>
                    <button
                      className="danger"
                      onClick={() => {
                        if (confirm(`Supprimer la marque "${brand.name}" ?`)) {
                          removeMutation.mutate(brand.id);
                        }
                      }}
                    >
                      Supprimer
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {brands?.length === 0 && (
              <tr>
                <td colSpan={3} className="muted">
                  Aucune marque.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}
