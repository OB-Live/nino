// c:\Users\benjamin.bertrand\ws\nino\public\nino\NinoEditor.js

import './NinoStats.js';
import './NinoMonacoEditor.js'; // Import the new web component // Import the new web component
import { staticExamples, HELPER_LOAD_METADATA } from './NinoConstants.js'; // Import staticExamples and HELPER_LOAD_METADATA// Import staticExamples and HELPER_LOAD_METADATA
class NinoEditor extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.jsyaml = null;
    this.editorInstances = {}; // To hold Monaco editor instances
    this.activeTab = 'yaml';
    this.yamlEditorFileType = 'yaml'; // Default file type for YAML editor // Default file type for YAML editor

    this._ninoExecution = null; // Reference to NinoExecution component
    const template = document.createElement('template');
    template.innerHTML = `
      <link rel="stylesheet" href="NinoStyle.css">
      <div id="editor-panel" class="panel" >
        <div class="tab-header">
           <button class="tab-button" data-tab="graph">
            <span id="download-graph-btn" class="download-btn">⤓</span>Transformation Plan 
          </button>
          <button class="tab-button" data-tab="execution">Execution Plan</button>
          <button class="tab-button" data-tab="stats">Statistics</button>
          <button class="tab-button active" data-tab="yaml">Examples</button>
       
        </div> 
        <div id="yaml-editor-container" class="tab-content active editor-wrapper"></div>
        <div id="graph-view-container" class="tab-content editor-wrapper"></div>
        <div id="transformation-view-container" class="tab-content editor-wrapper"></div>
        <div id="stats-view-container" class="tab-content editor-wrapper"></div>
      </div>
    `;
    this.shadowRoot.appendChild(template.content.cloneNode(true));
    this.tabHeader = this.shadowRoot.querySelector('.tab-header');
    this.yamlEditorContainer = this.shadowRoot.getElementById('yaml-editor-container');
    this.graphContainer = this.shadowRoot.getElementById('graph-view-container');
    this.transformationContainer = this.shadowRoot.getElementById('transformation-view-container');
    this.statsViewContainer = this.shadowRoot.getElementById('stats-view-container');
    this.downloadGraphBtn = this.shadowRoot.getElementById('download-graph-btn');
    this.tabHeader.addEventListener('click', this.handleTabClick.bind(this));
    this.downloadGraphBtn.addEventListener('click', this.handleDownloadGraph.bind(this));
  }

  connectedCallback() {
    // NinoMonacoEditor components will load Monaco themselves.
    // We just need to create them.
    this.createEditors();
    // Listen for 'monaco-editor-ready' events from child components
    this.shadowRoot.addEventListener('monaco-editor-ready', this.handleChildEditorReady.bind(this));
    this.readyEditorCount = 0;
  }

  setNinoExecution(ninoExecution) {
    this._ninoExecution = ninoExecution;
  }

  setJsyaml(jsyaml) {
    this.jsyaml = jsyaml;
  }

  handleChildEditorReady() {
    this.readyEditorCount++;
    // Assuming 'yaml' is the first editor, dispatch monaco-ready when it's ready
    // More robust logic might involve tracking all expected editors if there were more initial ones.
    if (this.readyEditorCount === 1) { // Only dispatch once for the main editor
      this.dispatchEvent(new CustomEvent('monaco-ready', { bubbles: true, composed: true }));
    }
  }

  async createEditors() {
    // Create the main YAML editor using the new web component
    const yamlEditor = document.createElement('nino-monaco-editor');
    yamlEditor.setAttribute('language', 'yaml');
    yamlEditor.setAttribute('value', staticExamples[0].examples[0].yaml); // Set initial value to the "Random Name" example
    this.yamlEditorContainer.appendChild(yamlEditor);
    this.editorInstances['yaml'] = yamlEditor;

    // The graph, transformation, and stats containers will not host Monaco editors directly.
    // They will host other web components or content.
  }

  // Helper to get the actual Monaco editor instance from the web component
  _getMonacoEditorInstance(id) {
    const component = this.editorInstances[id];
    if (component && component.editorInstance) {
      return component.editorInstance;
    }
    return null;
  }

  layoutEditors() {
    // Monaco editors handle their own layout if automaticLayout is true
    // However, if there are multiple editors in a split view or tabs,
    // explicitly calling layout can be useful after container size changes.
    if (this.editorInstances['yaml']) {
      this.editorInstances['yaml'].layout(); // Call layout on the web component
    }
  }

  setYamlValue(value) {
    if (this.editorInstances['yaml']) {
      this.editorInstances['yaml'].setValue(value); // Call setValue on the web component
    }
  }

  getYamlValue() {
    return this.editorInstances['yaml'] ? this.editorInstances['yaml'].getValue() : ''; // Call getValue on the web component
  }

  setYamlEditorFileType(fileName) {
    this.yamlEditorFileType = fileName;
    if (this.editorInstances['yaml']) {
      const language = fileName.endsWith('.json') ? 'json' : 'yaml'; // Determine language based on file extension
      this.editorInstances['yaml'].setLanguage(language); // Call setLanguage on the web component
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

    const newActiveButton = this.shadowRoot.querySelector(`.tab-button[data-tab="${tabId}"]`);
    const fileName = newActiveButton ? newActiveButton.dataset.fileName : this.yamlEditorFileType;
    const folderName = newActiveButton ? newActiveButton.dataset.folderName : '';

    const currentActiveButton = this.shadowRoot.querySelector(`.tab-button.active`);
    const currentActiveContent = this.shadowRoot.querySelector(`.tab-content.active`);
    if (currentActiveButton) currentActiveButton.classList.remove('active');
    if (currentActiveContent) currentActiveContent.classList.remove('active');
    // Activate new tab
    const newActiveContent = this.shadowRoot.getElementById(`${tabId}-editor-container`) || this.shadowRoot.getElementById(`${tabId}-view-container`);

    if (newActiveButton) newActiveButton.classList.add('active');
    if (newActiveContent) newActiveContent.classList.add('active');

    this.activeTab = tabId;

    // Dispatch event for external listeners (NinoApp.js)
    this.dispatchEvent(new CustomEvent('tab-activated', { // Keep for external listeners that might still rely on it
      detail: { tabId, fromClick, fileName, folderName },
      bubbles: true, // Keep for external listeners that might still relyon it
      composed: true
    }));

    // Handle specific tab content rendering
    switch (tabId) {
      case 'graph':
        this.renderGraphTab(data);
        break;
      case 'execution':
        this.renderExecutionPlanTab(data.folderName);
        break;
      case 'stats':
        this.renderStatsTab(data.tableName, data.folderName);
        break;
      case 'yaml':
        // For the main YAML tab, ensure the editor is visible and potentially update its content
        // This is handled by openFile or initial setup, so no specific action here unless needed.
        break;
      default:
        console.warn(`Unknown tabId: ${tabId}`);
    }
    this._handleTabActivated(fileName, folderName, tabId, fromClick);

    this.layoutEditors();
  }


  _handleTabActivated(fileName, folderName, tabId, fromClick) {
    if (!this._ninoExecution) return;

    if (tabId === 'graph') {
      this._ninoExecution.setOutputEditorValue('');
    } else {
      this._ninoExecution.restoreInputOutputEditors();
    }

    if (fileName && fileName.includes('dataconnector.yaml')) {
      this._ninoExecution.setInputEditorLanguage('shell');
      this._ninoExecution.setInputEditorValue(HELPER_LOAD_METADATA(folderName));
    } else if (fileName && fileName.includes('playbook.yaml')) {
      this._ninoExecution.setInputEditorLanguage('shell');
      this._ninoExecution.setInputEditorValue(`ansible-playbook ${folderName}/${fileName} --connection=local`);
    } else if (tabId === 'yaml') {
      this._ninoExecution.setInputEditorLanguage('json');
      if (!fromClick) {
        const activeExampleId = localStorage.getItem('nino-active-example-id');
        const example = staticExamples.flatMap(c => c.examples).find(e => e.id === activeExampleId);
        this._ninoExecution.setInputEditorValue(example?.input || '{}');
      }
    }

  }
  renderGraphTab(data) {
    // Clear previous graph content
    this.graphContainer.innerHTML = "";
    const url = data
    // Render the generic nino-graphviz component
    const ninoGraphviz = document.createElement("nino-graphviz");
    ninoGraphviz.setAttribute("url", url);
    this.graphContainer.appendChild(ninoGraphviz);
  }

  renderExecutionPlanTab(folderName) {

    if (folderName) {
      const execPlan = document.createElement('nino-graphviz');
      // The -nametly used byoame}`);
      this.transformationViewContainer.innerHTML = '';
      this.transformationViewContainer.appendChild(execPlan);
    }
  }

  renderStatsTab(tableName, folderName) {
    this.statsViewContainerr.innerHTML = '';
    if (tableName) {
      const ninoStats = document.createElement('nino-stats');
      ninoStats.setAttribute('table-name', tableName);
      ninoStats.setAttribute('folder-name', folderName);
      this.statsViewContainerr.appendChild(ninoStats);
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
    let url = example["data-url"];


    if (!tabButton) {
      // Create new tab button
      tabButton = document.createElement('button');
      tabButton.classList.add('tab-button');
      tabButton.dataset.tab = tabId;
      tabButton.dataset.exampleId = example.id;
      tabButton.dataset.fileName = example["data-file-name"];
      tabButton.dataset.folderName = example["data-folder-name"];
      tabButton.dataset.url = url;
      tabButton.innerHTML = `<span>${example["data-file-name"]}</span><span class="close-tab">&times;</span>`;

      const fileName = example["data-file-name"];
      let tabHTML = `<span class="save-icon">&#x1f4be;</span>`; // Floppy disk emoji for save

      if (fileName.includes('dataconnector.yaml') || fileName.includes('playbook.yaml')) {
        tabHTML += `<span class="play-icon"></span>`;
      }

      tabHTML += `<span>${fileName}</span><span class="close-tab">&times;</span>`;
      tabButton.innerHTML = tabHTML;

      this.tabHeader.appendChild(tabButton);

      // Add close functionality
      tabButton.querySelector('.save-icon')?.addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent tab activation
        this.dispatchEvent(new CustomEvent('file-action', { detail: { action: 'save', example: { id: example.id, name: fileName, folderName: example["data-folder-name"], url: example.url } }, bubbles: true, composed: true }));
      });

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
      this.yamlEditorContainer.parentElement.appendChild(editorContainer);

      // Create Monaco editor for the new file using the web component
      const language = example["data-file-name"].endsWith('.json') ? 'json' : 'yaml';
      const newEditorComponent = document.createElement('nino-monaco-editor');
      newEditorComponent.setAttribute('language', language);
      newEditorComponent.setAttribute('value', `# Loading...`);
      editorContainer.appendChild(newEditorComponent);
      this.editorInstances[tabId] = newEditorComponent;

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
        // The NinoMonacoEditor component handles its own disposal in disconnectedCallback
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
