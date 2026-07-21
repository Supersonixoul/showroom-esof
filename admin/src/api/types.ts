export interface Brand {
  id: string;
  name: string;
  logoUrl?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Category {
  id: string;
  name: string;
  imageUrl?: string | null;
  displayOrder: number;
  parentId?: string | null;
  parent?: Category | null;
  children?: Category[];
  createdAt: string;
  updatedAt: string;
}

export interface Subcategory {
  id: string;
  name: string;
  description?: string | null;
  imageUrl?: string | null;
  displayOrder: number;
  categoryId: string;
  category?: Category;
  _count?: { products: number };
  createdAt: string;
  updatedAt: string;
}

export interface Gamme {
  id: string;
  name: string;
  description?: string | null;
  imageUrl?: string | null;
  displayOrder: number;
  brandId: string;
  brand?: Brand;
  _count?: { products: number };
  createdAt: string;
  updatedAt: string;
}

export interface ProductSpec {
  id: string;
  label: string;
  value: string;
  productId: string;
}

export interface ImageVariants {
  thumb: string;
  medium: string;
  full: string;
  original: string;
}

export interface ProductImage {
  id: string;
  url: string;
  position: number;
  productId: string;
  imageVariants?: ImageVariants;
}

export interface Product {
  id: string;
  name: string;
  reference?: string | null;
  description?: string | null;
  price?: number | string | null;
  isActive: boolean;
  displayOrder: number;
  brandId?: string | null;
  categoryId: string;
  subcategoryId?: string | null;
  gammeId?: string | null;
  brand?: Brand;
  category?: Category;
  subcategory?: Subcategory | null;
  gamme?: Gamme | null;
  specs?: ProductSpec[];
  images?: ProductImage[];
  createdAt: string;
  updatedAt: string;
}

export interface PromoVideo {
  id: string;
  title: string;
  url: string;
  position: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UploadResult {
  url: string;
  filename: string;
  mimetype: string;
  size: number;
}

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: 'ADMIN' | 'COMMERCIAL';
}

export interface LoginResult {
  accessToken: string;
  user: AuthUser;
}
