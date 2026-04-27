import type { SheetJsApi } from '@/types/fraud';

declare global {
  interface Window {
    XLSX?: SheetJsApi;
  }
}

export {};
