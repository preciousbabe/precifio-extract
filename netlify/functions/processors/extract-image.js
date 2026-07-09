// netlify/functions/processors/extract-image.js
// Extracts text from images using Tesseract OCR.
// Supports: JPG, JPEG, PNG, TIFF, BMP, WEBP.

const Tesseract = require('tesseract.js');

async function extractImage(file) {
  try {
    const buffer =
      file.buffer || Buffer.from(file.content, 'base64');

    // Perform OCR using the English language model
    const result = await Tesseract.recognize(buffer, 'eng', {
      logger: message => {
        // Optional progress logging
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