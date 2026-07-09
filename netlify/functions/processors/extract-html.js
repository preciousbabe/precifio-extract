// netlify/functions/processors/extract-html.js
// Extracts text from HTML files, preserving some structure.

const { JSDOM } = require('jsdom');

async function extractHTML(file) {
  try {
    const htmlText = file.buffer ? file.buffer.toString('utf8') : file.content;
    const dom = new JSDOM(htmlText);
    const document = dom.window.document;
    
    // Remove script and style elements
    const scripts = document.querySelectorAll('script, style, nav, footer, header, aside');
    scripts.forEach(el => el.remove());
    
    // Extract text with some structure preservation
    const body = document.body;
    const text = extractStructuredText(body);
    
    return {
      text: text,
      metadata: {
        method: 'html-text-extraction',
        title: document.title || '',
        hasTables: document.querySelectorAll('table').length > 0
      }
    };
  } catch (err) {
    console.error('HTML extraction error:', err.message);
    throw new Error(`Failed to extract HTML: ${err.message}`);
  }
}

function extractStructuredText(element, depth = 0) {
  let text = '';
  const tag = element.tagName ? element.tagName.toLowerCase() : '';
  
  // Block elements get newlines
  const blockElements = ['div', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'tr', 'td', 'th', 'section', 'article'];
  
  // Table elements
  if (tag === 'table') {
    text += extractTable(element);
    return text;
  }
  
  // Headings
  if (tag.match(/^h[1-6]$/)) {
    const headingText = element.textContent.trim();
    if (headingText) {
      text += '\n' + headingText + '\n';
    }
    return text;
  }
  
  // Lists
  if (tag === 'ul' || tag === 'ol') {
    const items = element.querySelectorAll(':scope > li');
    items.forEach(li => {
      const itemText = li.textContent.trim();
      if (itemText) {
        text += '- ' + itemText + '\n';
      }
    });
    return text;
  }
  
  // Direct text content
  if (element.childNodes) {
    for (const child of element.childNodes) {
      if (child.nodeType === 3) { // Text node
        const nodeText = child.textContent.trim();
        if (nodeText) {
          text += nodeText + ' ';
        }
      } else if (child.nodeType === 1) { // Element node
        text += extractStructuredText(child, depth + 1);
      }
    }
  }
  
  if (blockElements.includes(tag) && text.trim()) {
    text = '\n' + text.trim() + '\n';
  }
  
  return text;
}

function extractTable(table) {
  let text = '\n\n[TABLE START]\n';
  const rows = table.querySelectorAll('tr');
  
  rows.forEach(row => {
    const cells = row.querySelectorAll('td, th');
    const cellTexts = Array.from(cells).map(cell => cell.textContent.trim());
    if (cellTexts.some(t => t)) {
      text += cellTexts.join(' | ') + '\n';
    }
  });
  
  text += '[TABLE END]\n\n';
  return text;
}

module.exports = { extractHTML };