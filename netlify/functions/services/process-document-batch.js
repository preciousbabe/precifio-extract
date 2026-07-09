// netlify/functions/services/process-document-batch.js

const { extractTextFromFile } = require('./extractor-service');
const { cleanOCR } = require('../utils/clean-ocr');
const AIClient = require('../utils/ai-client');

// Process up to 3 files concurrently to stay under timeout
const BATCH_CONCURRENCY = 3;

async function processWithConcurrency(items, concurrency, processor) {
  const results = [];
  const errors = [];

  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency);
    console.log(`Processing batch ${Math.floor(i / concurrency) + 1}: ${batch.length} files`);

    const batchResults = await Promise.allSettled(
      batch.map(file => processor(file))
    );

    batchResults.forEach((result, idx) => {
      const file = batch[idx];
      if (result.status === 'fulfilled') {
        results.push(result.value);
      } else {
        console.error(`Failed: ${file.name} - ${result.reason.message}`);
        errors.push({
          fileName: file.name,
          error: result.reason.message
        });
      }
    });
  }

  return { results, errors };
}

async function processDocumentBatch(files) {
  let processed = 0;
  let failed = 0;

  const { results, errors } = await processWithConcurrency(
    files,
    BATCH_CONCURRENCY,
    async (file) => {
      const extraction = await extractTextFromFile(file);
      const cleanedText = cleanOCR(extraction.text);

      if (!cleanedText || cleanedText.length < 10) {
        throw new Error('No readable text extracted');
      }

      const aiClient = new AIClient();
      const extractedData = await aiClient.extract(cleanedText);

      processed++;

      return {
        fileName: file.name,
        success: true,
        documentSummary: extractedData.document_summary,
        segments: extractedData.segments,
        metadata: {
          ...extraction.metadata,
          textLength: cleanedText.length
        }
      };
    }
  );

  failed = errors.length;

  return {
    success: true,
    summary: {
      total: files.length,
      processed,
      failed
    },
    results,
    errors
  };
}

module.exports = { processDocumentBatch };