import os from 'os';
import sharp from 'sharp';
import mammoth from 'mammoth';
import xlsx from 'xlsx';
import fs from 'fs/promises';
import { fromPath } from 'pdf2pic';
import { PDFDocument } from 'pdf-lib';
import AdmZip from 'adm-zip';

const SUPPORTED_TYPES = {
  'image/jpeg': 'image',
  'image/jpg': 'image',
  'image/png': 'image',
  'application/pdf': 'pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.ms-excel': 'xlsx',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/zip': 'zip',
  'application/x-zip-compressed': 'zip'
};

export async function countPages(filePath, mimetype) {
  const type = SUPPORTED_TYPES[mimetype];
  
  if (!type || type === 'image' || type === 'docx' || type === 'xlsx') {
    return 1;
  }
  
  if (type === 'pdf') {
    const pdfBytes = await fs.readFile(filePath);
    const pdfDoc = await PDFDocument.load(pdfBytes);
    return pdfDoc.getPageCount();
  }
  
  if (type === 'zip') {
    return await countZipPages(filePath);
  }
  
  return 1;
}

async function countZipPages(zipPath) {
  const zip = new AdmZip(zipPath);
  const entries = zip.getEntries();
  let totalPages = 0;
  
  for (const entry of entries) {
    if (entry.isDirectory) continue;
    
    const ext = entry.entryName.toLowerCase().split('.').pop();
    
    if (['jpg', 'jpeg', 'png'].includes(ext)) {
      totalPages += 1;
    } else if (ext === 'pdf') {
      const pdfBytes = entry.getData();
      const pdfDoc = await PDFDocument.load(pdfBytes);
      totalPages += pdfDoc.getPageCount();
    }
    // Skip other file types in ZIP
  }
  
  return totalPages;
}

export async function processDocument(filePath, mimetype) {
  const type = SUPPORTED_TYPES[mimetype];

  if (!type) {
    throw new Error(`Unsupported file type: ${mimetype}`);
  }

  if (type === 'image') {
    const imageBuffer = await fs.readFile(filePath);
    const metadata = await sharp(imageBuffer).metadata();
    const MAX_SIZE = 2048;
    const needsResize = metadata.width > MAX_SIZE || metadata.height > MAX_SIZE;

    let processed = sharp(imageBuffer);
    if (needsResize) {
      processed = processed.resize(MAX_SIZE, MAX_SIZE, {
        fit: 'inside',
        withoutEnlargement: true
      });
    }

    const optimized = await processed
      .jpeg({ quality: 95, progressive: true })
      .toBuffer();

    return { type: 'image', content: optimized.toString('base64') };
  }

    if (type === 'pdf') {
    try {
      const convert = fromPath(filePath, {
        density: 300,
        format: 'jpeg',
        width: 2048,
        height: 2048,
        quality: 100,
        savePath: os.tmpdir()
      });

      const page = await convert(1); // Convert page 1

      if (!page || !page.base64) {
        throw new Error('PDF conversion failed: no page extracted');
      }

      const imageBuffer = Buffer.from(page.base64, 'base64');

      const optimized = await sharp(imageBuffer)
        .jpeg({ quality: 100 })
        .toBuffer();

      return {
        type: 'image',
        content: optimized.toString('base64')
      };
    } catch (pdfError) {
      throw new Error(`PDF processing failed: ${pdfError.message}`);
    }
  }


  if (type === 'docx') {
    const result = await mammoth.extractRawText({ path: filePath });
    return { type: 'text', content: result?.value || '' };
  }

  if (type === 'xlsx') {
    const workbook = xlsx.readFile(filePath);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = xlsx.utils.sheet_to_json(sheet, { header: 1 });

    const textContent = data
      .filter(row => Array.isArray(row))
      .map(row => row.map(cell => cell ?? '').join(' | '))
      .join('\n');

    return { type: 'text', content: textContent };
  }

  if (type === 'zip') {
    return await processZip(filePath);
  }

  throw new Error(`Unhandled type: ${type}`);
}

async function processZip(zipPath) {
  const zip = new AdmZip(zipPath);
  const entries = zip.getEntries();
  const documents = [];

  for (const entry of entries) {
    if (entry.isDirectory) continue;
    
    const ext = entry.entryName.toLowerCase().split('.').pop();
    const tempPath = `/tmp/${Date.now()}-${entry.entryName}`;
    
    if (['jpg', 'jpeg', 'png', 'pdf'].includes(ext)) {
      await fs.writeFile(tempPath, entry.getData());
      
      const mimeType = ext === 'pdf' ? 'application/pdf' : `image/${ext === 'jpg' ? 'jpeg' : ext}`;
      const processed = await processDocument(tempPath, mimeType);
      
      documents.push({
        fileName: entry.entryName,
        ...processed
      });
      
      await fs.unlink(tempPath).catch(() => {});
    }
  }

  return { type: 'batch', documents };
}

export { SUPPORTED_TYPES };