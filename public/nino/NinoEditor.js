// c:\Users\benjamin.bertrand\ws\nino\public\nino\NinoEditor.js

import './LinoAnalyse.js';
import './NinoMonacoEditor.js';
import { pimoExamples, NĭnŏAPI } from './NinoConstants.js';
import { Nĭnŏ, getFileType } from './NinoApp.js';
class NinoEditor extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.jsyaml = null;
    this.editorInstances = {};
    this.activeTab = 'example';
    this.yamlEditorFileType = 'yaml'; // Default file type for YAML editor // Default file type for YAML editor

    this._ninoExecution = null; // Reference to NinoExecution component
    const template = document.createElement('template');
    template.innerHTML = `
      <link rel="stylesheet" href="NinoStyle.css">
      <div id="editor-panel" class="panel">
        <div class="tab-header">
          <button class="tab-button" data-tab="graph">
          <span id="download-graph-btn" class="download-btn">⤓</span>Transformation Plan 
          </button>
          <button class="tab-button" data-tab="execution">Execution Plan</button>
          <button class="tab-button" data-tab="stats">Analyse</button>
          <button class="tab-button active" data-tab="example">Examples</button>
        </div> 

        <nino-monaco-editor 
          language="yaml"
          id="example-editor-container"
          value="${pimoExamples[0].examples[0].yaml}"  
          class="tab-content editor-wrapper"
        ></nino-monaco-editor> 

        <nino-graphviz 
          id="graph-view-container" 
          url="${NĭnŏAPI.getSchema('dot')}" 
          class="tab-content editor-wrapper"
        ></nino-graphviz> 
        
        <nino-graphviz 
          id="execution-view-container" 
          url="${NĭnŏAPI.getPlaybook('petstore')}" 
          class="tab-content editor-wrapper"
        ></nino-graphviz>
        
        <lino-analyse 
          id="stats-view-container" 
          folder-name="petstore" 
          table-name="pets" 
          class="tab-content editor-wrapper"
        ></lino-analyse>

      </div>
    `;
    this.shadowRoot.appendChild(template.content.cloneNode(true));
    this.tabHeader = this.shadowRoot.querySelector('.tab-header');
    this.panel = this.shadowRoot.getElementById('editor-panel');
    this.exampleEditor = this.shadowRoot.getElementById('example-editor-container');
    this.graphTransformation = this.shadowRoot.getElementById('graph-view-container');
    this.graphExecution = this.shadowRoot.getElementById('execution-view-container');
    this.statsViewContainer = this.shadowRoot.getElementById('stats-view-container');
     this.downloadGraphBtn = this.shadowRoot.getElementById('download-graph-btn');
    this.tabHeader.addEventListener('click', this.handleTabClick.bind(this));
    this.downloadGraphBtn.addEventListener('click', this.handleDownloadGraph.bind(this));


    this.editorInstances = {
      example: this.exampleEditor,
      graph: this.graphTransformation,
      execution: this.graphExecution,
      stats: this.statsViewContainer
    }

  }

  connectedCallback() {
    // NinoMonacoEditor components will load Monaco themselves. 
  }
 

  layoutEditors() {
    if (this.editorInstances['example']) {
      this.editorInstances['example'].layout();
    }
  }

  setYamlValue(value) {
    if (this.editorInstances['example']) {
      this.editorInstances['example'].setValue(value);
    }
  }

  getYamlValue() {
    return this.editorInstances['example'] ? this.editorInstances['example'].getValue() : '';
  }

  setYamlEditorFileType(fileName) {
    this.yamlEditorFileType = fileName;
    if (this.editorInstances['example']) {
      const language = fileName.endsWith('.json') ? 'json' : 'yaml';
      this.editorInstances['example'].setLanguage(language);
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
    const newActiveContent = this.shadowRoot.getElementById(`${tabId}-editor-container`)
      || this.shadowRoot.getElementById(`${tabId}-view-container`)
      || this.exampleEditor;

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
        this.updateGraphTab(data);
        break;
      case 'execution':
        this.renderExecutionPlanTab(data.folderName);
        break;
      case 'stats':
        this.renderStatsTab(data.tableName, data.folderName);
        break;
      case 'example':
        // For the main YAML tab, ensure the editor is visible and potentially update its content
        // This is handled by openFile or initial setup, so no specific action here unless needed.
        break;
      default:
        console.warn(`Unknown tabId: ${tabId}`);
    } 

    this.layoutEditors();
  }
 
  updateGraphTab(data) {
    this.graphTransformation.setAttribute("url", data.url || '/api/schema.dot');
  }

  renderExecutionPlanTab(folderName) {

    if (folderName) {
      this.graphExecution.setAttribute('url', `/api/playbook/${folderName}`);

      this.graphExecution.innerHTML += `
      <p><span class="action-buttons"> 
        <button class="btn"><i class="iPlaybook mediumIcon"></i> Create Playbook</button> 
        <button class="btn"><i class="iScript mediumIcon"></i> Create Script</button> 
        <button class="btn"><i class="iPlaybook mediumIcon"></i> Run it</button> 
      </span></p>`;
      // this.graphExecution.appendChild(execPlan);
    }
  }

  renderStatsTab(tableName, folderName) {
    if (tableName) { 
      this.statsViewContainer.setAttribute('table-name', tableName);
      this.statsViewContainer.setAttribute('folder-name', folderName);
    }

  }

  handleDownloadGraph(event) {
    event.stopPropagation(); // Prevent tab activation
    // this.openSvgInNewTab();
    window.open(NĭnŏAPI.getSchema('dot', 'petstore'), '_blank');
  }

  openSvgInNewTab() {
    const activeGraphTab = this.shadowRoot.querySelector('#graph-view-container transformation-plan, #execution-view-container nino-transformation > playbook-plan');
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

  async openFile(event) {
    const example = event.detail.node.li_attr;
    const fileName = example["data-file-name"];
    const folderName = example["data-folder-name"];
    const type = getFileType(fileName); // This will log the file type for debugging
    const language = type.language || 'plaintext'; // Default to plaintext if type is not recognized


    console.log('NinoEditor: openFile called with example:', fileName, folderName, example);

    const tabId = `file-tab-${example.id}`;
    let tabButton = this.shadowRoot.querySelector(`.tab-button[data-tab="${tabId}"]`);
    let url = example["data-url"];

    if (!tabButton) {
      tabButton = this._createTabButton(tabId, fileName, folderName, url, example.id);
      this._createEditorContainer(tabId, language, url);
    }

    this.activateTab(tabId);
    this.dispatchEvent(new CustomEvent('file-action', {
      detail: { action: 'open', example: example },
      bubbles: true,
      composed: true
    }));
  }

  _createTabButton(tabId, fileName, folderName, url, exampleId) {
    const tabButton = document.createElement('button');
    tabButton.classList.add('tab-button');
    tabButton.dataset.tab = tabId;
    tabButton.dataset.exampleId = exampleId;
    tabButton.dataset.fileName = fileName;
    tabButton.dataset.folderName = folderName;
    tabButton.dataset.url = url;

    let tabHTML = `<span class="save-icon">&#x1f4be;</span>`; // Floppy disk emoji for save
    if (fileName.includes('dataconnector.yaml') || fileName.includes('playbook.yaml')) {
      tabHTML += `<span class="play-icon"></span>`;
    }
    tabHTML += `<span>${fileName}</span><span class="close-tab">&times;</span>`;
    tabButton.innerHTML = tabHTML;

    this.tabHeader.appendChild(tabButton);

    tabButton.querySelector('.save-icon')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.dispatchEvent(new CustomEvent('file-action', { detail: { action: 'save', example: { id: exampleId, name: fileName, folderName: folderName, url: url } }, bubbles: true, composed: true }));
    });

    tabButton.querySelector('.close-tab').addEventListener('click', (e) => {
      e.stopPropagation();
      this.closeTab(tabId);
    });

    tabButton.querySelector('.play-icon')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.dispatchEvent(new CustomEvent('file-action', { detail: { action: 'play', example: { name: fileName, description: folderName } }, bubbles: true, composed: true }));
    });

    return tabButton;
  }

  async _createEditorContainer(tabId, language, url) {
    const editorContainer = document.createElement('nino-monaco-editor');
    editorContainer.id = `${tabId}-editor-container`;
    editorContainer.classList.add('tab-content', 'editor-wrapper');
    editorContainer.setAttribute('language', language);
    editorContainer.setAttribute('value', `# Loading...`);
    this.panel.appendChild(editorContainer);
    this.editorInstances[tabId] = editorContainer;

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
        this.activateTab('example');
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
