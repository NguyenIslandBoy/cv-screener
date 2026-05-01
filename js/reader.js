// reader.js — handles .txt, .md, .docx, .pdf → plain text into CV textarea

// ── Word count ────────────────────────────────────────────────
function wordCount(text) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

// ── Status line ───────────────────────────────────────────────
function setStatus(filename, text, showPreview) {
  var words  = wordCount(text);
  var status = document.getElementById('file-name-display');
  status.textContent = '✓ ' + filename + ' — ' + words + ' words';

  // Show preview toggle only for PDF
  var toggle = document.getElementById('preview-toggle');
  var box    = document.getElementById('preview-box');
  if (showPreview) {
    toggle.style.display = 'inline';
    box.textContent = text;
  } else {
    toggle.style.display = 'none';
    box.style.display    = 'none';
    box.textContent      = '';
  }
}

// ── Apply text to textarea ────────────────────────────────────
function applyText(filename, text, showPreview) {
  document.getElementById('cv-text').value = text;
  setStatus(filename, text, showPreview);
  document.getElementById('cv-text').dispatchEvent(new Event('input'));
}

// ── Plain text (.txt, .md) ────────────────────────────────────
function readPlainText(file) {
  return new Promise(function (resolve, reject) {
    var reader = new FileReader();
    reader.onload  = function (e) { resolve(e.target.result); };
    reader.onerror = function ()  { reject(new Error('Failed to read ' + file.name)); };
    reader.readAsText(file);
  });
}

// ── DOCX via mammoth.js ───────────────────────────────────────
function readDocx(file) {
  return new Promise(function (resolve, reject) {
    var reader = new FileReader();
    reader.onload = function (e) {
      mammoth.extractRawText({ arrayBuffer: e.target.result })
        .then(function (result) { resolve(result.value); })
        .catch(function (err)   { reject(new Error('DOCX read failed: ' + err.message)); });
    };
    reader.onerror = function () { reject(new Error('Failed to read ' + file.name)); };
    reader.readAsArrayBuffer(file);
  });
}

// ── PDF via PDF.js ────────────────────────────────────────────
function readPdf(file) {
  return new Promise(function (resolve, reject) {
    var reader = new FileReader();
    reader.onload = function (e) {
      var typedArray = new Uint8Array(e.target.result);
      pdfjsLib.getDocument({ data: typedArray }).promise
        .then(function (pdf) {
          var pages = [];
          for (var i = 1; i <= pdf.numPages; i++) {
            pages.push(pdf.getPage(i));
          }
          return Promise.all(pages);
        })
        .then(function (pages) {
          return Promise.all(pages.map(function (page) {
            return page.getTextContent().then(function (content) {
              return content.items.map(function (item) {
                return item.str;
              }).join(' ');
            });
          }));
        })
        .then(function (pageTexts) {
          resolve(pageTexts.join('\n\n'));
        })
        .catch(function (err) {
          reject(new Error('PDF read failed: ' + err.message));
        });
    };
    reader.onerror = function () { reject(new Error('Failed to read ' + file.name)); };
    reader.readAsArrayBuffer(file);
  });
}

// ── Route by file type ────────────────────────────────────────
function readFile(file) {
  var ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
  var allowed = ['.txt', '.md', '.docx', '.pdf'];

  if (!allowed.includes(ext)) {
    return Promise.reject(new Error('Unsupported file type: ' + ext + '. Use .txt, .md, .docx, or .pdf'));
  }

  if (ext === '.docx') return readDocx(file);
  if (ext === '.pdf')  return readPdf(file);
  return readPlainText(file);
}

// ── Handle file input change ──────────────────────────────────
function handleFileSelect(event) {
  var file = event.target.files[0];
  if (!file) return;

  var ext         = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
  var showPreview = ext === '.pdf';

  var status = document.getElementById('file-name-display');
  status.textContent = 'Reading ' + file.name + '...';

  readFile(file)
    .then(function (text) { applyText(file.name, text, showPreview); })
    .catch(function (err) {
      document.getElementById('file-name-display').textContent = '✗ ' + err.message;
    });
}

// ── Drag and drop ─────────────────────────────────────────────
function setupDragDrop() {
  var zone = document.getElementById('upload-zone');

  zone.addEventListener('dragover', function (e) {
    e.preventDefault();
    zone.classList.add('drag-over');
  });

  zone.addEventListener('dragleave', function () {
    zone.classList.remove('drag-over');
  });

  zone.addEventListener('drop', function (e) {
    e.preventDefault();
    zone.classList.remove('drag-over');

    var file = e.dataTransfer.files[0];
    if (!file) return;

    var ext         = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
    var showPreview = ext === '.pdf';

    readFile(file)
      .then(function (text) { applyText(file.name, text, showPreview); })
      .catch(function (err) {
        document.getElementById('file-name-display').textContent = '✗ ' + err.message;
      });
  });
}

// ── Preview toggle (PDF only) ─────────────────────────────────
function setupPreviewToggle() {
  var toggle = document.getElementById('preview-toggle');
  var box    = document.getElementById('preview-box');
  var open   = false;

  toggle.addEventListener('click', function () {
    open = !open;
    box.style.display    = open ? 'block' : 'none';
    toggle.textContent   = open ? 'Hide extracted text ▴' : 'Preview extracted text ▾';
  });
}

// ── Init ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', function () {
  // PDF.js worker
  if (typeof pdfjsLib !== 'undefined') {
    pdfjsLib.GlobalWorkerOptions.workerSrc =
      'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  }

  document.getElementById('cv-file-input').addEventListener('change', handleFileSelect);
  setupDragDrop();
  setupPreviewToggle();
});