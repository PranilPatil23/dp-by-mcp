/**
 * Reusable Template Editor Component
 */
const TemplateEditor = {
  template: null,
  iframe: null,
  iframeDoc: null,
  currentState: {
    fields: {},
    design: {
      fontFamily: 'default',
      fontSize: 14,
      lineHeight: 'default',
      textColor: '#111827',
      bgColor: '#ffffff',
      width: 596,
      borderRadius: 20
    }
  },
  savedState: null,
  hasUnsavedChanges: false,
  currentZoom: 1.0,

  init(template) {
    this.template = template;
    this.iframe = document.getElementById('previewIframe');
    this.currentZoom = 1.0;
    this.hasUnsavedChanges = false;

    // Load initial or saved state
    this.loadState();

    // Set dimensions & aspect ratio
    this.applyDimensions();

    // Load template HTML into iframe
    this.loadIframe();

    // Render left controls (Content & Design)
    this.renderFieldControls();
    this.bindDesignControls();
    this.bindTabSwitching();
    this.bindZoomControls();
    this.bindMobileViewToggle();

    // Auto-fit zoom for mobile viewports
    this.autoFitMobileZoom();

    // Update status badge
    this.updateStatusPill();
  },

  loadState() {
    if (this.template.savedState) {
      this.currentState = JSON.parse(JSON.stringify(this.template.savedState));
      this.savedState = JSON.parse(JSON.stringify(this.template.savedState));
    } else {
      this.currentState = {
        fields: {},
        design: {
          fontFamily: 'default',
          fontSize: 'default',
          lineHeight: 'default',
          textColor: 'default',
          bgColor: 'default',
          width: this.template.width || 596,
          borderRadius: 'default'
        }
      };
      this.savedState = JSON.parse(JSON.stringify(this.currentState));
    }
  },

  applyDimensions() {
    const container = document.getElementById('iframeContainer');
    const metaBadge = document.getElementById('templateMetaBadge');

    const width = this.currentState.design.width || this.template.width || 596;
    const height = this.template.height || 842;

    container.style.width = `${width}px`;
    container.style.height = `${height}px`;

    metaBadge.textContent = `Dimensions: ${width}px × ${height}px`;
  },

  loadIframe() {
    this.iframe.src = `/templates/${this.template.id}/index.html?t=${Date.now()}`;

    this.iframe.onload = () => {
      this.iframeDoc = this.iframe.contentDocument || this.iframe.contentWindow.document;

      // Extract initial text values for fields if not set in state
      this.extractDefaultFieldValues();

      // Refresh sidebar controls with extracted field values
      this.renderFieldControls();

      // Apply initial text modifications and design overrides to iframe
      this.applyAllFieldUpdates();
      this.applyDesignOverrides();

      // Enable interactive click-to-edit inspector inside iframe
      this.setupIframeElementInspector();
    };
  },

  extractDefaultFieldValues() {
    if (!this.iframeDoc) return;

    this.template.categories.forEach(cat => {
      cat.fields.forEach(field => {
        if (this.currentState.fields[field.id] === undefined) {
          const el = this.iframeDoc.querySelector(field.selector);
          if (el) {
            this.currentState.fields[field.id] = el.innerText.trim();
          }
        }
      });
    });

    if (!this.savedState || !Object.keys(this.savedState.fields).length) {
      this.savedState = JSON.parse(JSON.stringify(this.currentState));
    }
  },

  renderFieldControls() {
    const container = document.getElementById('fieldsContainer');
    if (!container) return;

    container.innerHTML = this.template.categories.map((cat, catIdx) => `
      <div class="control-group">
        <div class="control-group-title">
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
          ${cat.name}
        </div>
        ${cat.fields.map(field => {
          const value = this.currentState.fields[field.id] !== undefined 
            ? this.currentState.fields[field.id] 
            : '';

          if (field.type === 'textarea') {
            return `
              <div class="field-control" data-field-id="${field.id}">
                <label class="field-label">${field.label}</label>
                <textarea class="field-textarea live-field-input" data-id="${field.id}" data-selector="${field.selector}">${value}</textarea>
              </div>
            `;
          }

          return `
            <div class="field-control" data-field-id="${field.id}">
              <label class="field-label">${field.label}</label>
              <input type="text" class="field-input live-field-input" data-id="${field.id}" data-selector="${field.selector}" value="${escapeHtml(value)}">
            </div>
          `;
        }).join('')}
      </div>
    `).join('');

    // Bind real-time live input listener
    container.querySelectorAll('.live-field-input').forEach(input => {
      input.addEventListener('input', (e) => {
        const fieldId = e.target.dataset.id;
        const selector = e.target.dataset.selector;
        const newValue = e.target.value;

        // Update local state
        this.currentState.fields[fieldId] = newValue;
        this.markUnsaved();

        // Update live iframe immediately on keystroke
        this.updateIframeElement(selector, newValue);
      });
    });

    // Field search filter
    const searchInput = document.getElementById('fieldSearch');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase().trim();
        document.querySelectorAll('.field-control').forEach(ctrl => {
          const label = ctrl.querySelector('.field-label').textContent.toLowerCase();
          ctrl.style.display = label.includes(query) ? 'block' : 'none';
        });
      });
    }
  },

  updateIframeElement(selector, value) {
    if (!this.iframeDoc) return;
    const el = this.iframeDoc.querySelector(selector);
    if (el) {
      if (value.includes('\n')) {
        el.innerHTML = value.replace(/\n/g, '<br />');
      } else {
        el.textContent = value;
      }
    }
  },

  applyAllFieldUpdates() {
    if (!this.iframeDoc) return;
    this.template.categories.forEach(cat => {
      cat.fields.forEach(field => {
        const val = this.currentState.fields[field.id];
        if (val !== undefined) {
          this.updateIframeElement(field.selector, val);
        }
      });
    });
  },

  bindDesignControls() {
    const d = this.currentState.design;

    // Font Family
    const fontFamilySelect = document.getElementById('designFontFamily');
    if (fontFamilySelect) {
      fontFamilySelect.value = d.fontFamily || 'default';
      fontFamilySelect.onchange = (e) => {
        this.currentState.design.fontFamily = e.target.value;
        this.markUnsaved();
        this.applyDesignOverrides();
      };
    }

    // Font Size Slider
    const fontSizeSlider = document.getElementById('designFontSize');
    const fontSizeVal = document.getElementById('fontSizeVal');
    const resetFontSize = document.getElementById('resetFontSize');
    if (fontSizeSlider) {
      if (!d.fontSize || d.fontSize === 'default') {
        fontSizeSlider.value = 14;
        if (fontSizeVal) fontSizeVal.textContent = 'Default';
      } else {
        fontSizeSlider.value = d.fontSize;
        if (fontSizeVal) fontSizeVal.textContent = `${d.fontSize}px`;
      }
      fontSizeSlider.oninput = (e) => {
        this.currentState.design.fontSize = e.target.value;
        if (fontSizeVal) fontSizeVal.textContent = `${e.target.value}px`;
        this.markUnsaved();
        this.applyDesignOverrides();
      };
    }
    if (resetFontSize) {
      resetFontSize.onclick = () => {
        this.currentState.design.fontSize = 'default';
        if (fontSizeSlider) fontSizeSlider.value = 14;
        if (fontSizeVal) fontSizeVal.textContent = 'Default';
        this.markUnsaved();
        this.applyDesignOverrides();
      };
    }

    // Line Height
    const lineHeightSelect = document.getElementById('designLineHeight');
    if (lineHeightSelect) {
      lineHeightSelect.value = d.lineHeight || 'default';
      lineHeightSelect.onchange = (e) => {
        this.currentState.design.lineHeight = e.target.value;
        this.markUnsaved();
        this.applyDesignOverrides();
      };
    }

    // Text Color
    const textColorPicker = document.getElementById('designTextColor');
    const textColorHex = document.getElementById('designTextColorHex');
    const resetTextColor = document.getElementById('resetTextColor');
    if (textColorPicker && textColorHex) {
      if (!d.textColor || d.textColor === 'default') {
        textColorPicker.value = '#111827';
        textColorHex.value = '';
      } else {
        textColorPicker.value = d.textColor;
        textColorHex.value = d.textColor;
      }

      textColorPicker.oninput = (e) => {
        textColorHex.value = e.target.value;
        this.currentState.design.textColor = e.target.value;
        this.markUnsaved();
        this.applyDesignOverrides();
      };

      textColorHex.oninput = (e) => {
        const val = e.target.value.trim();
        if (!val) {
          this.currentState.design.textColor = 'default';
        } else {
          if (/^#[0-9A-F]{6}$/i.test(val)) {
            textColorPicker.value = val;
          }
          this.currentState.design.textColor = val;
        }
        this.markUnsaved();
        this.applyDesignOverrides();
      };
    }
    if (resetTextColor) {
      resetTextColor.onclick = () => {
        this.currentState.design.textColor = 'default';
        if (textColorPicker) textColorPicker.value = '#111827';
        if (textColorHex) textColorHex.value = '';
        this.markUnsaved();
        this.applyDesignOverrides();
      };
    }

    // Background Color
    const bgColorPicker = document.getElementById('designBgColor');
    const bgColorHex = document.getElementById('designBgColorHex');
    const resetBgColor = document.getElementById('resetBgColor');
    if (bgColorPicker && bgColorHex) {
      if (!d.bgColor || d.bgColor === 'default') {
        bgColorPicker.value = '#ffffff';
        bgColorHex.value = '';
      } else {
        bgColorPicker.value = d.bgColor;
        bgColorHex.value = d.bgColor;
      }

      bgColorPicker.oninput = (e) => {
        bgColorHex.value = e.target.value;
        this.currentState.design.bgColor = e.target.value;
        this.markUnsaved();
        this.applyDesignOverrides();
      };

      bgColorHex.oninput = (e) => {
        const val = e.target.value.trim();
        if (!val) {
          this.currentState.design.bgColor = 'default';
        } else {
          if (/^#[0-9A-F]{6}$/i.test(val)) {
            bgColorPicker.value = val;
          }
          this.currentState.design.bgColor = val;
        }
        this.markUnsaved();
        this.applyDesignOverrides();
      };
    }
    if (resetBgColor) {
      resetBgColor.onclick = () => {
        this.currentState.design.bgColor = 'default';
        if (bgColorPicker) bgColorPicker.value = '#ffffff';
        if (bgColorHex) bgColorHex.value = '';
        this.markUnsaved();
        this.applyDesignOverrides();
      };
    }

    // Container Width
    const widthSlider = document.getElementById('designWidth');
    const widthVal = document.getElementById('widthVal');
    if (widthSlider) {
      widthSlider.value = d.width || this.template.width || 596;
      if (widthVal) widthVal.textContent = `${d.width || this.template.width || 596}px`;
      widthSlider.oninput = (e) => {
        this.currentState.design.width = e.target.value;
        if (widthVal) widthVal.textContent = `${e.target.value}px`;
        this.applyDimensions();
        this.markUnsaved();
        this.applyDesignOverrides();
      };
    }

    // Border Radius
    const radiusSlider = document.getElementById('designBorderRadius');
    const radiusVal = document.getElementById('radiusVal');
    const resetBorderRadius = document.getElementById('resetBorderRadius');
    if (radiusSlider) {
      if (!d.borderRadius || d.borderRadius === 'default') {
        radiusSlider.value = 20;
        if (radiusVal) radiusVal.textContent = 'Default';
      } else {
        radiusSlider.value = d.borderRadius;
        if (radiusVal) radiusVal.textContent = `${d.borderRadius}px`;
      }
      radiusSlider.oninput = (e) => {
        this.currentState.design.borderRadius = e.target.value;
        if (radiusVal) radiusVal.textContent = `${e.target.value}px`;
        this.markUnsaved();
        this.applyDesignOverrides();
      };
    }
    if (resetBorderRadius) {
      resetBorderRadius.onclick = () => {
        this.currentState.design.borderRadius = 'default';
        if (radiusSlider) radiusSlider.value = 20;
        if (radiusVal) radiusVal.textContent = 'Default';
        this.markUnsaved();
        this.applyDesignOverrides();
      };
    }
  },

  applyDesignOverrides() {
    if (!this.iframeDoc) return;

    let styleTag = this.iframeDoc.getElementById('editor-override-styles');
    if (!styleTag) {
      styleTag = this.iframeDoc.createElement('style');
      styleTag.id = 'editor-override-styles';
      this.iframeDoc.head.appendChild(styleTag);
    }

    const d = this.currentState.design;

    // Load Google Font dynamically if selected
    if (d.fontFamily && d.fontFamily !== 'default') {
      this.ensureGoogleFontLoaded(d.fontFamily);
    }

    const fontFamilyRule = (d.fontFamily && d.fontFamily !== 'default')
      ? `font-family: ${d.fontFamily} !important;` 
      : '';

    let fontSizeRule = '';
    if (d.fontSize && d.fontSize !== 'default') {
      const sizeVal = parseFloat(d.fontSize);
      if (!isNaN(sizeVal)) {
        fontSizeRule = `
          body, body p, body span, body div, body td, body th, body label, body input, body textarea, body select, body button, body a, body b, body strong, body li, .detail-label, .detail-value, .bill-lbl, .bill-val, .card-type, .holder-name {
            font-size: ${sizeVal}px !important;
          }
          h1 { font-size: ${Math.round(sizeVal * 1.8)}px !important; }
          h2 { font-size: ${Math.round(sizeVal * 1.35)}px !important; }
          h3 { font-size: ${Math.round(sizeVal * 1.15)}px !important; }
        `;
      }
    }

    const lineHeightRule = (d.lineHeight && d.lineHeight !== 'default')
      ? `line-height: ${d.lineHeight} !important;` 
      : '';

    const textColorRule = (d.textColor && d.textColor !== 'default')
      ? `color: ${d.textColor} !important;` 
      : '';

    const bgColorRule = (d.bgColor && d.bgColor !== 'default')
      ? `background-color: ${d.bgColor} !important;` 
      : '';

    const radiusRule = (d.borderRadius !== undefined && d.borderRadius !== 'default')
      ? `border-radius: ${d.borderRadius}px !important;` 
      : '';

    styleTag.textContent = `
      ${fontFamilyRule ? `
        body, body *, p, span, div, td, th, label, input, textarea, select, button, a, b, strong, h1, h2, h3, h4 {
          ${fontFamilyRule}
        }
      ` : ''}

      ${fontSizeRule}

      ${lineHeightRule ? `
        body, body *, p, span, div, td, th, label, h1, h2, h3, h4, b, strong, a, li {
          ${lineHeightRule}
        }
      ` : ''}

      ${textColorRule ? `
        body, body p, body span, body div:not(.card-chip):not(.card-hero):not(.help-card), body td, body th, body label, body h1, body h2, body h3, body h4, body strong, body b, body a, body li, .detail-label, .detail-value, .account-title, .meta-label, .meta-value, .bank-name, .bill-lbl, .bill-val, .tagline {
          ${textColorRule}
        }
      ` : ''}

      .account-card, .balance-panel, .statement-container, .card-statement {
        ${bgColorRule}
        ${radiusRule}
      }
    `;
  },

  ensureGoogleFontLoaded(fontFamilyStr) {
    if (!this.iframeDoc) return;
    const fontName = fontFamilyStr.split(',')[0].replace(/['"]/g, '').trim();

    const fontUrls = {
      'Inter': 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap',
      'Roboto': 'https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&display=swap',
      'Open Sans': 'https://fonts.googleapis.com/css2?family=Open+Sans:wght@400;500;600;700&display=swap',
      'Montserrat': 'https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700&display=swap',
      'Poppins': 'https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap',
      'Plus Jakarta Sans': 'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap',
      'Outfit': 'https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700&display=swap',
      'Space Grotesk': 'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;700&display=swap',
      'Playfair Display': 'https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;1,400&display=swap',
      'Merriweather': 'https://fonts.googleapis.com/css2?family=Merriweather:wght@400;700&display=swap',
      'Fira Code': 'https://fonts.googleapis.com/css2?family=Fira+Code:wght@400;500;700&display=swap',
      'JetBrains Mono': 'https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&display=swap',
      'Oswald': 'https://fonts.googleapis.com/css2?family=Oswald:wght@400;500;700&display=swap',
      'Pacifico': 'https://fonts.googleapis.com/css2?family=Pacifico&display=swap',
      'Cinzel': 'https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700&display=swap'
    };

    if (fontUrls[fontName]) {
      let linkTag = this.iframeDoc.getElementById('editor-google-font');
      if (!linkTag) {
        linkTag = this.iframeDoc.createElement('link');
        linkTag.id = 'editor-google-font';
        linkTag.rel = 'stylesheet';
        this.iframeDoc.head.appendChild(linkTag);
      }
      if (linkTag.href !== fontUrls[fontName]) {
        linkTag.href = fontUrls[fontName];
      }
    }
  },

  bindTabSwitching() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.onclick = (e) => {
        const targetTab = e.currentTarget.dataset.tab;
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));

        e.currentTarget.classList.add('active');
        const pane = document.getElementById(targetTab);
        if (pane) pane.classList.add('active');
      };
    });
  },

  bindZoomControls() {
    const container = document.getElementById('iframeContainer');
    const zoomVal = document.getElementById('zoomVal');

    const updateZoomDisplay = () => {
      container.style.transform = `scale(${this.currentZoom})`;
      zoomVal.textContent = `${Math.round(this.currentZoom * 100)}%`;
    };

    document.getElementById('zoomIn').onclick = () => {
      this.currentZoom = Math.min(2.0, this.currentZoom + 0.1);
      updateZoomDisplay();
    };

    document.getElementById('zoomOut').onclick = () => {
      this.currentZoom = Math.max(0.4, this.currentZoom - 0.1);
      updateZoomDisplay();
    };

    document.getElementById('zoomReset').onclick = () => {
      this.currentZoom = 1.0;
      updateZoomDisplay();
    };

    document.getElementById('zoomFit').onclick = () => {
      const stage = document.getElementById('stageCanvas');
      const containerWidth = this.currentState.design.width || 596;
      const fitZoom = Math.min(1.0, (stage.clientWidth - 80) / containerWidth);
      this.currentZoom = Math.max(0.4, fitZoom);
      updateZoomDisplay();
    };

    document.getElementById('toggleFullscreen').onclick = () => {
      const stage = document.querySelector('.editor-stage');
      if (!document.fullscreenElement) {
        stage.requestFullscreen().catch(err => console.error(err));
      } else {
        document.exitFullscreen();
      }
    };

    window.addEventListener('resize', () => this.autoFitMobileZoom());
  },

  autoFitMobileZoom() {
    if (window.innerWidth <= 900) {
      const stage = document.getElementById('stageCanvas');
      const containerWidth = (this.currentState && this.currentState.design && this.currentState.design.width) || (this.template && this.template.width) || 596;
      if (stage && stage.clientWidth) {
        const fitZoom = Math.min(1.0, (stage.clientWidth - 20) / containerWidth);
        this.currentZoom = Math.max(0.3, fitZoom);
        const container = document.getElementById('iframeContainer');
        const zoomVal = document.getElementById('zoomVal');
        if (container) container.style.transform = `scale(${this.currentZoom})`;
        if (zoomVal) zoomVal.textContent = `${Math.round(this.currentZoom * 100)}%`;
      }
    }
  },

  bindMobileViewToggle() {
    const btnSidebar = document.getElementById('btnShowSidebar');
    const btnPreview = document.getElementById('btnShowPreview');
    const sidebar = document.querySelector('.editor-sidebar');
    const stage = document.querySelector('.editor-stage');

    if (btnSidebar && btnPreview && sidebar && stage) {
      if (window.innerWidth <= 900) {
        sidebar.classList.remove('mobile-hidden');
        stage.classList.add('mobile-hidden');
        btnSidebar.classList.add('active');
        btnPreview.classList.remove('active');
      } else {
        sidebar.classList.remove('mobile-hidden');
        stage.classList.remove('mobile-hidden');
      }

      btnSidebar.onclick = () => {
        btnSidebar.classList.add('active');
        btnPreview.classList.remove('active');
        sidebar.classList.remove('mobile-hidden');
        stage.classList.add('mobile-hidden');
      };

      btnPreview.onclick = () => {
        btnPreview.classList.add('active');
        btnSidebar.classList.remove('active');
        sidebar.classList.add('mobile-hidden');
        stage.classList.remove('mobile-hidden');
        setTimeout(() => this.autoFitMobileZoom(), 60);
      };
    }
  },

  setupIframeElementInspector() {
    if (!this.iframeDoc) return;

    // Inject hover and selection styles into iframe document
    let style = this.iframeDoc.getElementById('editor-inspector-styles');
    if (!style) {
      style = this.iframeDoc.createElement('style');
      style.id = 'editor-inspector-styles';
      style.innerHTML = `
        [data-editor-hover="true"] {
          outline: 2px dashed #6366f1 !important;
          outline-offset: 2px !important;
          cursor: pointer !important;
        }
        [data-editor-selected="true"] {
          outline: 2px solid #6366f1 !important;
          outline-offset: 2px !important;
          box-shadow: 0 0 12px rgba(99, 102, 241, 0.6) !important;
        }
      `;
      this.iframeDoc.head.appendChild(style);
    }

    // Reset selection references
    this.selectedElement = null;
    this.selectedField = null;
    this.clearSelectedElement();

    this.iframeDoc.addEventListener('mouseover', (e) => {
      if (!e.target || e.target === this.iframeDoc.body || e.target === this.iframeDoc.documentElement) return;
      e.target.setAttribute('data-editor-hover', 'true');
    }, true);

    this.iframeDoc.addEventListener('mouseout', (e) => {
      if (e.target && e.target.hasAttribute && e.target.hasAttribute('data-editor-hover')) {
        e.target.removeAttribute('data-editor-hover');
      }
    }, true);

    this.iframeDoc.addEventListener('click', (e) => {
      if (!e.target || e.target === this.iframeDoc.body || e.target === this.iframeDoc.documentElement) return;
      e.preventDefault();
      e.stopPropagation();
      this.selectIframeElement(e.target);
    }, true);
  },

  selectIframeElement(targetEl) {
    if (!targetEl) return;

    if (this.selectedElement) {
      this.selectedElement.removeAttribute('data-editor-selected');
    }

    this.selectedElement = targetEl;
    this.selectedElement.setAttribute('data-editor-selected', 'true');

    // Find matching field in template configuration
    let matchedField = null;
    if (this.template && this.template.categories) {
      for (const cat of this.template.categories) {
        for (const f of cat.fields) {
          if (targetEl.matches(f.selector) || targetEl.closest(f.selector)) {
            matchedField = f;
            break;
          }
        }
        if (matchedField) break;
      }
    }
    this.selectedField = matchedField;

    // Render inspector panel with properties for ONLY this element
    this.renderSelectedElementInspector(targetEl, matchedField);
  },

  renderSelectedElementInspector(targetEl, matchedField) {
    const container = document.getElementById('selectedElementContainer');
    if (!container) return;

    const computed = this.iframeDoc.defaultView.getComputedStyle(targetEl);
    const tagName = targetEl.tagName.toLowerCase();
    const label = matchedField ? matchedField.label : `Text Element <${tagName}>`;
    const currentText = matchedField 
      ? (this.currentState.fields[matchedField.id] || targetEl.innerText.trim())
      : targetEl.innerText.trim();

    const fontFamilies = [
      { name: 'Template Default', val: '' },
      { name: 'Inter', val: 'Inter, sans-serif' },
      { name: 'Roboto', val: 'Roboto, sans-serif' },
      { name: 'Open Sans', val: "'Open Sans', sans-serif" },
      { name: 'Montserrat', val: 'Montserrat, sans-serif' },
      { name: 'Poppins', val: 'Poppins, sans-serif' },
      { name: 'Courier New', val: "'Courier New', monospace" },
      { name: 'Georgia', val: 'Georgia, serif' }
    ];

    const rgbToHex = (rgbStr) => {
      if (!rgbStr || rgbStr === 'transparent' || rgbStr.includes('rgba(0, 0, 0, 0)')) return '#ffffff';
      const rgb = rgbStr.match(/\d+/g);
      if (!rgb || rgb.length < 3) return '#000000';
      return '#' + ((1 << 24) + (parseInt(rgb[0]) << 16) + (parseInt(rgb[1]) << 8) + parseInt(rgb[2])).toString(16).slice(1);
    };

    const currentTextColor = rgbToHex(computed.color);
    const currentBgColor = rgbToHex(computed.backgroundColor);
    const currentFontSize = parseInt(computed.fontSize) || 14;
    const isBold = computed.fontWeight === 'bold' || parseInt(computed.fontWeight) >= 600;
    const isItalic = computed.fontStyle === 'italic';

    // Extract background image url if set
    let rawBgImg = targetEl.style.backgroundImage || computed.backgroundImage || '';
    let cleanBgUrl = '';
    if (rawBgImg && rawBgImg !== 'none') {
      const match = rawBgImg.match(/url\(['"]?(.*?)['"]?\)/i);
      if (match && match[1] && !match[1].startsWith('data:image/svg+xml')) {
        cleanBgUrl = match[1];
      }
    }

    const isImgTag = tagName === 'img';
    const childImg = !isImgTag ? targetEl.querySelector('img') : null;
    const activeImgEl = isImgTag ? targetEl : childImg;

    container.style.display = 'block';
    container.innerHTML = `
      <div class="inspector-card">
        <div class="inspector-header">
          <div class="inspector-title">
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
            Clicked Item Properties
          </div>
          <button type="button" class="inspector-clear-btn" id="clearInspectorBtn">
            ✕ Show All Fields
          </button>
        </div>

        <div style="margin-bottom: 12px; display: flex; align-items: center; gap: 8px;">
          <span class="inspector-tag-badge">&lt;${tagName}&gt;</span>
          <span style="font-size: 13px; font-weight: 700; color: white;">${label}</span>
        </div>

        <!-- Live Text Content Edit (Only if element contains text or is text element) -->
        ${(!isImgTag || currentText) ? `
          <div class="field-control">
            <label class="field-label">Content Text</label>
            <textarea id="inspectorText" class="field-textarea" rows="2">${currentText}</textarea>
          </div>
        ` : ''}

        <!-- Typography Controls for Clicked Element -->
        <div class="field-control">
          <label class="field-label">Font Family</label>
          <select id="inspectorFontFamily" class="field-select">
            ${fontFamilies.map(f => `<option value="${f.val}" ${targetEl.style.fontFamily.includes(f.name) ? 'selected' : ''}>${f.name}</option>`).join('')}
          </select>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
          <div class="field-control">
            <label class="field-label">Font Size (<span id="inspectorFontSizeVal">${currentFontSize}px</span>)</label>
            <input type="range" id="inspectorFontSize" min="8" max="72" value="${currentFontSize}" class="field-input">
          </div>
          <div class="field-control">
            <label class="field-label">Formatting</label>
            <div class="format-btn-group">
              <button type="button" class="format-btn ${isBold ? 'active' : ''}" id="inspectorBoldBtn"><b>B</b></button>
              <button type="button" class="format-btn ${isItalic ? 'active' : ''}" id="inspectorItalicBtn"><i>I</i></button>
            </div>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
          <div class="field-control">
            <label class="field-label">Text Color</label>
            <div class="color-input-row">
              <input type="color" id="inspectorTextColorPicker" value="${currentTextColor}" class="color-picker">
              <input type="text" id="inspectorTextColorHex" value="${currentTextColor}" class="field-input" style="font-family: monospace;">
            </div>
          </div>
          <div class="field-control">
            <label class="field-label">Background Color</label>
            <div class="color-input-row">
              <input type="color" id="inspectorBgColorPicker" value="${currentBgColor}" class="color-picker">
              <input type="text" id="inspectorBgColorHex" value="${currentBgColor}" class="field-input" style="font-family: monospace;">
            </div>
          </div>
        </div>

        <!-- Image Src Controls (If <img> tag or contains <img>) -->
        ${activeImgEl ? `
          <div class="control-group" style="margin-top: 14px; padding-top: 14px; border-top: 1px dashed rgba(255,255,255,0.1);">
            <div class="control-group-title">
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              Image Settings (&lt;img&gt;)
            </div>

            <div class="field-control">
              <label class="field-label">Image Source (URL or Upload)</label>
              <div style="display: flex; gap: 8px;">
                <input type="text" id="inspectorImgSrc" value="${activeImgEl.getAttribute('src') || ''}" class="field-input" placeholder="https://... or relative path">
                <button type="button" class="btn btn-secondary" id="inspectorImgUploadBtn" style="padding: 6px 12px; font-size: 11px; flex-shrink: 0;">Upload</button>
                <input type="file" id="inspectorImgFileInput" accept="image/*" style="display: none;">
              </div>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
              <div class="field-control">
                <label class="field-label">Object Fit</label>
                <select id="inspectorImgObjectFit" class="field-select">
                  <option value="contain" ${activeImgEl.style.objectFit === 'contain' ? 'selected' : ''}>Contain</option>
                  <option value="cover" ${activeImgEl.style.objectFit === 'cover' ? 'selected' : ''}>Cover</option>
                  <option value="fill" ${activeImgEl.style.objectFit === 'fill' ? 'selected' : ''}>Fill</option>
                  <option value="none" ${activeImgEl.style.objectFit === 'none' ? 'selected' : ''}>None</option>
                </select>
              </div>
              <div class="field-control">
                <label class="field-label">Alt Text</label>
                <input type="text" id="inspectorImgAlt" value="${activeImgEl.alt || ''}" class="field-input" placeholder="Image description">
              </div>
            </div>
          </div>
        ` : ''}

        <!-- Background Image Controls (For Any Element) -->
        <div class="control-group" style="margin-top: 14px; padding-top: 14px; border-top: 1px dashed rgba(255,255,255,0.1);">
          <div class="control-group-title">
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            Background Image (CSS)
          </div>

          <div class="field-control">
            <label class="field-label">Background Image URL or Upload</label>
            <div style="display: flex; gap: 8px;">
              <input type="text" id="inspectorBgImgUrl" value="${cleanBgUrl}" class="field-input" placeholder="https://... or relative path">
              <button type="button" class="btn btn-secondary" id="inspectorBgImgUploadBtn" style="padding: 6px 12px; font-size: 11px; flex-shrink: 0;">Upload</button>
              <input type="file" id="inspectorBgImgFileInput" accept="image/*" style="display: none;">
            </div>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
            <div class="field-control">
              <label class="field-label">Bg Size</label>
              <select id="inspectorBgSize" class="field-select">
                <option value="cover" ${targetEl.style.backgroundSize === 'cover' ? 'selected' : ''}>Cover</option>
                <option value="contain" ${targetEl.style.backgroundSize === 'contain' ? 'selected' : ''}>Contain</option>
                <option value="auto" ${targetEl.style.backgroundSize === 'auto' ? 'selected' : ''}>Auto</option>
                <option value="100% 100%" ${targetEl.style.backgroundSize === '100% 100%' ? 'selected' : ''}>100% 100%</option>
              </select>
            </div>
            <div class="field-control">
              <label class="field-label">Bg Position</label>
              <select id="inspectorBgPosition" class="field-select">
                <option value="center center" ${targetEl.style.backgroundPosition === 'center center' ? 'selected' : ''}>Center</option>
                <option value="top center" ${targetEl.style.backgroundPosition === 'top center' ? 'selected' : ''}>Top Center</option>
                <option value="bottom center" ${targetEl.style.backgroundPosition === 'bottom center' ? 'selected' : ''}>Bottom Center</option>
                <option value="left center" ${targetEl.style.backgroundPosition === 'left center' ? 'selected' : ''}>Left Center</option>
                <option value="right center" ${targetEl.style.backgroundPosition === 'right center' ? 'selected' : ''}>Right Center</option>
              </select>
            </div>
          </div>
          <button type="button" class="btn btn-danger btn-full" id="removeBgImgBtn" style="margin-top: 8px; padding: 6px; font-size: 11px; ${cleanBgUrl ? '' : 'display: none;'}">
            Remove Background Image
          </button>
        </div>
      </div>
    `;

    container.scrollIntoView({ behavior: 'smooth', block: 'start' });

    // Event Bindings
    document.getElementById('clearInspectorBtn').onclick = () => this.clearSelectedElement();

    const textInput = document.getElementById('inspectorText');
    if (textInput) {
      textInput.oninput = (e) => {
        const val = e.target.value;
        if (matchedField) {
          this.currentState.fields[matchedField.id] = val;
          const tabInput = document.querySelector(`.live-field-input[data-id="${matchedField.id}"]`);
          if (tabInput) tabInput.value = val;
        }
        this.updateIframeElementText(targetEl, val);
        this.markUnsaved();
      };
    }

    document.getElementById('inspectorFontFamily').onchange = (e) => {
      targetEl.style.fontFamily = e.target.value;
      this.markUnsaved();
    };

    const fontSizeSlider = document.getElementById('inspectorFontSize');
    fontSizeSlider.oninput = (e) => {
      const size = e.target.value;
      document.getElementById('inspectorFontSizeVal').textContent = `${size}px`;
      targetEl.style.fontSize = `${size}px`;
      this.markUnsaved();
    };

    const boldBtn = document.getElementById('inspectorBoldBtn');
    boldBtn.onclick = () => {
      const currentlyBold = targetEl.style.fontWeight === 'bold' || computed.fontWeight === 'bold' || parseInt(computed.fontWeight) >= 600;
      targetEl.style.fontWeight = currentlyBold ? 'normal' : 'bold';
      boldBtn.classList.toggle('active', !currentlyBold);
      this.markUnsaved();
    };

    const italicBtn = document.getElementById('inspectorItalicBtn');
    italicBtn.onclick = () => {
      const currentlyItalic = targetEl.style.fontStyle === 'italic' || computed.fontStyle === 'italic';
      targetEl.style.fontStyle = currentlyItalic ? 'normal' : 'italic';
      italicBtn.classList.toggle('active', !currentlyItalic);
      this.markUnsaved();
    };

    const textColorPicker = document.getElementById('inspectorTextColorPicker');
    const textColorHex = document.getElementById('inspectorTextColorHex');
    textColorPicker.oninput = (e) => {
      textColorHex.value = e.target.value;
      targetEl.style.color = e.target.value;
      this.markUnsaved();
    };
    textColorHex.oninput = (e) => {
      if (/^#[0-9A-F]{6}$/i.test(e.target.value)) {
        textColorPicker.value = e.target.value;
      }
      targetEl.style.color = e.target.value;
      this.markUnsaved();
    };

    const bgColorPicker = document.getElementById('inspectorBgColorPicker');
    const bgColorHex = document.getElementById('inspectorBgColorHex');
    bgColorPicker.oninput = (e) => {
      bgColorHex.value = e.target.value;
      targetEl.style.backgroundColor = e.target.value;
      this.markUnsaved();
    };
    bgColorHex.oninput = (e) => {
      if (/^#[0-9A-F]{6}$/i.test(e.target.value)) {
        bgColorPicker.value = e.target.value;
      }
      targetEl.style.backgroundColor = e.target.value;
      this.markUnsaved();
    };

    // <img> Controls Bindings
    if (activeImgEl) {
      const imgSrcInput = document.getElementById('inspectorImgSrc');
      const imgUploadBtn = document.getElementById('inspectorImgUploadBtn');
      const imgFileInput = document.getElementById('inspectorImgFileInput');
      const imgObjectFit = document.getElementById('inspectorImgObjectFit');
      const imgAlt = document.getElementById('inspectorImgAlt');

      imgSrcInput.oninput = (e) => {
        activeImgEl.setAttribute('src', e.target.value);
        this.markUnsaved();
      };

      imgUploadBtn.onclick = () => imgFileInput.click();

      imgFileInput.onchange = (e) => {
        const file = e.target.files[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = (evt) => {
            imgSrcInput.value = evt.target.result;
            activeImgEl.setAttribute('src', evt.target.result);
            this.markUnsaved();
          };
          reader.readAsDataURL(file);
        }
      };

      imgObjectFit.onchange = (e) => {
        activeImgEl.style.objectFit = e.target.value;
        this.markUnsaved();
      };

      imgAlt.oninput = (e) => {
        activeImgEl.alt = e.target.value;
        this.markUnsaved();
      };
    }

    // Background Image Controls Bindings
    const bgImgUrlInput = document.getElementById('inspectorBgImgUrl');
    const bgImgUploadBtn = document.getElementById('inspectorBgImgUploadBtn');
    const bgImgFileInput = document.getElementById('inspectorBgImgFileInput');
    const bgSizeSelect = document.getElementById('inspectorBgSize');
    const bgPosSelect = document.getElementById('inspectorBgPosition');
    const removeBgImgBtn = document.getElementById('removeBgImgBtn');

    bgImgUrlInput.oninput = (e) => {
      const urlVal = e.target.value.trim();
      if (urlVal) {
        targetEl.style.backgroundImage = urlVal.startsWith('url(') ? urlVal : `url('${urlVal}')`;
        if (removeBgImgBtn) removeBgImgBtn.style.display = 'block';
      } else {
        targetEl.style.backgroundImage = 'none';
        if (removeBgImgBtn) removeBgImgBtn.style.display = 'none';
      }
      this.markUnsaved();
    };

    bgImgUploadBtn.onclick = () => bgImgFileInput.click();

    bgImgFileInput.onchange = (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (evt) => {
          bgImgUrlInput.value = evt.target.result;
          targetEl.style.backgroundImage = `url('${evt.target.result}')`;
          if (removeBgImgBtn) removeBgImgBtn.style.display = 'block';
          this.markUnsaved();
        };
        reader.readAsDataURL(file);
      }
    };

    bgSizeSelect.onchange = (e) => {
      targetEl.style.backgroundSize = e.target.value;
      this.markUnsaved();
    };

    bgPosSelect.onchange = (e) => {
      targetEl.style.backgroundPosition = e.target.value;
      this.markUnsaved();
    };

    if (removeBgImgBtn) {
      removeBgImgBtn.onclick = () => {
        targetEl.style.backgroundImage = 'none';
        bgImgUrlInput.value = '';
        removeBgImgBtn.style.display = 'none';
        this.markUnsaved();
      };
    }
  },

  updateIframeElementText(targetEl, val) {
    if (!targetEl) return;
    if (val.includes('\n')) {
      targetEl.innerHTML = val.replace(/\n/g, '<br />');
    } else {
      targetEl.textContent = val;
    }
  },

  clearSelectedElement() {
    if (this.selectedElement) {
      this.selectedElement.removeAttribute('data-editor-selected');
      this.selectedElement = null;
    }
    this.selectedField = null;
    const container = document.getElementById('selectedElementContainer');
    if (container) {
      container.style.display = 'none';
      container.innerHTML = '';
    }
  },

  getCleanIframeHtml() {
    if (!this.iframeDoc) return null;
    const clone = this.iframeDoc.documentElement.cloneNode(true);

    const styleTag = clone.querySelector('#editor-inspector-styles');
    if (styleTag) styleTag.remove();

    clone.querySelectorAll('[data-editor-hover]').forEach(el => el.removeAttribute('data-editor-hover'));
    clone.querySelectorAll('[data-editor-selected]').forEach(el => el.removeAttribute('data-editor-selected'));

    return '<!DOCTYPE html>\n<html>' + clone.innerHTML + '</html>';
  },

  markUnsaved() {
    this.hasUnsavedChanges = true;
    this.updateStatusPill();
  },

  updateStatusPill() {
    const container = document.getElementById('editorStatusContainer');
    if (container) {
      container.innerHTML = this.hasUnsavedChanges
        ? `<span class="status-pill status-unsaved">● Unsaved Changes</span>`
        : `<span class="status-pill status-saved">✓ Saved</span>`;
    }
  },

  async saveChanges() {
    try {
      const cleanHtml = this.getCleanIframeHtml();
      const payload = {
        fields: this.currentState.fields,
        design: this.currentState.design,
        html: cleanHtml
      };

      const response = await fetch(`/api/templates/${this.template.id}/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await response.json();
      if (data.success) {
        this.savedState = JSON.parse(JSON.stringify(this.currentState));
        this.template.savedState = JSON.parse(JSON.stringify(this.currentState));
        this.hasUnsavedChanges = false;
        this.updateStatusPill();
        App.showToast('Changes saved directly to index.html & disk!');
        await App.fetchTemplates();
      }
    } catch (err) {
      console.error('Failed to save template changes:', err);
      App.showToast('Error saving changes', true);
    }
  },

  async discardChanges() {
    try {
      const response = await fetch(`/api/templates/${this.template.id}/reset`, {
        method: 'POST'
      });
      const data = await response.json();
      if (data.success) {
        this.template.savedState = null;
        this.loadState();
        this.hasUnsavedChanges = false;
        this.updateStatusPill();
        this.renderFieldControls();
        this.bindDesignControls();
        this.loadIframe();
        App.showToast('Changes discarded & template restored to original state');
        await App.fetchTemplates();
        const updated = App.templates.find(t => t.id === this.template.id);
        if (updated) {
          this.template = updated;
        }
      }
    } catch (err) {
      console.error('Failed to discard changes:', err);
      App.showToast('Error discarding changes', true);
    }
  },

  async resetTemplate() {
    try {
      const response = await fetch(`/api/templates/${this.template.id}/reset`, {
        method: 'POST'
      });
      const data = await response.json();
      if (data.success) {
        this.template.savedState = null;
        this.loadState();
        this.hasUnsavedChanges = false;
        this.updateStatusPill();
        this.renderFieldControls();
        this.bindDesignControls();
        this.loadIframe();
        App.showToast('Template reset to initial version');
        await App.fetchTemplates();
        const updated = App.templates.find(t => t.id === this.template.id);
        if (updated) {
          this.template = updated;
        }
      }
    } catch (err) {
      console.error('Failed to reset template:', err);
      App.showToast('Error resetting template', true);
    }
  }
};
