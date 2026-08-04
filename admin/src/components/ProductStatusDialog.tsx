import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { productsApi } from '../api/client';
import type { Product } from '../api/types';
import { formatPrix } from '../utils/formatPrix';

interface Props {
  product: Product;
  onClose: () => void;
}

/** Extrait le message d'erreur lisible d'une erreur API (le client HTTP
 * renvoie `${status} ${statusText}: ${jsonBody}` — on isole ici le champ
 * `message` du corps JSON pour éviter d'afficher le JSON brut à l'utilisateur). */
function extractErrorMessage(error: unknown): string {
  const raw = (error as Error).message ?? 'Une erreur est survenue';
  const jsonStart = raw.indexOf('{');
  if (jsonStart === -1) return raw;
  try {
    const body = JSON.parse(raw.slice(jsonStart));
    return typeof body.message === 'string' ? body.message : raw;
  } catch {
    return raw;
  }
}

/** Modale de gestion des statuts de mise en avant (nouveau/promo/solde)
 * d'un produit, ouverte depuis le bouton « Statuts » de ProductsPage. */
export function ProductStatusDialog({ product, onClose }: Props) {
  const queryClient = useQueryClient();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isNew, setIsNew] = useState(product.isNew);
  const [onPromotion, setOnPromotion] = useState(product.onPromotion);
  const [promoPrice, setPromoPrice] = useState(
    product.promoPrice != null ? String(product.promoPrice) : '',
  );
  const [onSale, setOnSale] = useState(product.onSale);
  const [salePrice, setSalePrice] = useState(
    product.salePrice != null ? String(product.salePrice) : '',
  );

  const mutation = useMutation({
    mutationFn: () =>
      productsApi.updateStatus(product.id, {
        isNew,
        onPromotion,
        promoPrice: onPromotion ? (promoPrice !== '' ? Number(promoPrice) : null) : null,
        onSale,
        salePrice: onSale ? (salePrice !== '' ? Number(salePrice) : null) : null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      onClose();
    },
    onError: (error) => {
      setErrorMessage(extractErrorMessage(error));
    },
  });

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="page-header">
          <h3>Statuts — {product.name}</h3>
          <button type="button" onClick={onClose} aria-label="Fermer">
            ✕
          </button>
        </div>

        <p className="muted">Prix normal : {formatPrix(product.price)}</p>

        <div className="checkbox-row">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={isNew}
              onChange={(e) => setIsNew(e.target.checked)}
            />
            Produit nouveau
          </label>
        </div>

        <div className="checkbox-row">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={onPromotion}
              onChange={(e) => {
                setOnPromotion(e.target.checked);
                if (e.target.checked) setOnSale(false);
              }}
            />
            En promotion
          </label>
          {onPromotion && (
            <div className="form-row">
              <label>
                Prix promo (FCFA) — optionnel
                <input
                  type="number"
                  step="1"
                  min="0"
                  value={promoPrice}
                  onChange={(e) => setPromoPrice(e.target.value)}
                />
              </label>
              {product.price == null && (
                <p className="muted">
                  Aucun prix normal renseigné : le prix promo est facultatif.
                </p>
              )}
            </div>
          )}
        </div>

        <div className="checkbox-row">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={onSale}
              onChange={(e) => {
                setOnSale(e.target.checked);
                if (e.target.checked) setOnPromotion(false);
              }}
            />
            En solde
          </label>
          {onSale && (
            <div className="form-row">
              <label>
                Prix solde (FCFA)
                <input
                  type="number"
                  step="1"
                  min="0"
                  value={salePrice}
                  onChange={(e) => setSalePrice(e.target.value)}
                />
              </label>
            </div>
          )}
        </div>

        <div className="actions">
          <button
            type="button"
            className="primary"
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
          >
            Enregistrer
          </button>
          <button type="button" onClick={onClose}>
            Annuler
          </button>
        </div>
      </div>

      {errorMessage && (
        <div
          className="messagebox-overlay"
          onClick={(e) => {
            e.stopPropagation();
            setErrorMessage(null);
          }}
        >
          <div className="messagebox" onClick={(e) => e.stopPropagation()}>
            <p>{errorMessage}</p>
            <div className="actions">
              <button type="button" className="primary" onClick={() => setErrorMessage(null)}>
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
