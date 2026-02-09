// c:\Users\benjamin.bertrand\ws\nino\public\nino\NinoEditor.js
import './NinoTransformation.js';
import './NinoStats.js';

class NinoEditor extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });

    this.monaco = null;
    this.jsyaml = null;
    this.editorInstances = {}; // To hold Monaco editor instances
    this.activeTab = 'yaml';
    this.yamlEditorFileType = 'yaml'; // Default file type for YAML editor

    const template = document.createElement('template');
    template.innerHTML = `
      <link rel="stylesheet" href="NinoStyle.css">
      <div id="editor-panel" class="panel" >
        <div class="tab-header">
          <button class="tab-button active" data-tab="yaml">YAML</button>
          <button class="tab-button" data-tab="transformation">Execution</button>
          <button class="tab-button" data-tab="stats">Stats</button>
          <button class="tab-button" data-tab="graph">
            <span id="download-graph-btn" class="download-btn">⤓</span>Graph 
          </button>
        </div>
        <div id="yaml-editor-container" class="tab-content active editor-wrapper"></div>
        <div id="graph-view-container" class="tab-content editor-wrapper"></div>
        <div id="transformation-view-container" class="tab-content editor-wrapper"></div>
        <div id="stats-view-container" class="tab-content editor-wrapper"></div>
      </div>
    `;

    this.shadowRoot.appendChild(template.content.cloneNode(true));

    this.$tabHeader = this.shadowRoot.querySelector('.tab-header');
    this.$yamlEditorContainer = this.shadowRoot.getElementById('yaml-editor-container');
    this.$graphViewContainer = this.shadowRoot.getElementById('graph-view-container');
    this.$transformationViewContainer = this.shadowRoot.getElementById('transformation-view-container');
    this.$statsViewContainer = this.shadowRoot.getElementById('stats-view-container');
    this.$downloadGraphBtn = this.shadowRoot.getElementById('download-graph-btn');

    this.$tabHeader.addEventListener('click', this.handleTabClick.bind(this));
    this.$downloadGraphBtn.addEventListener('click', this.handleDownloadGraph.bind(this));
  }

  connectedCallback() {
    // Monaco Editor Initialization - embedded within the component
    // This assumes require.js is available globally.
    // To avoid conflicts, ensure 'vs' path is configured only once globally if possible,
    // or handle it carefully if truly isolating.
    // For this specific request, we'll assume a local config is intended.
    require.config({ paths: { vs: "/lib/monaco-editor-0.55.1/package/min/vs" } });

    require(["vs/editor/editor.main"], async (monaco) => {
      this._setMonacoInstance(monaco);
      // Signal to NinoApp.js that Monaco is ready for this component
      this.dispatchEvent(new CustomEvent('monaco-ready', { bubbles: true, composed: true }));
    });
  }

  async _setMonacoInstance(monaco) {
    this.monaco = monaco;
    await this.createEditors();
  }

  setJsyaml(jsyaml) {
    this.jsyaml = jsyaml;
  }

  async createEditors() {
    if (!this.monaco) return;

    const commonOptions = {
      theme: "nino-dark",
      lineNumbers: 'on',
      minimap: { enabled: false },
      automaticLayout: true, // Ensure editors layout automatically
    };

    this.editorInstances['yaml'] = this.monaco.editor.create(this.$yamlEditorContainer, {
      ...commonOptions,
      language: "yaml",
      model: this.monaco.editor.createModel('', 'yaml')
    });

    // Placeholder for graph viewer, it won't be a Monaco editor
    // this.$graphViewContainer will host the <transformation-plan> or <playbook-plan>
    // No Monaco editor instance for graph tab
  }

  layoutEditors() {
    // Monaco editors handle their own layout if automaticLayout is true
    // However, if there are multiple editors in a split view or tabs,
    // explicitly calling layout can be useful after container size changes.
    if (this.editorInstances['yaml']) {
      this.editorInstances['yaml'].layout();
    }
    // No layout needed for graph tab as it's not a Monaco editor
  }

  setYamlValue(value) {
    if (this.editorInstances['yaml']) {
      this.editorInstances['yaml'].setValue(value);
    }
  }

  getYamlValue() {
    return this.editorInstances['yaml'] ? this.editorInstances['yaml'].getValue() : '';
  }

  setYamlEditorFileType(fileName) {
    this.yamlEditorFileType = fileName;
    if (this.editorInstances['yaml']) {
      const language = fileName.endsWith('.json') ? 'json' : 'yaml';
      this.monaco.editor.setModelLanguage(this.editorInstances['yaml'].getModel(), language);
    }
  }

  handleTabClick(event) {
    const tabButton = event.target.closest('.tab-button');
    if (!tabButton) return;

    const tabId = tabButton.dataset.tab;
    this.activateTab(tabId, true);
  }

  activateTab(tabId, fromClick = false, data = {}) {
    if (this.activeTab === tabId && !fromClick) return; // Prevent re-activating if already active and not from click

    // Deactivate current active tab
    const currentActiveButton = this.shadowRoot.querySelector(`.tab-button.active`);
    const currentActiveContent = this.shadowRoot.querySelector(`.tab-content.active`);
    if (currentActiveButton) currentActiveButton.classList.remove('active');
    if (currentActiveContent) currentActiveContent.classList.remove('active');

    // Activate new tab
    const newActiveButton = this.shadowRoot.querySelector(`.tab-button[data-tab="${tabId}"]`);
    const newActiveContent = this.shadowRoot.getElementById(`${tabId}-editor-container`) || this.shadowRoot.getElementById(`${tabId}-view-container`);

    if (newActiveButton) newActiveButton.classList.add('active');
    if (newActiveContent) newActiveContent.classList.add('active');

    this.activeTab = tabId;

    // Dispatch event for external listeners (NinoApp.js)
    this.dispatchEvent(new CustomEvent('tab-activated', {
      detail: { tabId, fromClick, fileName: this.yamlEditorFileType, folderName: '' }, // folderName might need to be passed from NinoApp
      bubbles: true,
      composed: true
    }));

    // Handle specific tab content rendering
    switch (tabId) {
        case 'graph':
            this.renderGraphTab();
            break;
        case 'transformation':
            this.renderTransformationTab(data.folderName);
            break;
        case 'stats':
            this.renderStatsTab(data.tableName, data.folderName);
            break;
        default: // Clear content of other special tabs when switching away
            this.$graphViewContainer.innerHTML = '';
            this.$transformationViewContainer.innerHTML = '';
            this.$statsViewContainer.innerHTML = '';
    }

    this.layoutEditors();
  }

  renderGraphTab() {
    // Clear previous graph content
    this.$graphViewContainer.innerHTML = '';

    // Create and append the transformation-plan web component
    const transformationPlan = document.createElement('transformation-plan');
    this.$graphViewContainer.appendChild(transformationPlan);
  }

  renderTransformationTab(folderName) {
    this.$transformationViewContainer.innerHTML = '';
    if (folderName) {
        const ninoTransformation = document.createElement('nino-transformation');
        ninoTransformation.setAttribute('folder-name', folderName);
        this.$transformationViewContainer.appendChild(ninoTransformation);
    }
  }

  renderStatsTab(tableName, folderName) {
    this.$statsViewContainer.innerHTML = '';
    if (tableName && folderName) {
        const ninoStats = document.createElement('nino-stats');
        ninoStats.setAttribute('table-name', tableName);
        ninoStats.setAttribute('folder-name', folderName);
        this.$statsViewContainer.appendChild(ninoStats);
    }

  }

  handleDownloadGraph(event) {
    event.stopPropagation(); // Prevent tab activation
    this.openSvgInNewTab();
  }

  openSvgInNewTab() {
    const activeGraphTab = this.shadowRoot.querySelector('#graph-view-container transformation-plan, #transformation-view-container nino-transformation > playbook-plan');
    if (!activeGraphTab) {
      console.warn('No active graph to open.');
      return;
    }

    const svgContent = activeGraphTab.getSvgContent();
    if (svgContent) {
      const blob = new Blob([svgContent], { type: 'image/svg+xml' });
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      // The URL should be revoked when it's no longer needed, but doing it immediately
      // might prevent the new tab from loading. Browsers handle this differently.
      // A timeout can be a workaround.
      setTimeout(() => URL.revokeObjectURL(url), 100);
    }
  }

  async openFile(example) {
    console.log('NinoEditor: openFile called with example:', example);
    const tabId = `file-tab-${example.id}`;
    let tabButton = this.shadowRoot.querySelector(`.tab-button[data-tab="${tabId}"]`);
    let url =  example["data-url"];


    if (!tabButton) {
      // Create new tab button
      tabButton = document.createElement('button');
      tabButton.classList.add('tab-button');
      tabButton.dataset.tab = tabId;
      tabButton.dataset.exampleId = example.id;
      tabButton.dataset.fileName = example["data-file-name"];
      tabButton.dataset.folderName = example["data-folder-name"];
      tabButton.dataset.url =url;
      tabButton.innerHTML = `<span>${example["data-file-name"]}</span><span class="close-tab">&times;</span>`;

      const fileName = example["data-file-name"];
      let tabHTML = `<span class="save-icon">&#x1f4be;</span>`; // Floppy disk emoji for save

      if (fileName.includes('dataconnector.yaml') || fileName.includes('playbook.yaml')) {
        tabHTML += `<span class="play-icon"></span>`;
      }

      tabHTML += `<span>${fileName}</span><span class="close-tab">&times;</span>`;
      tabButton.innerHTML = tabHTML;

      this.$tabHeader.appendChild(tabButton);

      // Add close functionality
      tabButton.querySelector('.close-tab').addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent tab activation
        this.closeTab(tabId);
      });

      tabButton.querySelector('.play-icon')?.addEventListener('click', (e) => {
        e.stopPropagation();
        this.dispatchEvent(new CustomEvent('file-action', { detail: { action: 'play', example: { name: fileName, description: example["data-folder-name"] } }, bubbles: true, composed: true }));
      });

      // Create editor container for the new file
      const editorContainer = document.createElement('div');
      editorContainer.id = `${tabId}-editor-container`;
      editorContainer.classList.add('tab-content', 'editor-wrapper');
      this.$yamlEditorContainer.parentElement.appendChild(editorContainer);

      // Create Monaco editor for the new file
      const commonOptions = {
        theme: "nino-dark",
        lineNumbers: 'on',
        minimap: { enabled: false },
        automaticLayout: true,
      };
      const language = example.id.endsWith('.json') ? 'json' : 'yaml';
      this.editorInstances[tabId] = this.monaco.editor.create(editorContainer, {
        ...commonOptions,
        language: language,
        model: this.monaco.editor.createModel('', language)
      });

      // Fetch content if URL is provided
      if (url) {
        try {
          const response = await fetch(url);
          const text = await response.text();
          this.editorInstances[tabId].setValue(text);
        } catch (err) {
          this.editorInstances[tabId].setValue(`# Failed to load: ${url}`);
        }
      }
    }

    this.activateTab(tabId);
    this.dispatchEvent(new CustomEvent('file-action', {
      detail: { action: 'open', example: example },
      bubbles: true,
      composed: true
    }));
  }

  closeTab(tabId) {
    const tabButton = this.shadowRoot.querySelector(`.tab-button[data-tab="${tabId}"]`);
    const editorContainer = this.shadowRoot.getElementById(`${tabId}-editor-container`);

    if (tabButton && editorContainer) {
      // Dispose Monaco editor instance
      if (this.editorInstances[tabId]) {
        this.editorInstances[tabId].dispose();
        delete this.editorInstances[tabId];
      }

      // Remove tab button and editor container
      tabButton.remove();
      editorContainer.remove();

      // If the closed tab was active, activate the YAML tab
      if (this.activeTab === tabId) {
        this.activateTab('yaml');
      }

      this.dispatchEvent(new CustomEvent('tab-closed', {
        detail: { tabId: tabId },
        bubbles: true,
        composed: true
      }));
    }
  }
}

customElements.define('nino-editor', NinoEditor);
