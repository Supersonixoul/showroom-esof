import { Fragment, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { categoriesApi, mediaUrl, subcategoriesApi, uploadMedia } from '../api/client';
import type { Category, Subcategory } from '../api/types';

export function CategoriesPage() {
  const queryClient = useQueryClient();
  const { data: categories, isLoading, error } = useQuery({
    queryKey: ['categories'],
    queryFn: categoriesApi.list,
  });

  const [name, setName] = useState('');
  const [parentId, setParentId] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['categories'] });

  const createMutation = useMutation({
    mutationFn: categoriesApi.create,
    onSuccess: () => {
      invalidate();
      resetForm();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Category> }) =>
      categoriesApi.update(id, data),
    onSuccess: () => {
      invalidate();
      resetForm();
    },
  });

  const removeMutation = useMutation({
    mutationFn: categoriesApi.remove,
    onSuccess: invalidate,
  });

  function resetForm() {
    setName('');
    setParentId('');
    setEditingId(null);
  }

  function startEdit(category: Category) {
    setEditingId(category.id);
    setName(category.name);
    setParentId(category.parentId ?? '');
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const data = { name, parentId: parentId || undefined };
    if (editingId) {
      updateMutation.mutate({ id: editingId, data });
    } else {
      createMutation.mutate(data);
    }
  }

  const saving = createMutation.isPending || updateMutation.isPending;
  const mutationError = createMutation.error || updateMutation.error;
  const removeError = removeMutation.error;

  function parentName(id: string | null | undefined) {
    if (!id) return '—';
    return categories?.find((c) => c.id === id)?.name ?? '—';
  }

  return (
    <div>
      <div className="page-header">
        <h2>Catégories</h2>
      </div>

      {error && (
        <div className="error-banner">Impossible de charger les catégories.</div>
      )}
      {mutationError && (
        <div className="error-banner">{(mutationError as Error).message}</div>
      )}
      {removeError && (
        <div className="error-banner">{(removeError as Error).message}</div>
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
            Catégorie parente
            <select
              value={parentId}
              onChange={(e) => setParentId(e.target.value)}
            >
              <option value="">Aucune (racine)</option>
              {categories
                ?.filter((c) => c.id !== editingId)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </select>
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
              <th></th>
              <th>Nom</th>
              <th>Parente</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {categories?.map((category) => (
              <Fragment key={category.id}>
                <tr>
                  <td>
                    <button
                      type="button"
                      className="icon-btn"
                      aria-label="Sous-catégories"
                      title="Sous-catégories"
                      onClick={() =>
                        setExpandedId(
                          expandedId === category.id ? null : category.id,
                        )
                      }
                    >
                      {expandedId === category.id ? '▾' : '▸'}
                    </button>
                  </td>
                  <td>{category.name}</td>
                  <td className="muted">{parentName(category.parentId)}</td>
                  <td>
                    <div className="actions">
                      <button onClick={() => startEdit(category)}>
                        Modifier
                      </button>
                      <button
                        className="danger"
                        onClick={() => {
                          if (
                            confirm(
                              `Supprimer la catégorie "${category.name}" ?`,
                            )
                          ) {
                            removeMutation.mutate(category.id);
                          }
                        }}
                      >
                        Supprimer
                      </button>
                    </div>
                  </td>
                </tr>
                {expandedId === category.id && (
                  <tr>
                    <td></td>
                    <td colSpan={3}>
                      <SubcategoriesPanel categoryId={category.id} />
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
            {categories?.length === 0 && (
              <tr>
                <td colSpan={4} className="muted">
                  Aucune catégorie.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}

function truncate(text: string | null | undefined, max: number) {
  if (!text) return '—';
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

function SubcategoriesPanel({ categoryId }: { categoryId: string }) {
  const queryClient = useQueryClient();
  const queryKey = ['subcategories', categoryId];
  const { data: subcategories, isLoading, error } = useQuery({
    queryKey,
    queryFn: () => subcategoriesApi.list(categoryId),
  });

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const invalidate = () => queryClient.invalidateQueries({ queryKey });

  const createMutation = useMutation({
    mutationFn: subcategoriesApi.create,
    onSuccess: () => {
      invalidate();
      resetForm();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Subcategory> }) =>
      subcategoriesApi.update(id, data),
    onSuccess: () => {
      invalidate();
      resetForm();
    },
  });

  const removeMutation = useMutation({
    mutationFn: subcategoriesApi.remove,
    onSuccess: invalidate,
  });

  const moveMutation = useMutation({
    mutationFn: ({ id, direction }: { id: string; direction: 'up' | 'down' }) =>
      subcategoriesApi.move(id, direction),
    onSuccess: invalidate,
  });

  function resetForm() {
    setName('');
    setDescription('');
    setImageUrl('');
    setEditingId(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function startEdit(subcategory: Subcategory) {
    setEditingId(subcategory.id);
    setName(subcategory.name);
    setDescription(subcategory.description ?? '');
    setImageUrl(subcategory.imageUrl ?? '');
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
  const mutationError = createMutation.error || updateMutation.error;
  const removeError = removeMutation.error;

  return (
    <div className="subcategories-panel">
      {error && (
        <div className="error-banner">
          Impossible de charger les sous-catégories.
        </div>
      )}
      {mutationError && (
        <div className="error-banner">{(mutationError as Error).message}</div>
      )}
      {removeError && (
        <div className="error-banner">{(removeError as Error).message}</div>
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
              <th>Ordre</th>
              <th>Image</th>
              <th>Nom</th>
              <th>Description</th>
              <th>Produits</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {subcategories?.map((subcategory, index) => (
              <tr key={subcategory.id}>
                <td>
                  <div className="reorder-buttons">
                    <button
                      type="button"
                      className="icon-btn"
                      disabled={index === 0}
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
                      disabled={index === (subcategories?.length ?? 0) - 1}
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
                <td>
                  {subcategory.imageUrl ? (
                    <img
                      className="video-thumb"
                      src={mediaUrl(subcategory.imageUrl)}
                      alt={subcategory.name}
                    />
                  ) : (
                    <span className="muted">—</span>
                  )}
                </td>
                <td>{subcategory.name}</td>
                <td className="muted" title={subcategory.description ?? ''}>
                  {truncate(subcategory.description, 60)}
                </td>
                <td>{subcategory._count?.products ?? 0}</td>
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
            {subcategories?.length === 0 && (
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
  );
}
