import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { brandsApi } from '../api/client';
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
            Logo (URL)
            <input
              value={logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
              placeholder="https://…"
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
                    <img className="thumb" src={brand.logoUrl} alt="" />
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
