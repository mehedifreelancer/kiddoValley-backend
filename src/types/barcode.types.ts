export interface Barcode {
  id: number;
  title: string;
  barcode: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface SearchBarcodeDto {
  search?: string;
  page?: number;
  limit?: number;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}