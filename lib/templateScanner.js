const fs = require('fs');
const path = require('path');

const TEMPLATES_DIR = path.join(__dirname, '..', 'templates');

/**
 * Scan all available templates in the templates directory and root workspace.
 */
function scanTemplates() {
  if (!fs.existsSync(TEMPLATES_DIR)) {
    fs.mkdirSync(TEMPLATES_DIR, { recursive: true });
  }

  const rootDir = path.join(__dirname, '..');

  // 1. 2-Way Sync: If root index.html exists and is newer than templates/digital-passbook/index.html, sync it!
  const rootHtmlPath = path.join(rootDir, 'index.html');
  const dpHtmlPath = path.join(TEMPLATES_DIR, 'digital-passbook', 'index.html');

  if (fs.existsSync(rootHtmlPath) && fs.existsSync(dpHtmlPath)) {
    try {
      const rootStats = fs.statSync(rootHtmlPath);
      const dpStats = fs.statSync(dpHtmlPath);

      if (rootStats.mtimeMs > dpStats.mtimeMs + 500) {
        fs.copyFileSync(rootHtmlPath, dpHtmlPath);
      }
    } catch (err) {
      console.error('Error syncing root index.html with digital-passbook:', err);
    }
  }

  // 2. Auto-discover any new standalone *.html files in the root folder (e.g. new-template.html, passbook2.html)
  try {
    const rootFiles = fs.readdirSync(rootDir, { withFileTypes: true });
    for (const file of rootFiles) {
      if (file.isFile() && file.name.endsWith('.html') && file.name !== 'index.html') {
        const templateId = path.basename(file.name, '.html').toLowerCase().replace(/[^a-z0-9-_]/g, '-');
        const targetDir = path.join(TEMPLATES_DIR, templateId);
        const targetHtmlPath = path.join(targetDir, 'index.html');

        if (!fs.existsSync(targetDir)) {
          fs.mkdirSync(targetDir, { recursive: true });
        }

        const srcPath = path.join(rootDir, file.name);
        const srcStats = fs.statSync(srcPath);
        let targetStats = null;
        if (fs.existsSync(targetHtmlPath)) {
          targetStats = fs.statSync(targetHtmlPath);
        }

        if (!targetStats || srcStats.mtimeMs > targetStats.mtimeMs) {
          fs.copyFileSync(srcPath, targetHtmlPath);
        }
      }
    }
  } catch (err) {
    console.error('Error scanning root html files:', err);
  }

  const entries = fs.readdirSync(TEMPLATES_DIR, { withFileTypes: true });
  const templates = [];

  for (const entry of entries) {
    if (entry.isDirectory()) {
      const templateId = entry.name;
      const templateDirPath = path.join(TEMPLATES_DIR, templateId);
      const htmlPath = path.join(templateDirPath, 'index.html');
      const backupHtmlPath = path.join(templateDirPath, 'index.original.html');
      const cssPath = path.join(templateDirPath, 'styles.css');
      const configPath = path.join(templateDirPath, 'template.json');
      const savedStatePath = path.join(templateDirPath, 'saved_state.json');

      if (fs.existsSync(htmlPath)) {
        // Create an original backup copy if it doesn't exist yet
        if (!fs.existsSync(backupHtmlPath)) {
          fs.copyFileSync(htmlPath, backupHtmlPath);
        }

        const stats = fs.statSync(htmlPath);
        let config = {};

        if (fs.existsSync(configPath)) {
          try {
            config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
          } catch (e) {
            console.error(`Error reading config for template ${templateId}:`, e);
          }
        }

        const htmlContent = fs.readFileSync(htmlPath, 'utf8');
        const cssContent = fs.existsSync(cssPath) ? fs.readFileSync(cssPath, 'utf8') : '';

        // Auto-detect fields if config categories are empty or missing
        let categories = config.categories || [];
        if (!categories.length) {
          categories = autoDetectCategoriesAndFields(htmlContent);
        }

        // Count total editable fields
        let fieldCount = 0;
        categories.forEach(cat => {
          fieldCount += (cat.fields ? cat.fields.length : 0);
        });

        // Load saved state if present
        let savedState = null;
        if (fs.existsSync(savedStatePath)) {
          try {
            savedState = JSON.parse(fs.readFileSync(savedStatePath, 'utf8'));
          } catch (e) {
            console.error(`Error loading saved state for ${templateId}:`, e);
          }
        }

        const templateName = config.name || formatTemplateName(templateId);

        templates.push({
          id: templateId,
          name: templateName,
          description: config.description || `Existing template: ${templateName}`,
          category: config.category || 'Templates',
          aspectRatio: config.aspectRatio || '596 / 842',
          width: config.width || 596,
          height: config.height || 842,
          lastModified: stats.mtime.toISOString(),
          fieldCount: fieldCount,
          categories: categories,
          html: htmlContent,
          css: cssContent,
          savedState: savedState
        });
      }
    }
  }

  return templates;
}

