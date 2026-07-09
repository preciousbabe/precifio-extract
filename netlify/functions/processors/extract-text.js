// netlify/functions/processors/extract-text.js
// Handles TXT, MD, JSON, XML, and any other plain text files.

async function extractText(file) {
  try {
    const text = file.buffer ? file.buffer.toString('utf8') : file.content;
    
    return {
      text: text,
      metadata: {
        method: 'direct-text-read',
        length: text.length,
        lines: text.split('\n').length
      }
    };
  } catch (err) {
    console.error('Text extraction error:', err.message);
    throw new Error(`Failed to read text file: ${err.message}`);
  }
}

module.exports = { extractText };