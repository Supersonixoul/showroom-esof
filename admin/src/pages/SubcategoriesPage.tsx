import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  categoriesApi,
  mediaUrl,
  subcategoriesApi,
  uploadMedia,
} from '../api/client';
import type { Subcategory } from '../api/types';

function truncate(text: string | null | undefined, max: number) {
  if (!text) return '—';
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

function conflictMessage(err: unknown, fallback: string) {
  const message = (err as Error)?.message ?? '';
  return message.startsWith('409') ? fallback : message;
}

export function SubcategoriesPage() {
  const queryClient = useQueryClient();
  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: categoriesApi.list,
  });

  const [categoryFilter, setCategoryFilter] = useState('');
  const {
    data: subcategories,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['subcategories', categoryFilter],
    queryFn: () => subcategoriesApi.list(categoryFilter || undefined),
  });

  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [categoryId, setCategoryId] = useState('');
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
    queryClient.invalidateQueries({ queryKey: ['subcategories'] });

  const createMutation = useMutation({
    mutationFn: subcategoriesApi.create,
    onSuccess: () => {
      invalidate();
      setSuccessMessage('Sous-catégorie créée.');
      resetForm();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Subcategory> }) =>
      subcategoriesApi.update(id, data),
    onSuccess: () => {
      invalidate();
      setSuccessMessage('Sous-catégorie modifiée.');
      resetForm();
    },
  });

  const removeMutation = useMutation({
    mutationFn: subcategoriesApi.remove,
    onSuccess: () => {
      invalidate();
      setSuccessMessage('Sous-catégorie supprimée.');
    },
  });

  const moveMutation = useMutation({
    mutationFn: ({ id, direction }: { id: string; direction: 'up' | 'down' }) =>
      subcategoriesApi.move(id, direction),
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
    setCategoryId('');
    setEditingId(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function openCreateForm() {
    setEditingId(null);
    setName('');
    setDescription('');
    setImageUrl('');
    setCategoryId(categoryFilter || '');
    if (fileInputRef.current) fileInputRef.current.value = '';
    setShowForm(true);
  }

  function startEdit(subcategory: Subcategory) {
    setEditingId(subcategory.id);
    setName(subcategory.name);
    setDescription(subcategory.description ?? '');
    setImageUrl(subcategory.imageUrl ?? '');
    setCategoryId(subcategory.categoryId);
    if (fileInputRef.current) fileInputRef.current.value = '';
    setShowForm(true);
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const result = await uploadMedia(file, 'subcategories');
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
      categoryId,
    };
    if (editingId) {
      updateMutation.mutate({ id: editingId, data });
    } else {
      createMutation.mutate(data);
    }
  }

  const saving = createMutation.isPending || updateMutation.isPending;
  const mutationError =
    createMutation.error || updateMutation.error || moveMutation.error;
  const removeError = removeMutation.error;

  function categoryName(id: string) {
    return categories?.find((c) => c.id === id)?.name ?? '—';
  }

  const sortedSubcategories = [...(subcategories ?? [])].sort((a, b) => {
    if (a.categoryId !== b.categoryId) {
      return categoryName(a.categoryId).localeCompare(categoryName(b.categoryId));
    }
    return a.displayOrder - b.displayOrder;
  });

  function isFirstInGroup(index: number) {
    if (index === 0) return true;
    return (
      sortedSubcategories[index - 1].categoryId !==
      sortedSubcategories[index].categoryId
    );
  }

  function isLastInGroup(index: number) {
    if (index === sortedSubcategories.length - 1) return true;
    return (
      sortedSubcategories[index + 1].categoryId !==
      sortedSubcategories[index].categoryId
    );
  }

  return (
    <div className="page-fill">
      <div>
      <div className="page-header">
        <h2>Sous-Catégories</h2>
      </div>

      {error && (
        <div className="error-banner">
          Impossible de charger les sous-catégories.
        </div>
      )}
      {mutationError && (
        <div className="error-banner">
          {conflictMessage(
            mutationError,
            'Une sous-catégorie de ce nom existe déjà dans cette catégorie.',
          )}
        </div>
      )}
      {removeError && (
        <div className="error-banner">
          {conflictMessage(
            removeError,
            'Impossible de supprimer : des produits sont rattachés à cette sous-catégorie. Détachez-les d\u2019abord.',
          )}
        </div>
      )}
      {successMessage && (
        <div className="success-banner">{successMessage}</div>
      )}

      <div className="form-row" style={{ alignItems: 'flex-end' }}>
        <label>
          Catégorie
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
          >
            <option value="">Toutes les catégories</option>
            {categories?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <div className="actions">
          <button type="button" className="primary" onClick={openCreateForm}>
            + Ajouter une sous-catégorie
          </button>
        </div>
      </div>

      {showForm && (
        <form className="form-panel" onSubmit={handleSubmit}>
          <div className="form-row">
            <label>
              Catégorie parente
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
      </div>

      <div className="scroll-area">
      {isLoading ? (
        <p className="muted">Chargement…</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Ordre</th>
              <th>Nom</th>
              <th>Catégorie parente</th>
              <th>Description</th>
              <th>Image</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {sortedSubcategories.map((subcategory, index) => (
              <tr key={subcategory.id}>
                <td>
                  <div className="reorder-buttons">
                    <button
                      type="button"
                      className="icon-btn"
                      disabled={isFirstInGroup(index)}
                      aria-label="Monter"
                      title="Monter"
                      onClick={() =>
                        moveMutation.mutate({
                          id: subcategory.id,
                          direction: 'up',
                        })
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
                        moveMutation.mutate({
                          id: subcategory.id,
                          direction: 'down',
                        })
                      }
                    >
                      ↓
                    </button>
                  </div>
                </td>
                <td>{subcategory.name}</td>
                <td className="muted">{categoryName(subcategory.categoryId)}</td>
                <td className="muted" title={subcategory.description ?? ''}>
                  {truncate(subcategory.description, 60)}
                </td>
                <td>
                  {subcategory.imageUrl ? (
                    <img
                      className="thumb"
                      src={mediaUrl(subcategory.imageUrl)}
                      alt={subcategory.name}
                    />
                  ) : (
                    <span className="muted">—</span>
                  )}
                </td>
                <td>
                  <div className="actions">
                    <button onClick={() => startEdit(subcategory)}>
                      Modifier
                    </button>
                    <button
                      className="danger"
                      onClick={() => {
                        if (
                          confirm(
                            `Supprimer la sous-catégorie "${subcategory.name}" ?`,
                          )
                        ) {
                          removeMutation.mutate(subcategory.id);
                        }
                      }}
                    >
                      Supprimer
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {sortedSubcategories.length === 0 && (
              <tr>
                <td colSpan={6} className="muted">
                  Aucune sous-catégorie.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
      </div>
    </div>
  );
}
