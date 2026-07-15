import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as XLSX from 'xlsx';
import { brandsApi, categoriesApi, gammesApi, productsApi, subcategoriesApi } from '../api/client';
import type { Product } from '../api/types';

interface ParsedRow {
  reference?: string;
  name: string;
  description?: string;
  price?: number;
}

interface ImportResult {
  row: ParsedRow;
  status: 'ok' | 'error';
  message?: string;
}

function normalizeHeader(header: string): string {
  return header
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

const REFERENCE_HEADERS = ['reference', 'ref'];
const NAME_HEADERS = ['nom', 'name'];
const DESCRIPTION_HEADERS = ['description'];
const PRICE_HEADERS = ['prix', 'price'];

function parseWorkbook(buffer: ArrayBuffer): { rows: ParsedRow[]; error?: string } {
  const workbook = XLSX.read(buffer, { type: 'array' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: '',
  });

  if (raw.length === 0) {
    return { rows: [], error: 'Le fichier ne contient aucune ligne de données.' };
  }

  const headerMap = new Map<string, string>();
  for (const key of Object.keys(raw[0])) {
    headerMap.set(normalizeHeader(key), key);
  }
  const nameKey = NAME_HEADERS.map((h) => headerMap.get(h)).find(Boolean);
  const referenceKey = REFERENCE_HEADERS.map((h) => headerMap.get(h)).find(Boolean);
  const descriptionKey = DESCRIPTION_HEADERS.map((h) => headerMap.get(h)).find(Boolean);
  const priceKey = PRICE_HEADERS.map((h) => headerMap.get(h)).find(Boolean);

  if (!nameKey) {
    return {
      rows: [],
      error: 'Colonne "Nom" introuvable. Le fichier doit comporter au moins les colonnes Référence et Nom.',
    };
  }

  const rows: ParsedRow[] = raw
    .map((entry) => {
      const name = String(entry[nameKey] ?? '').trim();
      const reference = referenceKey ? String(entry[referenceKey] ?? '').trim() : '';
      const description = descriptionKey ? String(entry[descriptionKey] ?? '').trim() : '';
      const priceRaw = priceKey ? entry[priceKey] : undefined;
      const price =
        priceRaw !== undefined && priceRaw !== '' && !Number.isNaN(Number(priceRaw))
          ? Number(priceRaw)
          : undefined;
      return {
        name,
        reference: reference || undefined,
        description: description || undefined,
        price,
      };
    })
    .filter((row) => row.name);

  if (rows.length === 0) {
    return { rows: [], error: 'Aucune ligne exploitable (colonne "Nom" vide sur toutes les lignes).' };
  }

  return { rows };
}

export function ImportProductsDialog({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const { data: brands } = useQuery({ queryKey: ['brands'], queryFn: brandsApi.list });
  const { data: categories } = useQuery({ queryKey: ['categories'], queryFn: categoriesApi.list });

  const [brandId, setBrandId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [gammeId, setGammeId] = useState('');
  const [subcategoryId, setSubcategoryId] = useState('');
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [fileName, setFileName] = useState('');
  const [importing, setImporting] = useState(false);
  const [results, setResults] = useState<ImportResult[] | null>(null);

  const { data: gammes } = useQuery({
    queryKey: ['gammes', brandId],
    queryFn: () => gammesApi.list(brandId),
    enabled: !!brandId,
  });
  const { data: subcategories } = useQuery({
    queryKey: ['subcategories', categoryId],
    queryFn: () => subcategoriesApi.list(categoryId),
    enabled: !!categoryId,
  });

  const createMutation = useMutation({
    mutationFn: (data: Partial<Product>) => productsApi.create(data),
  });

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setResults(null);
    try {
      const buffer = await file.arrayBuffer();
      const { rows: parsed, error } = parseWorkbook(buffer);
      setRows(parsed);
      setParseError(error ?? null);
    } catch {
      setRows([]);
      setParseError('Impossible de lire ce fichier. Formats acceptés : .xlsx, .xls, .csv.');
    }
  }

  async function handleImport() {
    if (!brandId || !categoryId || rows.length === 0) return;
    setImporting(true);
    const outcome: ImportResult[] = [];
    for (const row of rows) {
      try {
        await createMutation.mutateAsync({
          name: row.name,
          reference: row.reference,
          description: row.description,
          price: row.price,
          brandId,
          categoryId,
          subcategoryId: subcategoryId || null,
          gammeId: gammeId || null,
        });
        outcome.push({ row, status: 'ok' });
      } catch (err) {
        outcome.push({ row, status: 'error', message: (err as Error).message });
      }
    }
    setResults(outcome);
    setImporting(false);
    queryClient.invalidateQueries({ queryKey: ['products'] });
  }

  const canImport = !!brandId && !!categoryId && rows.length > 0 && !importing;
  const successCount = results?.filter((r) => r.status === 'ok').length ?? 0;
  const errorResults = results?.filter((r) => r.status === 'error') ?? [];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="page-header">
          <h3>Importer des produits depuis un fichier Excel</h3>
          <button type="button" onClick={onClose} aria-label="Fermer">
            ✕
          </button>
        </div>

        <p className="muted">
          Le fichier doit comporter au minimum les colonnes <strong>Référence</strong> et{' '}
          <strong>Nom</strong> (colonnes optionnelles reconnues : Description, Prix). Chaque
          produit importé sera rattaché à la marque et à la catégorie choisies ci-dessous.
        </p>

        <div className="form-row">
          <label>
            Marque
            <select
              value={brandId}
              onChange={(e) => {
                setBrandId(e.target.value);
                setGammeId('');
              }}
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
            Gamme (optionnel)
            <select value={gammeId} onChange={(e) => setGammeId(e.target.value)} disabled={!brandId}>
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
            Fichier Excel (.xlsx, .xls, .csv)
            <input type="file" accept=".xlsx,.xls,.csv" onChange={handleFileChange} />
          </label>
        </div>

        {parseError && <div className="error-banner">{parseError}</div>}

        {!parseError && fileName && rows.length > 0 && !results && (
          <div className="success-banner">
            {rows.length} produit(s) détecté(s) dans « {fileName} ».
          </div>
        )}

        {results && (
          <div className={errorResults.length > 0 ? 'error-banner' : 'success-banner'}>
            {successCount} produit(s) importé(s) avec succès.
            {errorResults.length > 0 && (
              <ul>
                {errorResults.map((r, i) => (
                  <li key={i}>
                    {r.row.name} : {r.message}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <div className="actions">
          <button
            type="button"
            className="primary"
            disabled={!canImport}
            onClick={handleImport}
          >
            {importing ? 'Import en cours…' : `Importer ${rows.length || ''} produit(s)`}
          </button>
          <button type="button" onClick={onClose}>
            {results ? 'Fermer' : 'Annuler'}
          </button>
        </div>
      </div>
    </div>
  );
}
