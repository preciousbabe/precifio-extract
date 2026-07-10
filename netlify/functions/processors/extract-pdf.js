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
const Tesseract = require('tesseract.js');

const pdfjsWorker = require('pdfjs-dist/legacy/build/pdf.worker.js');
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

const SCALE = 2.0;

async function extractPDF(file) {
  const buffer = new Uint8Array(file.buffer || Buffer.from(file.content, 'base64'));
  let parseError = null;

  //--------------------------------------------------------
  // Try 1: Native text extraction via pdfjs-dist
  //--------------------------------------------------------

  try {
    const pdfDocument = await pdfjsLib.getDocument({ data: buffer }).promise;
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
      return {
        text: trimmedText,
        metadata: {
          pages: numPages,
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
  let numPages = knownPages;
  
  try {
    if (!numPages) {
      const doc = await pdfjsLib.getDocument({ data: buffer }).promise;
      numPages = doc.numPages;
    }
    
    const ocrTexts = [];
    const ocrErrors = [];
    
    for (let i = 1; i <= numPages; i++) {
      try {
        const doc = await pdfjsLib.getDocument({ data: buffer }).promise;
        const page = await doc.getPage(i);
        const viewport = page.getViewport({ scale: SCALE });
        
        const canvas = createCanvas(viewport.width, viewport.height);
        const ctx = canvas.getContext('2d');
        
        await page.render({
          canvasContext: ctx,
          viewport: viewport
        }).promise;
        
        const pngBuffer = canvas.toBuffer('image/png');
        
        const result = await Tesseract.recognize(pngBuffer, 'eng', {
          logger: message => {
            if (message.status === 'recognizing text') {
              console.log(`OCR page ${i}/${numPages}: ${(message.progress * 100).toFixed(0)}%`);
            }
          }
        });
        
        ocrTexts.push(result.data.text);
        console.log(`-> OCR complete for page ${i}/${numPages}`);
        
      } catch (pageErr) {
        ocrErrors.push(`Page ${i}: ${pageErr.message}`);
        console.error(`-> OCR failed for page ${i}:`, pageErr.message);
      }
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
    
  } catch (err) {
    console.error('-> Canvas/OCR fallback failed:', err.message);
    
    if (err.message.includes('canvas') || err.message.includes('Canvas') || err.message.includes('createCanvas')) {
      console.log('-> Canvas library failed, attempting emergency buffer OCR');
      return await emergencyOCR(buffer, numPages, parseError);
    }
    
    return {
      text: '',
      metadata: {
        pages: numPages || 0,
        method: 'failed',
        error: `pdfjs: ${parseError?.message || 'unknown'} | OCR: ${err.message}`,
        needsOCR: true,
        ocrFailed: true
      }
    };
  }
}

async function emergencyOCR(buffer, numPages, parseError = null) {
  try {
    console.log('-> Attempting emergency direct OCR on PDF buffer');
    
    const result = await Tesseract.recognize(buffer, 'eng', {
      logger: m => {
        if (m.status === 'recognizing text') {
          console.log(`Emergency OCR: ${(m.progress * 100).toFixed(0)}%`);
        }
      }
    });
    
    const text = result.data.text ? result.data.text.trim() : '';
    
    if (text.length > 10) {
      return {
        text: text,
        metadata: {
          pages: numPages || 1,
          method: 'ocr-emergency-buffer',
          note: 'Canvas failed, Tesseract parsed buffer directly',
          hasText: true
        }
      };
    }
    
    return {
      text: '',
      metadata: {
        pages: numPages || 0,
        method: 'ocr-emergency-empty',
        error: 'Emergency OCR produced no readable text',
        parseError: parseError ? parseError.message : undefined,
        needsOCR: true,
        ocrFailed: true
      }
    };
    
  } catch (err) {
    console.error('-> Emergency OCR also failed:', err.message);
    
    return {
      text: '',
      metadata: {
        pages: numPages || 0,
        method: 'failed',
        error: `pdfjs: ${parseError?.message || 'unknown'} | Canvas: failed | Emergency OCR: ${err.message}`,
        needsOCR: true,
        ocrFailed: true
      }
    };
  }
}

module.exports = { extractPDF };