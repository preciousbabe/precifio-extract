import AdmZip from 'adm-zip';
import { PDFDocument } from 'pdf-lib';
import { v4 as uuidv4 } from 'uuid';

import { runExtractionPipeline } from './extractionPipeline.js';
import { countPages } from './documentProcessor.js';

const MAX_BATCH_FILES = 50;
const CONCURRENT_LIMIT = 5;

const MIME_MAP = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  xls: 'application/vnd.ms-excel'
};

function getMimeType(filename) {
  const ext = filename.toLowerCase().split('.').pop();
  return MIME_MAP[ext] || null;
}

function isSupportedFile(filename) {
  return !!getMimeType(filename);
}

async function extractZipDocuments(zipBuffer) {
  const zip = new AdmZip(zipBuffer);
  const entries = zip.getEntries().filter(entry => !entry.isDirectory && isSupportedFile(entry.entryName));

  if (entries.length === 0) {
    throw new Error('ZIP contains no supported documents');
  }

  if (entries.length > MAX_BATCH_FILES) {
    throw new Error(`Maximum ${MAX_BATCH_FILES} files allowed per batch`);
  }

  const documents = [];
  for (const entry of entries) {
    documents.push({
      id: uuidv4(),
      fileName: entry.entryName,
      mimeType: getMimeType(entry.entryName),
      buffer: entry.getData()
    });
  }

  return documents;
}

async function calculateBatchPages(documents) {
  let totalPages = 0;
  for (const doc of documents) {
    try {
      const pages = await countPages(doc.buffer, doc.mimeType);
      doc.pageCount = pages;
      totalPages += pages;
    } catch (err) {
      doc.pageCount = 1;
      totalPages += 1;
    }
  }
  return totalPages;
}

async function processSingleDocument({ document, documentType }) {
  try {
    console.log('BATCH DOC:', { file: document.fileName, mimeType: document.mimeType });

    const extraction = await runExtractionPipeline({
      fileBuffer: document.buffer,
      mimeType: document.mimeType,
      documentType,
      fileName: document.fileName
    });

    // FIX: Map all fields needed by batch-extract.js background saver
    return {
      success: true,
      fileName: document.fileName,
      mimeType: document.mimeType,
      pageCount: document.pageCount,
      extraction: extraction.extraction,
      rawExtraction: extraction.rawExtraction,        // NEW: for raw_data field
      validation: extraction.validation,
      confidence: extraction.confidence,
      status: extraction.status,                      // 'REVIEW_REQUIRED' or 'AUTO_APPROVED'
      dbStatus: extraction.dbStatus,                  // NEW: 'review_required' or 'completed'
      processingMethod: extraction.processingMethod,
    };

  } catch (error) {
    return {
      success: false,
      fileName: document.fileName,
      mimeType: document.mimeType,
      pageCount: document.pageCount,
      error: error.message
    };
  }
}

async function runWithConcurrency(items, limit, processor) {
  const results = [];
  let currentIndex = 0;

  async function worker() {
    while (currentIndex < items.length) {
      const index = currentIndex++;
      results[index] = await processor(items[index]);
    }
  }

  const workers = Array.from({ length: Math.min(limit, items.length) }, worker);
  await Promise.all(workers);
  return results;
}

export async function processBatch({ zipBuffer, documentType = 'mixed' }) {
  console.log('===========================');
  console.log('BATCH PROCESSING START');
  console.log('===========================');

  const documents = await extractZipDocuments(zipBuffer);
  const totalDocuments = documents.length;
  const totalPages = await calculateBatchPages(documents);

  console.log(`Files: ${totalDocuments}`);
  console.log(`Pages: ${totalPages}`);

  const results = await runWithConcurrency(
    documents,
    CONCURRENT_LIMIT,
    (doc) => processSingleDocument({ document: doc, documentType })
  );

  const processedCount = results.filter(r => r.success).length;
  const failedCount = results.filter(r => !r.success).length;
  const reviewRequiredCount = results.filter(r => r.success && r.status === 'REVIEW_REQUIRED').length;

  console.log('Processed:', processedCount);
  console.log('Failed:', failedCount);
  console.log('Review:', reviewRequiredCount);
  console.log('===========================');
  console.log('BATCH PROCESSING COMPLETE');
  console.log('===========================');

  return {
    totalDocuments,
    totalPages,
    processedCount,
    failedCount,
    reviewRequiredCount,
    results
  };
}

export async function calculateZipCredits(zipBuffer) {
  const documents = await extractZipDocuments(zipBuffer);
  const totalPages = await calculateBatchPages(documents);

  return {
    totalDocuments: documents.length,
    totalPages,
    creditsRequired: totalPages
  };
}