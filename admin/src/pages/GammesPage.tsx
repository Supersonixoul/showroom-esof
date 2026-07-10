import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { brandsApi, gammesApi, mediaUrl, uploadMedia } from '../api/client';
import type { Gamme } from '../api/types';

function truncate(text: string | null | undefined, max: number) {
  if (!text) return '—';
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

function conflictMessage(err: unknown, fallback: string) {
  const message = (err as Error)?.message ?? '';
  return message.startsWith('409') ? fallback : message;
}

export function GammesPage() {
  const queryClient = useQueryClient();
  const { data: brands } = useQuery({
    queryKey: ['brands'],
    queryFn: brandsApi.list,
  });

  const [brandFilter, setBrandFilter] = useState('');
  const {
    data: gammes,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['gammes', brandFilter],
    queryFn: () => gammesApi.list(brandFilter || undefined),
  });

  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [brandId, setBrandId] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!successMessage) return;
    const timeout = setTimeout(() => setSuccessMessage(null), 3000);
    return () => clearTimeout(timeout);
  }, [successMessage]);

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['gammes'] });

  const createMutation = useMutation({
    mutationFn: gammesApi.create,
    onSuccess: () => {
      invalidate();
      setSuccessMessage('Gamme créée.');
      resetForm();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Gamme> }) =>
      gammesApi.update(id, data),
    onSuccess: () => {
      invalidate();
      setSuccessMessage('Gamme modifiée.');
      resetForm();
    },
  });

  const removeMutation = useMutation({
    mutationFn: gammesApi.remove,
    onSuccess: () => {
      invalidate();
      setSuccessMessage('Gamme supprimée.');
    },
  });

  const moveMutation = useMutation({
    mutationFn: ({ id, direction }: { id: string; direction: 'up' | 'down' }) =>
      gammesApi.move(id, direction),
    onSuccess: () => {
      invalidate();
      setSuccessMessage('Ordre mis à jour.');
    },
  });

  function resetForm() {
    setShowForm(false);
    setName('');
    setDescription('');
    setImageUrl('');
    setBrandId('');
    setEditingId(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function openCreateForm() {
    setEditingId(null);
    setName('');
    setDescription('');
    setImageUrl('');
    setBrandId(brandFilter || '');
    if (fileInputRef.current) fileInputRef.current.value = '';
    setShowForm(true);
  }

  function startEdit(gamme: Gamme) {
    setEditingId(gamme.id);
    setName(gamme.name);
    setDescription(gamme.description ?? '');
    setImageUrl(gamme.imageUrl ?? '');
    setBrandId(gamme.brandId);
    if (fileInputRef.current) fileInputRef.current.value = '';
    setShowForm(true);
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const result = await uploadMedia(file, 'gammes');
      setImageUrl(result.url);
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setUploading(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const data = {
      name,
      description: description || undefined,
      imageUrl: imageUrl || undefined,
      brandId,
    };
    if (editingId) {
      updateMutation.mutate({ id: editingId, data });
    } else {
      createMutation.mutate(data);
    }
  }

  const saving = createMutation.isPending || updateMutation.isPending;
  const mutationError = createMutation.error || updateMutation.error;
  const removeError = removeMutation.error;

  function brandName(id: string) {
    return brands?.find((b) => b.id === id)?.name ?? '—';
  }

  const sortedGammes = [...(gammes ?? [])].sort((a, b) => {
    if (a.brandId !== b.brandId) {
      return brandName(a.brandId).localeCompare(brandName(b.brandId));
    }
    return a.displayOrder - b.displayOrder;
  });

  const reorderEnabled = brandFilter !== '';

  return (
    <div>
      <div className="page-header">
        <h2>Gammes</h2>
      </div>

      {error && (
        <div className="error-banner">Impossible de charger les gammes.</div>
      )}
      {mutationError && (
        <div className="error-banner">
          {conflictMessage(
            mutationError,
            'Une gamme de ce nom existe déjà pour cette marque.',
          )}
        </div>
      )}
      {removeError && (
        <div className="error-banner">
          {conflictMessage(
            removeError,
            'Impossible de supprimer : des produits sont rattachés à cette gamme. Détachez-les d\u2019abord.',
          )}
        </div>
      )}
      {successMessage && (
        <div className="success-banner">{successMessage}</div>
      )}

      <div className="form-row" style={{ alignItems: 'flex-end' }}>
        <label>
          Marque
          <select
            value={brandFilter}
            onChange={(e) => setBrandFilter(e.target.value)}
          >
            <option value="">Toutes les marques</option>
            {brands?.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </label>
        <div className="actions">
          <button type="button" className="primary" onClick={openCreateForm}>
            + Ajouter une gamme
          </button>
        </div>
      </div>

      {showForm && (
        <form className="form-panel" onSubmit={handleSubmit}>
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
              Nom
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </label>
            <label>
              Description
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </label>
            <label>
              Image (optionnel)
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
              />
            </label>
          </div>
          <div className="actions">
            <button
              type="submit"
              className="primary"
              disabled={saving || uploading}
            >
              {uploading
                ? 'Envoi…'
                : editingId
                  ? 'Enregistrer'
                  : 'Ajouter'}
            </button>
            <button type="button" onClick={resetForm}>
              Annuler
            </button>
          </div>
        </form>
      )}

      {isLoading ? (
        <p className="muted">Chargement…</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Ordre</th>
              <th>Nom</th>
              <th>Marque</th>
              <th>Description</th>
              <th>Image</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {sortedGammes.map((gamme, index) => (
              <tr key={gamme.id}>
                <td>
                  <div className="reorder-buttons">
                    <button
                      type="button"
                      className="icon-btn"
                      disabled={!reorderEnabled || index === 0}
                      aria-label="Monter"
                      title="Monter"
                      onClick={() =>
                        moveMutation.mutate({ id: gamme.id, direction: 'up' })
                      }
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      className="icon-btn"
                      disabled={
                        !reorderEnabled || index === sortedGammes.length - 1
                      }
                      aria-label="Descendre"
                      title="Descendre"
                      onClick={() =>
                        moveMutation.mutate({ id: gamme.id, direction: 'down' })
                      }
                    >
                      ↓
                    </button>
                  </div>
                </td>
                <td>{gamme.name}</td>
                <td className="muted">{brandName(gamme.brandId)}</td>
                <td className="muted" title={gamme.description ?? ''}>
                  {truncate(gamme.description, 60)}
                </td>
                <td>
                  {gamme.imageUrl ? (
                    <img
                      className="thumb"
                      src={mediaUrl(gamme.imageUrl)}
                      alt={gamme.name}
                    />
                  ) : (
                    <span className="muted">—</span>
                  )}
                </td>
                <td>
                  <div className="actions">
                    <button onClick={() => startEdit(gamme)}>Modifier</button>
                    <button
                      className="danger"
                      onClick={() => {
                        if (confirm(`Supprimer la gamme "${gamme.name}" ?`)) {
                          removeMutation.mutate(gamme.id);
                        }
                      }}
                    >
                      Supprimer
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {sortedGammes.length === 0 && (
              <tr>
                <td colSpan={6} className="muted">
                  Aucune gamme.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}
