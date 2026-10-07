const express = require('express');
const path = require('path');
const fs = require('fs');
const { scanTemplates, saveTemplateState, resetTemplateState, deleteTemplate } = require('./lib/templateScanner');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '10mb' }));

// Serve static frontend files
app.use(express.static(path.join(__dirname, 'public')));

// Serve raw templates directory for isolated iframe previews (no-cache so dashboard iframe stays live)
app.use('/templates', express.static(path.join(__dirname, 'templates'), {
  etag: false,
  maxAge: 0,
  setHeaders: (res) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
}));

// API: Discover & list all available templates dynamically
app.get('/api/templates', (req, res) => {
  try {
    const templates = scanTemplates();
    res.json({ success: true, count: templates.length, templates });
  } catch (error) {
    console.error('Failed to scan templates:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// API: Get single template details
app.get('/api/templates/:id', (req, res) => {
  try {
    const { id } = req.params;
    const templates = scanTemplates();
    const template = templates.find(t => t.id === id);
    if (!template) {
      return res.status(404).json({ success: false, error: 'Template not found' });
    }
    res.json({ success: true, template });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// API: Save template modifications
app.post('/api/templates/:id/save', (req, res) => {
  try {
    const { id } = req.params;
    const stateData = req.body;
    const result = saveTemplateState(id, stateData);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// API: Reset template to original state
app.post('/api/templates/:id/reset', (req, res) => {
  try {
    const { id } = req.params;
    const result = resetTemplateState(id);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// API: Delete template permanently
app.delete('/api/templates/:id', (req, res) => {
  try {
    const { id } = req.params;
    const result = deleteTemplate(id);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(` Template Management + Live Editing Dashboard Server `);
  console.log(` Server running at: http://localhost:${PORT} `);
  console.log(`=======================================================`);
});
