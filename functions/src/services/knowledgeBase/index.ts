// Knowledge Base Module Exports

export { KnowledgeService } from './knowledgeService';
export { EmbeddingService } from './embeddingService';
export { PDFProcessor } from './pdfProcessor';
export * from './types';

// Export batch extraction types
export type {
  BatchExtractionProgress,
  BatchExtractionResult,
  FullExtractionResult,
  PageExtractionStatus,
} from './highQualityExtractor';
