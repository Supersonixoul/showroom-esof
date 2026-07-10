import type {
  AuthUser,
  Brand,
  Category,
  Gamme,
  LoginResult,
  Product,
  ProductImage,
  ProductSpec,
  PromoVideo,
  Subcategory,
  UploadResult,
} from './types';
import { readStoredAuth } from '../auth/storage';

export const API_URL = 'http://localhost:3000';

/// Appelé en cas de 401 (token absent/expiré/invalide) pour forcer la
/// déconnexion — branché par `AuthProvider` (spec Sprint 11, login admin).
let unauthorizedHandler: (() => void) | null = null;
export function setUnauthorizedHandler(handler: () => void) {
  unauthorizedHandler = handler;
}

function authHeader(): Record<string, string> {
  const token = readStoredAuth()?.token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      ...(options?.body ? { 'Content-Type': 'application/json' } : {}),
      ...authHeader(),
      ...options?.headers,
    },
  });
  if (res.status === 401) {
    unauthorizedHandler?.();
  }
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`${res.status} ${res.statusText}: ${text}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

// ---- Auth -----------------------------------------------------------

export const authApi = {
  login: (email: string, password: string) =>
    request<LoginResult>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
};

export type { AuthUser };

// ---- Brands -----------------------------------------------------------

export const brandsApi = {
  list: () => request<Brand[]>('/brands'),
  create: (data: Partial<Brand>) =>
    request<Brand>('/brands', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: Partial<Brand>) =>
    request<Brand>(`/brands/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  remove: (id: string) => request<void>(`/brands/${id}`, { method: 'DELETE' }),
};

// ---- Categories ---------------------------------------------------------

export const categoriesApi = {
  list: () => request<Category[]>('/categories'),
  create: (data: Partial<Category>) =>
    request<Category>('/categories', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  update: (id: string, data: Partial<Category>) =>
    request<Category>(`/categories/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  remove: (id: string) =>
    request<void>(`/categories/${id}`, { method: 'DELETE' }),
  move: (id: string, direction: 'up' | 'down') =>
    request<Category>(`/categories/${id}/move`, {
      method: 'PATCH',
      body: JSON.stringify({ direction }),
    }),
};

// ---- Subcategories --------------------------------------------------------

export const subcategoriesApi = {
  list: (categoryId?: string) =>
    request<Subcategory[]>(
      categoryId ? `/subcategories?categoryId=${categoryId}` : '/subcategories',
    ),
  create: (data: Partial<Subcategory>) =>
    request<Subcategory>('/subcategories', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  update: (id: string, data: Partial<Subcategory>) =>
    request<Subcategory>(`/subcategories/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  remove: (id: string) =>
    request<void>(`/subcategories/${id}`, { method: 'DELETE' }),
  move: (id: string, direction: 'up' | 'down') =>
    request<Subcategory>(`/subcategories/${id}/move`, {
      method: 'PATCH',
      body: JSON.stringify({ direction }),
    }),
};

// ---- Gammes ---------------------------------------------------------------

export const gammesApi = {
  list: (brandId?: string) =>
    request<Gamme[]>(brandId ? `/gammes?brandId=${brandId}` : '/gammes'),
  create: (data: Partial<Gamme>) =>
    request<Gamme>('/gammes', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: Partial<Gamme>) =>
    request<Gamme>(`/gammes/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  remove: (id: string) => request<void>(`/gammes/${id}`, { method: 'DELETE' }),
  move: (id: string, direction: 'up' | 'down') =>
    request<Gamme>(`/gammes/${id}/move`, {
      method: 'PATCH',
      body: JSON.stringify({ direction }),
    }),
};

// ---- Products -----------------------------------------------------------

export const productsApi = {
  list: () => request<Product[]>('/products'),
  get: (id: string) => request<Product>(`/products/${id}`),
  create: (data: Partial<Product>) =>
    request<Product>('/products', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  update: (id: string, data: Partial<Product>) =>
    request<Product>(`/products/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  remove: (id: string) =>
    request<void>(`/products/${id}`, { method: 'DELETE' }),
  addSpec: (productId: string, data: { label: string; value: string }) =>
    request<ProductSpec>(`/products/${productId}/specs`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  removeSpec: (productId: string, specId: string) =>
    request<void>(`/products/${productId}/specs/${specId}`, {
      method: 'DELETE',
    }),
  addImage: (productId: string, data: { url: string; position?: number }) =>
    request<ProductImage>(`/products/${productId}/images`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  removeImage: (productId: string, imageId: string) =>
    request<void>(`/products/${productId}/images/${imageId}`, {
      method: 'DELETE',
    }),
  move: (id: string, direction: 'up' | 'down') =>
    request<Product>(`/products/${id}/move`, {
      method: 'PATCH',
      body: JSON.stringify({ direction }),
    }),
  moveImage: (productId: string, imageId: string, direction: 'up' | 'down') =>
    request<ProductImage>(`/products/${productId}/images/${imageId}/move`, {
      method: 'PATCH',
      body: JSON.stringify({ direction }),
    }),
};

// ---- Videos -----------------------------------------------------------

export const videosApi = {
  list: () => request<PromoVideo[]>('/videos'),
  create: (data: Partial<PromoVideo>) =>
    request<PromoVideo>('/videos', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  update: (id: string, data: Partial<PromoVideo>) =>
    request<PromoVideo>(`/videos/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  remove: (id: string) => request<void>(`/videos/${id}`, { method: 'DELETE' }),
  move: (id: string, direction: 'up' | 'down') =>
    request<PromoVideo>(`/videos/${id}/move`, {
      method: 'PATCH',
      body: JSON.stringify({ direction }),
    }),
};

// ---- Media (upload) -----------------------------------------------------

export type UploadResource =
  | 'products'
  | 'promo-videos'
  | 'brands'
  | 'subcategories'
  | 'gammes';

export async function uploadMedia(
  file: File,
  resource: UploadResource,
): Promise<UploadResult> {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(`${API_URL}/media/upload/${resource}`, {
    method: 'POST',
    headers: authHeader(),
    body: form,
  });
  if (res.status === 401) {
    unauthorizedHandler?.();
  }
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`${res.status} ${res.statusText}: ${text}`);
  }
  return res.json() as Promise<UploadResult>;
}

export function mediaUrl(url: string) {
  return url.startsWith('http') ? url : `${API_URL}${url}`;
}

// ---- Catalog (sync indicator) --------------------------------------------

export const catalogApi = {
  full: () =>
    request<{ syncedAt: string; brands: Brand[]; categories: Category[]; products: Product[]; promoVideos: PromoVideo[] }>(
      '/catalog/full',
    ),
};
