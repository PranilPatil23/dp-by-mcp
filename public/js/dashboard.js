/**
 * Dashboard View Module
 */
const DashboardView = {
  templates: [],

  init(templates) {
    this.templates = templates;
    this.renderGrid(this.templates);
    this.bindSearch();
  },

  renderGrid(templateList) {
    const container = document.getElementById('templatesGrid');
    const counter = document.getElementById('templateCounter');

    counter.textContent = `${templateList.length} Template${templateList.length === 1 ? '' : 's'} Discovered`;

    if (!templateList.length) {
      container.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 60px 20px; color: var(--text-muted);">
          <h3>No templates found matching your search</h3>
          <p style="margin-top: 8px;">Try clearing search filters or add a template folder into <code>templates/</code>.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = templateList.map(template => {
      const formattedDate = new Date(template.lastModified).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });

      const w = template.width || 596;
      const h = template.height || 842;
      const scale = (340 / w).toFixed(3);

      return `
        <div class="template-card" data-id="${template.id}">
          <div class="card-preview-wrapper">
            <div class="card-iframe-scaler" style="width: ${w}px; height: ${h}px; transform: translateX(-50%) scale(${scale});">
              <iframe class="card-preview-iframe" src="/templates/${template.id}/index.html?t=${new Date(template.lastModified).getTime() || Date.now()}" style="width: ${w}px; height: ${h}px;" loading="lazy"></iframe>
            </div>
            <div class="card-preview-overlay">
              <button class="btn btn-secondary edit-btn" data-id="${template.id}">
                <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
                Edit Template
              </button>
            </div>
          </div>
          <div class="card-info">
            <div class="card-header">
              <h3 class="card-title">${template.name}</h3>
              <span class="card-badge">${template.fieldCount} Fields</span>
            </div>
            <p class="card-desc">${template.description}</p>
            <div class="card-meta">
              <span>Modified: ${formattedDate}</span>
              <span>Category: ${template.category}</span>
            </div>
            <div class="card-actions">
              <button class="btn btn-primary btn-full edit-btn" data-id="${template.id}">
                Edit Template
              </button>
            </div>
          </div>
        </div>
      `;
    }).join('');

    // Bind event listeners to Edit buttons
    document.querySelectorAll('.edit-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.dataset.id;
        App.openEditor(id);
      });
    });
  },

  bindSearch() {
    const searchInput = document.getElementById('templateSearch');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase().trim();
        const filtered = this.templates.filter(t => 
          t.name.toLowerCase().includes(query) ||
          t.description.toLowerCase().includes(query) ||
          t.category.toLowerCase().includes(query)
        );
        this.renderGrid(filtered);
      });
    }
  }
};
