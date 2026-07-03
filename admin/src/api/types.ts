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
  parentId?: string | null;
  parent?: Category | null;
  children?: Category[];
  createdAt: string;
  updatedAt: string;
}

export interface ProductSpec {
  id: string;
  label: string;
  value: string;
  productId: string;
}

export interface ProductImage {
  id: string;
  url: string;
  position: number;
  productId: string;
}

export interface Product {
  id: string;
  name: string;
  reference?: string | null;
  description?: string | null;
  isActive: boolean;
  brandId: string;
  categoryId: string;
  brand?: Brand;
  category?: Category;
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
