import sharp from 'sharp';
import mammoth from 'mammoth';
import xlsx from 'xlsx';
import fs from 'fs/promises';
import { PDFDocument } from 'pdf-lib';
import AdmZip from 'adm-zip';
import path from 'path';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';


const SUPPORTED_TYPES = {
  'image/jpeg': 'image',
  'image/jpg': 'image',
  'image/png': 'image',
  'application/pdf': 'pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.ms-excel': 'xlsx',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/zip': 'zip',
  'application/x-zip-compressed': 'zip',
  'text/plain': 'txt',
  'text/html': 'html'
};

export async function countPages(input, mimetype) {
  const type = SUPPORTED_TYPES[mimetype];
  if (!type || type === 'image' || type === 'docx' || type === 'xlsx') return 1;
  if (type === 'pdf') {
    const pdfBytes = Buffer.isBuffer(input) ? input : await fs.readFile(input);
    const pdfDoc = await PDFDocument.load(pdfBytes);
    return pdfDoc.getPageCount();
  }
  if (type === 'zip') return await countZipPages(input);
  return 1;
}

async function countZipPages(input) {
  const zip = Buffer.isBuffer(input) ? new AdmZip(input) : new AdmZip(input);
  const entries = zip.getEntries();
  let totalPages = 0;

  for (const entry of entries) {
    if (entry.isDirectory) continue;
    const mimeType = getMimeTypeFromFilename(entry.entryName);
    if (!mimeType) continue;
    try {
      const fileBuffer = entry.getData();
      const pages = await countPages(fileBuffer, mimeType);
      totalPages += pages;
    } catch (err) {
      console.error('Failed counting pages for:', entry.entryName);
    }
  }
  return totalPages;
}

function getMimeTypeFromFilename(filename) {
  const ext = path.extname(filename).toLowerCase();
  switch (ext) {
    case '.pdf': return 'application/pdf';
    case '.png': return 'image/png';
    case '.jpg':
    case '.jpeg': return 'image/jpeg';
    case '.docx': return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    case '.xls': return 'application/vnd.ms-excel';
    case '.xlsx': return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
case '.txt': return 'text/plain';
case '.html':
case '.htm': return 'text/html';
default: return null;
  }
}


async function extractPdfText(pdfBytes) {
  try {
    const data = new Uint8Array(pdfBytes);
    const pdf = await getDocument({ data }).promise;
    let text = '';
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      text += content.items.map(item => item.str).join(' ') + '\n';
    }
    return text;
  } catch (err) {
    console.error('PDF text extraction failed:', err.message);
    return '';
  }
}


export async function processDocument(input, mimetype) {
  const type = SUPPORTED_TYPES[mimetype];
  const isBuffer = Buffer.isBuffer(input);
  if (!type) throw new Error(`Unsupported file type: ${mimetype}`);

  if (type === 'image') {
    const imageBuffer = isBuffer ? input : await fs.readFile(input);
    const metadata = await sharp(imageBuffer).metadata();
    const MAX_SIZE = 1024;
    const needsResize = metadata.width > MAX_SIZE || metadata.height > MAX_SIZE;
    let processed = sharp(imageBuffer);
    if (needsResize) {
      processed = processed.resize(MAX_SIZE, MAX_SIZE, { fit: 'inside', withoutEnlargement: true });
    }
    const quality = imageBuffer.length > 1 * 1024 * 1024 ? 70 : 80;
    const optimized = await processed.jpeg({ quality, progressive: true }).toBuffer();
    console.log('Image optimized:', metadata.width, 'x', metadata.height, '→ max', MAX_SIZE, 'quality:', quality, 'output:', Math.round(optimized.length / 1024), 'KB');
    return { type: 'image', content: optimized.toString('base64') };
  }

  if (type === 'pdf') {

    console.log('=== PDF PROCESSING START ===');

    const pdfBytes = isBuffer ? input : await fs.readFile(input);

    if (pdfBytes.length > 15 * 1024 * 1024) {
        throw new Error('PDF too large. Maximum 15MB.');
    }

    const pdfDoc = await PDFDocument.load(pdfBytes);

    const pageCount = pdfDoc.getPageCount();

    if (pageCount > 50) {
        throw new Error('PDF too long. Maximum 50 pages.');
    }

    const extractedText = await extractPdfText(pdfBytes);

    console.log('Extracted text length:', extractedText.length);

    return {

        type: 'pdf',

        buffer: pdfBytes,

        text: extractedText,

        pageCount

    };

}

  if (type === 'docx') {
    const result = isBuffer ? await mammoth.extractRawText({ buffer: input }) : await mammoth.extractRawText({ path: input });
    return { type: 'text', content: result?.value || '' };
  }

  if (type === 'txt') {
  const text = isBuffer
    ? input.toString('utf8')
    : await fs.readFile(input, 'utf8');

  return {
    type: 'text',
    content: text
  };
}

if (type === 'html') {
  const html = isBuffer
    ? input.toString('utf8')
    : await fs.readFile(input, 'utf8');

  // Strip HTML tags
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return {
    type: 'text',
    content: text
  };
}

  if (type === 'xlsx') {
    const workbook = isBuffer ? xlsx.read(input, { type: 'buffer' }) : xlsx.readFile(input);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = xlsx.utils.sheet_to_json(sheet, { header: 1 });
    const textContent = data.filter(row => Array.isArray(row)).map(row => row.map(cell => cell ?? '').join(' | ')).join('\n');
    return { type: 'text', content: textContent };
  }

  if (type === 'zip') {
    return await processZip(input);
  }
  throw new Error(`Unhandled type: ${type}`);
}

async function processZip(input) {
  const zip = Buffer.isBuffer(input) ? new AdmZip(input) : new AdmZip(input);
  const entries = zip.getEntries();

  if (entries.length > 500) {
    throw new Error('ZIP contains too many files. Maximum 500.');
  }

  const documents = [];
  let totalPages = 0;

  for (const entry of entries) {
    if (entry.isDirectory) continue;
    const mimeType = getMimeTypeFromFilename(entry.entryName);
    if (!mimeType) {
      console.log('Skipping unsupported file:', entry.entryName);
      continue;
    }
    try {
      const fileBuffer = entry.getData();
      const pageCount = await countPages(fileBuffer, mimeType);
      totalPages += pageCount;
      documents.push({
        fileName: entry.entryName,
        mimeType,
        pageCount,
        buffer: fileBuffer
      });
    } catch (err) {
      console.error('Failed processing ZIP entry:', entry.entryName, err.message);
    }
  }

  if (totalPages > 5000) {
    throw new Error('Batch exceeds maximum allowed pages.');
  }

  return {
    type: 'batch',
    documents,
    totalDocuments: documents.length,
    totalPages
  };
}

export { SUPPORTED_TYPES };