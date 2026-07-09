// netlify/functions/processors/extract-docx.js
// Extracts text from DOCX files by reading document.xml inside the ZIP archive.

const AdmZip = require('adm-zip');
const xml2js = require('xml2js');

async function extractDOCX(file) {
  try {
    const buffer =
      file.buffer || Buffer.from(file.content, 'base64');

    const zip = new AdmZip(buffer);

    // DOCX files are ZIP archives. Read the main document XML.
    const documentXml = zip.readAsText('word/document.xml');

    if (!documentXml) {
      throw new Error(
        'Could not find word/document.xml in DOCX'
      );
    }

    // Parse the XML
    const parser = new xml2js.Parser({
      explicitArray: false
    });

    const parsed = await parser.parseStringPromise(
      documentXml
    );

    // Recursively extract text from Word XML nodes
    const text = extractTextFromDOCXNode(parsed);

    return {
      text,
      metadata: {
        method: 'docx-xml-extraction',
        size: buffer.length
      }
    };
  } catch (err) {
    console.error('DOCX extraction error:', err.message);

    throw new Error(
      `Failed to extract DOCX: ${err.message}`
    );
  }
}

function extractTextFromDOCXNode(node) {
  let text = '';

  if (typeof node === 'string') {
    return node;
  }

  if (Array.isArray(node)) {
    return node
      .map(extractTextFromDOCXNode)
      .join('');
  }

  if (typeof node === 'object' && node !== null) {
    // Word text node
    if (node['w:t'] !== undefined) {
      text += extractTextFromDOCXNode(node['w:t']);
    }

    // Tab character
    if (node['w:tab'] !== undefined) {
      text += '\t';
    }

    // Line break
    if (node['w:br'] !== undefined) {
      text += '\n';
    }

    // Recurse through remaining nodes
    for (const key of Object.keys(node)) {
      if (
        key !== 'w:t' &&
        key !== 'w:tab' &&
        key !== 'w:br'
      ) {
        text += extractTextFromDOCXNode(node[key]);
      }
    }
  }

  return text;
}

module.exports = {
  extractDOCX
};