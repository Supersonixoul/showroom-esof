import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { commerciauxApi } from '../api/client';
import type { AgentCommercial } from '../api/types';
import { PasswordInput } from '../components/PasswordInput';

const TELEPHONE_PATTERN = '^\\+226\\d{8}$';
const TELEPHONE_HELP = 'Format attendu : +226 suivi de 8 chiffres (ex. +22670123456)';

function conflictMessage(err: unknown, fallback: string) {
  const message = (err as Error)?.message ?? '';
  return message.startsWith('409') ? fallback : message;
}

export function CommerciauxPage() {
  const queryClient = useQueryClient();
  const { data: commerciaux, isLoading, error } = useQuery({
    queryKey: ['commerciaux'],
    queryFn: commerciauxApi.list,
  });

  const [showForm, setShowForm] = useState(false);
  const [nom, setNom] = useState('');
  const [prenom, setPrenom] = useState('');
  const [telephone1, setTelephone1] = useState('');
  const [telephone2, setTelephone2] = useState('');
  const [identifiant, setIdentifiant] = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!successMessage) return;
    const timeout = setTimeout(() => setSuccessMessage(null), 3000);
    return () => clearTimeout(timeout);
  }, [successMessage]);

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['commerciaux'] });

  const createMutation = useMutation({
    mutationFn: commerciauxApi.create,
    onSuccess: () => {
      invalidate();
      setSuccessMessage('Commercial ajouté.');
      resetForm();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<AgentCommercial> }) =>
      commerciauxApi.update(id, data),
    onSuccess: () => {
      invalidate();
      setSuccessMessage('Commercial modifié.');
      resetForm();
    },
  });

  const removeMutation = useMutation({
    mutationFn: commerciauxApi.remove,
    onSuccess: () => {
      invalidate();
      setSuccessMessage('Commercial désactivé.');
    },
  });

  function resetForm() {
    setShowForm(false);
    setNom('');
    setPrenom('');
    setTelephone1('');
    setTelephone2('');
    setIdentifiant('');
    setMotDePasse('');
    setEditingId(null);
  }

  function openCreateForm() {
    resetForm();
    setShowForm(true);
  }

  function startEdit(agent: AgentCommercial) {
    setEditingId(agent.id);
    setNom(agent.nom);
    setPrenom(agent.prenom);
    setTelephone1(agent.telephone1);
    setTelephone2(agent.telephone2 ?? '');
    setIdentifiant(agent.identifiant ?? '');
    setMotDePasse('');
    setShowForm(true);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const data = {
      nom,
      prenom,
      telephone1,
      telephone2: telephone2 || undefined,
      identifiant: identifiant || undefined,
      ...(motDePasse ? { motDePasse } : {}),
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

  const sortedCommerciaux = [...(commerciaux ?? [])].sort((a, b) =>
    a.nom.localeCompare(b.nom) || a.prenom.localeCompare(b.prenom),
  );

  return (
    <div className="page-fill">
      <div>
        <div className="page-header">
          <h2>Commerciaux</h2>
        </div>

        {error && (
          <div className="error-banner">Impossible de charger les commerciaux.</div>
        )}
        {mutationError && (
          <div className="error-banner">
            {conflictMessage(mutationError, "Format de téléphone invalide.")}
          </div>
        )}
        {removeError && (
          <div className="error-banner">{(removeError as Error).message}</div>
        )}
        {successMessage && (
          <div className="success-banner">{successMessage}</div>
        )}

        <div className="actions">
          <button type="button" className="primary" onClick={openCreateForm}>
            + Ajouter un commercial
          </button>
        </div>

        {showForm && (
          <form className="form-panel" onSubmit={handleSubmit}>
            <div className="form-row">
              <label>
                Nom
                <input value={nom} onChange={(e) => setNom(e.target.value)} required />
              </label>
              <label>
                Prénom
                <input
                  value={prenom}
                  onChange={(e) => setPrenom(e.target.value)}
                  required
                />
              </label>
              <label>
                Téléphone 1
                <input
                  value={telephone1}
                  onChange={(e) => setTelephone1(e.target.value)}
                  pattern={TELEPHONE_PATTERN}
                  placeholder="+22670123456"
                  title={TELEPHONE_HELP}
                  required
                />
                <span className="muted" style={{ fontSize: 12 }}>{TELEPHONE_HELP}</span>
              </label>
              <label>
                Téléphone 2 (optionnel)
                <input
                  value={telephone2}
                  onChange={(e) => setTelephone2(e.target.value)}
                  pattern={TELEPHONE_PATTERN}
                  placeholder="+22670123456"
                  title={TELEPHONE_HELP}
                />
              </label>
              <label>
                Identifiant (rubrique Traitement, optionnel)
                <input
                  value={identifiant}
                  onChange={(e) => setIdentifiant(e.target.value)}
                  placeholder="ex. jdupont"
                  autoComplete="off"
                />
              </label>
              <label>
                Mot de passe {editingId ? '(laisser vide pour ne pas changer)' : '(optionnel)'}
                <PasswordInput
                  value={motDePasse}
                  onChange={(e) => setMotDePasse(e.target.value)}
                  placeholder={editingId ? 'Inchangé' : ''}
                  autoComplete="new-password"
                />
              </label>
            </div>
            <div className="actions">
              <button type="submit" className="primary" disabled={saving}>
                {editingId ? 'Enregistrer' : 'Ajouter'}
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
                <th>Nom</th>
                <th>Prénom</th>
                <th>Téléphone 1</th>
                <th>Téléphone 2</th>
                <th>Actif</th>
                <th>Accès Traitement</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {sortedCommerciaux.map((agent) => (
                <tr key={agent.id}>
                  <td>{agent.nom}</td>
                  <td>{agent.prenom}</td>
                  <td>{agent.telephone1}</td>
                  <td className="muted">{agent.telephone2 || '—'}</td>
                  <td>{agent.actif ? 'Oui' : 'Non'}</td>
                  <td>
                    {agent.identifiant ? (
                      <span className="badge badge-success">Accès actif</span>
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
                  <td>
                    <div className="actions actions-inline">
                      <button onClick={() => startEdit(agent)}>Modifier</button>
                      <button
                        className="danger"
                        disabled={!agent.actif}
                        onClick={() => {
                          if (
                            confirm(
                              `Désactiver le commercial "${agent.prenom} ${agent.nom}" ?`,
                            )
                          ) {
                            removeMutation.mutate(agent.id);
                          }
                        }}
                      >
                        Désactiver
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {sortedCommerciaux.length === 0 && (
                <tr>
                  <td colSpan={7} className="muted">
                    Aucun commercial.
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
