export type Language = "en" | "am";

export interface User {
  id: string;
  name: string;
  email: string;
  language: Language;
  createdAt: Date;
}

export interface ApiResponse<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasNextPage: boolean;
}

export interface AppConfig {
  apiUrl: string;
  appName: string;
  version: string;
}
