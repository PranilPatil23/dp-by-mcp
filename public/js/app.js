/**
 * Main Application Controller
 */
const App = {
  currentView: 'dashboard',
  templates: [],
  activeTemplateId: null,
  pendingSwitchId: null,

  async init() {
    await this.fetchTemplates();
    DashboardView.init(this.templates);
    this.renderHeader();
    this.bindGlobalEvents();
  },

  async fetchTemplates() {
    try {
      const response = await fetch('/api/templates');
      const data = await response.json();
      if (data.success) {
        this.templates = data.templates;
      }
    } catch (err) {
      console.error('Error fetching templates:', err);
    }
  },

  renderHeader() {
    const headerActions = document.getElementById('headerActions');
    if (!headerActions) return;

    if (this.currentView === 'dashboard') {
      headerActions.innerHTML = `
        <button class="btn btn-secondary" id="refreshBtn" title="Rescan templates directory">
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Rescan Templates
        </button>
      `;

      document.getElementById('refreshBtn').onclick = async () => {
        await this.fetchTemplates();
        DashboardView.init(this.templates);
        this.showToast('Template directory rescanned!');
      };
    } else if (this.currentView === 'editor') {
      const activeTemplate = this.templates.find(t => t.id === this.activeTemplateId);

      headerActions.innerHTML = `
        <div id="editorStatusContainer" style="display: flex; align-items: center; gap: 8px;"></div>

        <button class="btn btn-secondary" id="backBtn">
          ← Back to Dashboard
        </button>

        <button class="btn btn-secondary" id="discardBtn">
          Discard Changes
        </button>

        <button class="btn btn-danger" id="resetBtn">
          Reset
        </button>

        <button class="btn btn-primary" id="saveBtn">
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
          </svg>
          Save Changes
        </button>
      `;

      document.getElementById('backBtn').onclick = () => this.requestSwitchView('dashboard');
      document.getElementById('discardBtn').onclick = () => TemplateEditor.discardChanges();
      document.getElementById('resetBtn').onclick = () => TemplateEditor.resetTemplate();
      document.getElementById('saveBtn').onclick = () => TemplateEditor.saveChanges();

      TemplateEditor.updateStatusPill();
    }
  },

  openEditor(templateId) {
    if (this.currentView === 'editor' && TemplateEditor.hasUnsavedChanges) {
      this.pendingSwitchId = templateId;
      this.showUnsavedModal();
      return;
    }

    const template = this.templates.find(t => t.id === templateId);
    if (!template) return;

    this.activeTemplateId = templateId;
    this.currentView = 'editor';

    document.getElementById('dashboardView').style.display = 'none';
    document.getElementById('editorView').style.display = 'grid';

    this.renderHeader();
    TemplateEditor.init(template);
  },

  requestSwitchView(targetView) {
    if (this.currentView === 'editor' && TemplateEditor.hasUnsavedChanges) {
      this.pendingSwitchId = targetView;
      this.showUnsavedModal();
      return;
    }

    this.switchView(targetView);
  },

  switchView(targetView) {
    if (targetView === 'dashboard') {
      this.currentView = 'dashboard';
      this.activeTemplateId = null;

      document.getElementById('editorView').style.display = 'none';
      document.getElementById('dashboardView').style.display = 'block';

      this.fetchTemplates().then(() => {
        DashboardView.init(this.templates);
        this.renderHeader();
      });
    } else {
      this.openEditor(targetView);
    }
  },

  showUnsavedModal() {
    const modal = document.getElementById('unsavedModal');
    if (modal) modal.classList.add('show');
  },

  hideUnsavedModal() {
    const modal = document.getElementById('unsavedModal');
    if (modal) modal.classList.remove('show');
  },

  bindGlobalEvents() {
    // Unsaved Modal Buttons
    document.getElementById('modalCancel').onclick = () => {
      this.hideUnsavedModal();
      this.pendingSwitchId = null;
    };

    document.getElementById('modalDiscard').onclick = () => {
      this.hideUnsavedModal();
      TemplateEditor.discardChanges();
      const target = this.pendingSwitchId;
      this.pendingSwitchId = null;
      this.switchView(target);
    };

    document.getElementById('modalSaveSwitch').onclick = async () => {
      await TemplateEditor.saveChanges();
      this.hideUnsavedModal();
      const target = this.pendingSwitchId;
      this.pendingSwitchId = null;
      this.switchView(target);
    };
  },

  showToast(message, isError = false) {
    let toast = document.getElementById('appToast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'appToast';
      toast.style.cssText = `
        position: fixed;
        bottom: 24px;
        right: 24px;
        padding: 12px 20px;
        border-radius: 12px;
        font-size: 13px;
        font-weight: 600;
        color: white;
        z-index: 2000;
        transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.3s ease;
        box-shadow: 0 10px 25px rgba(0,0,0,0.4);
      `;
      document.body.appendChild(toast);
    }

    toast.style.background = isError ? '#f43f5e' : '#10b981';
    toast.textContent = message;
    toast.style.opacity = '1';
    toast.style.transform = 'translateY(0)';

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
    }, 3000);
  }
};

// Global helper for escaping HTML in input values
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
