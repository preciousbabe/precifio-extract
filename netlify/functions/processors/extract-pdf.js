// netlify/function/processors/extract-pdf.js

// Polyfill DOMMatrix and Path2D for pdfjs-dist in Node.js
// @napi-rs/canvas doesn't export these, so we provide minimal stubs
if (typeof globalThis.DOMMatrix === 'undefined') {
  globalThis.DOMMatrix = class DOMMatrix {
    constructor(init) { this.a = 1; this.b = 0; this.c = 0; this.d = 1; this.e = 0; this.f = 0; }
  };
}

if (typeof globalThis.Path2D === 'undefined') {
  globalThis.Path2D = class Path2D {
    rect(x, y, w, h) {}
    moveTo(x, y) {}
    lineTo(x, y) {}
    closePath() {}
  };
}

const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');
const { createCanvas } = require('@napi-rs/canvas');
const os = require('os');
const path = require('path');
const TESS_CACHE = path.join(os.tmpdir(), 'tesseract-cache');



// pdfjs's built-in NodeCanvasFactory requires the old "canvas" package.
// This factory is backed by @napi-rs/canvas so that code path is never hit.
class NapiCanvasFactory {
  create(width, height) {
    const canvas = createCanvas(width, height);
    return { canvas, context: canvas.getContext('2d') };
  }
  reset(freeCtx, width, height) {
    freeCtx.canvas.width = width;
    freeCtx.canvas.height = height;
  }
  destroy(canvasAndCtx) {
    canvasAndCtx.canvas.width = 0;
    canvasAndCtx.canvas.height = 0;
    canvasAndCtx.context = null;
    canvasAndCtx.canvas = null;
  }
}

const SCALE = 2.0;

async function extractPDF(file) {
  const buffer = new Uint8Array(file.buffer || Buffer.from(file.content, 'base64'));
  let parseError = null;

  //--------------------------------------------------------
  // Try 1: Native text extraction via pdfjs-dist
  //--------------------------------------------------------

  try {
        const pdfDocument = await pdfjsLib.getDocument({
      data: buffer,
      canvasFactory: new NapiCanvasFactory()
    }).promise;
    const numPages = pdfDocument.numPages;
    
    let fullText = '';
    
    for (let i = 1; i <= numPages; i++) {
      const page = await pdfDocument.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map(item => item.str).join(' ');
      fullText += pageText + '\n';
    }
    
    const trimmedText = fullText.trim();
    
        if (trimmedText.length > 50) {
      const pages = numPages;
      await pdfDocument.destroy();
      return {
        text: trimmedText,
        metadata: {
          pages,
          method: 'native-text',
          hasText: true
        }
      };
    }
    
    console.log(`-> pdfjs extracted only ${trimmedText.length} chars, falling back to OCR`);
    
    return await tryOCR(buffer, numPages);

  } catch (err) {
    parseError = err;
    console.error('-> pdfjs text extraction failed:', err.message);
    console.log('-> Attempting OCR fallback');
    
    return await tryOCR(buffer, 0, parseError);
  }
}

async function tryOCR(buffer, knownPages, parseError = null) {
    const Tesseract = require('tesseract.js');
    const docTask = pdfjsLib.getDocument({
    data: buffer,
    canvasFactory: new NapiCanvasFactory()
  });
  const doc = await docTask.promise;
  const numPages = knownPages || doc.numPages;

  const ocrTexts = [];
  const ocrErrors = [];

  // ONE worker for all pages: avoids re-spawning node workers and
  // re-fetching eng.traineddata on every page
 const worker = await Tesseract.createWorker('eng', Tesseract.OEM.LSTM_ONLY, {
  cachePath: TESS_CACHE,
  logger: message => {
    if (message.status === 'recognizing text') {
      console.log(`OCR: ${(message.progress * 100).toFixed(0)}%`);
    }
  }
});

  try {
    for (let i = 1; i <= numPages; i++) {
      try {
        const page = await doc.getPage(i);
        const viewport = page.getViewport({ scale: SCALE });

        const canvas = createCanvas(viewport.width, viewport.height);
        const ctx = canvas.getContext('2d');

                await page.render({
          canvasContext: ctx,
          viewport,
          canvasFactory: new NapiCanvasFactory()
        }).promise;

        // JPEG ~5-10x smaller than PNG: faster OCR, much less memory
        const imgBuffer = canvas.toBuffer('image/jpeg', 85);

        const { data } = await worker.recognize(imgBuffer);
        ocrTexts.push(data.text);
        console.log(`-> OCR page ${i}/${numPages} done (confidence: ${data.confidence})`);

        page.cleanup();
      } catch (pageErr) {
        ocrErrors.push(`Page ${i}: ${pageErr.message}`);
        console.error(`-> OCR failed for page ${i}:`, pageErr.message);
      }
    }
  } finally {
    await worker.terminate().catch(() => {});
    await docTask.destroy().catch(() => {});
  }

  const mergedText = ocrTexts.filter(t => t.trim().length > 0).join('\n\n').trim();

  if (mergedText.length > 10) {
    return {
      text: mergedText,
      metadata: {
        pages: numPages,
        method: 'ocr-fallback',
        ocrPages: ocrTexts.length,
        ocrErrors: ocrErrors.length > 0 ? ocrErrors : undefined,
        note: parseError
          ? `pdfjs failed (${parseError.message}), used OCR`
          : 'Minimal native text, used OCR',
        hasText: true
      }
    };
  }

  return {
    text: '',
    metadata: {
      pages: numPages,
      method: 'ocr-fallback-empty',
      error: ocrErrors.length > 0 ? ocrErrors.join('; ') : 'OCR produced no readable text',
      parseError: parseError ? parseError.message : undefined,
      needsOCR: true,
      ocrFailed: true
    }
  };
}


module.exports = { extractPDF };