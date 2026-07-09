// netlify/functions/processors/extract-pdf.js

const pdfParse = require('pdf-parse');
const Tesseract = require('tesseract.js');

async function extractPDF(file) {
  const buffer = file.buffer || Buffer.from(file.content, 'base64');
  let parseError = null; // Store parse error for later reference

  //--------------------------------------------------------
  // Try 1: Native text extraction
  //--------------------------------------------------------

  try {
    const result = await pdfParse(buffer);

    if (result.text && result.text.trim().length > 50) {
      return {
        text: result.text,
        metadata: {
          pages: result.numpages,
          info: result.info,
          method: 'native-text'
        }
      };
    }

    // Minimal text — flag for OCR but don't fail
    return {
      text: result.text || '',
      metadata: {
        pages: result.numpages,
        info: result.info,
        method: 'native-text-minimal',
        needsOCR: true,
        warning: 'Very little text extracted — document may be scanned'
      }
    };

  } catch (err) {
    parseError = err; // Store for later
    console.log("-> pdf-parse failed:", err.message);
    console.log("-> Falling back to OCR");
  }

  //--------------------------------------------------------
  // Try 2: OCR fallback (for scanned or corrupted PDFs)
  //--------------------------------------------------------

  try {
    const ocrResult = await Tesseract.recognize(buffer, 'eng', {
      logger: message => {
        if (message.status === 'recognizing text' && message.progress === 1) {
          console.log('OCR complete for', file.name);
        }
      }
    });

    if (ocrResult.data.text && ocrResult.data.text.trim().length > 10) {
      return {
        text: ocrResult.data.text,
        metadata: {
          method: 'ocr-fallback',
          confidence: ocrResult.data.confidence,
          words: ocrResult.data.words ? ocrResult.data.words.length : 0,
          note: 'pdf-parse failed, used OCR fallback'
        }
      };
    }

    // OCR succeeded but produced no usable text
    return {
      text: '',
      metadata: {
        method: 'ocr-fallback-empty',
        error: 'OCR produced no readable text',
        needsOCR: true,
        ocrFailed: true
      }
    };

  } catch (ocrErr) {
    console.error('OCR fallback error:', ocrErr.message);

    // Both methods failed — return graceful failure
    return {
      text: '',
      metadata: {
        method: 'failed',
        error: `pdf-parse: ${parseError?.message || 'unknown'} | OCR: ${ocrErr.message}`,
        needsOCR: true,
        ocrFailed: true
      }
    };
  }
}

module.exports = { extractPDF };