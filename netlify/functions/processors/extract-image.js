// netlify/functions/processors/extract-image.js
// Extracts text from images using Tesseract OCR.
// Supports: JPG, JPEG, PNG, TIFF, BMP, WEBP.

const Tesseract = require('tesseract.js');
const os = require('os');
const path = require('path');
const TESS_CACHE = path.join(os.tmpdir(), 'tesseract-cache');

async function extractImage(file) {
  try {
    const buffer =
      file.buffer || Buffer.from(file.content, 'base64');
      

        const result = await Tesseract.recognize(buffer, 'eng', {
      cachePath: TESS_CACHE,
      logger: message => {
        if (
          message.status === 'recognizing text' &&
          message.progress === 1
        ) {
          console.log('OCR complete for', file.name);
        }
      }
    });

    return {
      text: result.data.text,
      metadata: {
        confidence: result.data.confidence,
        words: result.data.words
          ? result.data.words.length
          : 0,
        method: 'tesseract-ocr'
      }
    };
  } catch (err) {
    console.error('Image OCR error:', err.message);

    throw new Error(
      `Failed to extract text from image: ${err.message}`
    );
  }
}

module.exports = {
  extractImage
};