/**
 * Helper to auto-generate human-friendly template name from folder name
 */
function formatTemplateName(folderName) {
  return folderName
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, char => char.toUpperCase());
}

/**
 * Auto-detect editable fields from raw HTML when no template.json exists
 */
function autoDetectCategoriesAndFields(html) {
  const fields = [];
  
  const detailRowRegex = /<div[^>]*class="[^"]*detail-row[^"]*"[^>]*>[\s\S]*?<span[^>]*class="[^"]*detail-label[^"]*"[^>]*>\s*([^<]+)\s*<\/span>[\s\S]*?<span[^>]*class="[^"]*detail-value[^"]*"[^>]*>\s*([\s\S]*?)\s*<\/span>[\s\S]*?<\/div>/gi;
  
  let match;
  let idx = 1;
  while ((match = detailRowRegex.exec(html)) !== null) {
    const label = match[1].trim();
    if (label && label !== ':') {
      fields.push({
        id: `auto_field_${idx++}`,
        label: label,
        selector: `.detail-row:nth-child(${idx - 1}) .detail-value`,
        type: 'text'
      });
    }
  }

  if (!fields.length) {
    const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
    if (h1Match) {
      fields.push({ id: 'h1_title', label: 'Main Heading', selector: 'h1', type: 'text' });
    }

    const h2Regex = /<h2[^>]*>([\s\S]*?)<\/h2>/gi;
    let h2Match;
    let h2Idx = 1;
    while ((h2Match = h2Regex.exec(html)) !== null) {
      fields.push({ id: `h2_title_${h2Idx++}`, label: `Heading ${h2Idx - 1}`, selector: `h2:nth-of-type(${h2Idx - 1})`, type: 'text' });
    }
  }

  return [
    {
      name: 'Auto-Detected Template Fields',
      fields: fields
    }
  ];
}

/**
 * Save template modifications to disk (updates saved_state.json AND actual index.html file)
 */
function saveTemplateState(templateId, stateData) {
  const templateDirPath = path.join(TEMPLATES_DIR, templateId);
  if (!fs.existsSync(templateDirPath)) {
    throw new Error(`Template directory not found: ${templateId}`);
  }

  // 1. Save state json
  const savedStatePath = path.join(templateDirPath, 'saved_state.json');
  fs.writeFileSync(savedStatePath, JSON.stringify(stateData, null, 2), 'utf8');

  // 2. Overwrite the actual index.html file directly!
  if (stateData.html) {
    const htmlPath = path.join(templateDirPath, 'index.html');
    fs.writeFileSync(htmlPath, stateData.html, 'utf8');

    // If saving digital-passbook, update root index.html as well so both stay identical
    if (templateId === 'digital-passbook') {
      const rootHtmlPath = path.join(__dirname, '..', 'index.html');
      fs.writeFileSync(rootHtmlPath, stateData.html, 'utf8');
    }
  }

  return { success: true, timestamp: new Date().toISOString() };
}

/**
 * Reset template state (restores original HTML and removes saved overrides)
 */
function resetTemplateState(templateId) {
  const templateDirPath = path.join(TEMPLATES_DIR, templateId);
  if (!fs.existsSync(templateDirPath)) {
    throw new Error(`Template directory not found: ${templateId}`);
  }

  const savedStatePath = path.join(templateDirPath, 'saved_state.json');
  const htmlPath = path.join(templateDirPath, 'index.html');
  const backupHtmlPath = path.join(templateDirPath, 'index.original.html');
  const rootHtmlPath = path.join(__dirname, '..', 'index.html');

  // 1. Remove saved_state.json (clears design overrides and form field edits)
  if (fs.existsSync(savedStatePath)) {
    fs.unlinkSync(savedStatePath);
  }

  // 2. Restore index.html from original backup
  if (fs.existsSync(backupHtmlPath)) {
    fs.copyFileSync(backupHtmlPath, htmlPath);

    // If resetting digital-passbook, sync back to root index.html as well
    if (templateId === 'digital-passbook' && fs.existsSync(rootHtmlPath)) {
      try {
        fs.copyFileSync(backupHtmlPath, rootHtmlPath);
      } catch (err) {
        console.error('Error syncing root index.html during reset:', err);
      }
    }
  }

  return { success: true };
}

/**
 * Delete a template directory and state permanently
 */
function deleteTemplate(templateId) {
  const safeId = path.basename(templateId);
  const templateDirPath = path.join(TEMPLATES_DIR, safeId);

  if (!fs.existsSync(templateDirPath)) {
    throw new Error(`Template directory not found: ${safeId}`);
  }

  fs.rmSync(templateDirPath, { recursive: true, force: true });
  return { success: true };
}

module.exports = {
  scanTemplates,
  saveTemplateState,
  resetTemplateState,
  deleteTemplate
};

