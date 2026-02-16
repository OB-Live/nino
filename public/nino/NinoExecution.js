// No longer importing makeResizable from NinoApp.js
import { NĭnŏAPI } from './NinoConstants.js'; 
class NinoExecution extends HTMLElement {
    constructor() {
        super();
        this.monaco = null;
        this._activeFile = { fileName: null, folderName: null };

        this.attachShadow({ mode: 'open' });

        const template = document.createElement('template');
        template.innerHTML = `
            <link rel="stylesheet" href="NinoStyle.css">
            <style>
                .refresh-icon {
                    font-size: 1.2rem;
                    line-height: 1;
                    padding: 0;
                    margin-right: 6px;
                    display: inline-flex;
                    cursor: pointer;
                }

                .refresh-icon:hover {
                    opacity: 0.8;
                }

                .tab-button:disabled .refresh-icon {
                    cursor: not-allowed;
                    opacity: 0.5;
                }
                #execution-panel{
                    
                }
            </style>
            <div id="execution-panel" class="panel"> 
                <div class="editor-header">
                    <span>Input</span>
                    <button id="fetch-row-btn" class="tab-button" style="display: none;">
                        <span class="refresh-icon">↻</span> fetch 1 row 
                    </button>
                </div>
                <nino-monaco-editor
                    id="input-editor"
                    language="javascript"
                    value="console.log('Hello, isolated world!');">
                </nino-monaco-editor>  

                <div class="editor-header">
                    <button id="execute-btn" class="execute-btn">
                        <i class="iPlay mediumIcon"></i>
                        <span>Output</span>
                    </button>
                    
                </div>
                <nino-monaco-editor
                    id="output-editor"
                    language="javascript"
                    value="console.log('Hello, isolated world!');">
                </nino-monaco-editor>
                
            </div>
        `;

        this.shadowRoot.appendChild(template.content.cloneNode(true));

        this.inputEditor = this.shadowRoot.getElementById('input-editor');
        this.outputEditor = this.shadowRoot.getElementById('output-editor');
        this.executeBtn = this.shadowRoot.getElementById('execute-btn');
        this.fetchRowBtn = this.shadowRoot.getElementById('fetch-row-btn');

        this.executeBtn.addEventListener('click', () => {
            this.dispatchEvent(new CustomEvent('execute-nino', {
                // detail: {
                //     yaml: this.editorInstances.yaml ? this.editorInstances.yaml.getValue() : '', // Assuming yaml editor is external or passed
                //     json: this.inputEditor ? this.inputEditor.getValue() : '',
                // },
                bubbles: true,
                composed: true
            }));
        });

        this.fetchRowBtn.addEventListener('click', this.handleFetchRow.bind(this));
    }

    /**
     * Sets the active file information and updates the UI accordingly.
     * @param {{fileName: string, folderName: string}} fileInfo - The active file information.
     */
    set activeFile(fileInfo) {
        this._activeFile = fileInfo;
        this.updateFetchRowButton();
    }

    /**
     * Shows or hides the 'fetch 1 row' button based on the active file type.
     */
    updateFetchRowButton() {
        const { fileName } = this._activeFile;
        if (fileName && fileName.includes('masking.yaml')) {
            this.fetchRowBtn.style.display = 'inline-flex';
        } else {
            this.fetchRowBtn.style.display = 'none';
        }
    }


    connectedCallback() { 
        this.layoutEditors();
     }

    layoutEditors() {
        if (this.inputEditor) {
            this.inputEditor.layout();
        }
        if (this.outputEditor) {
            this.outputEditor.layout();
        }
    }
    setInputEditorLanguage(language) {
        if (this.inputEditor) {
            this.inputEditor.setAttribute('language', language);
        }
    }
    setInputEditorValue(value) {
        if (this.inputEditor) {
            this.inputEditor.setAttribute('value', value);
        }
    }
    getInputEditorValue() {
        return this.inputEditor ? this.inputEditor.getAttribute('value') : '';
    }
    setOutputEditorValue(value) {
        if (this.outputEditor) {
            this.outputEditor.setAttribute('value',value);
        }
    }
    getOutputEditorValue() {
        return this.outputEditor ? this.outputEditor.getAttribute('value') : '';
    } 

    /**
     * Handles the click event for the 'fetch 1 row' button.
     * This function is only active for masking files. It calls the backend
     * to get a single row of example data and populates the input editor with it.
     */
    async handleFetchRow() {
        const { fileName, folderName } = this._activeFile;

        if (!fileName || !folderName) {
            console.error("Missing file name or folder name for fetching row.");
            return;
        }

        this.fetchRowBtn.disabled = true;
        this.fetchRowBtn.querySelector('.refresh-icon').textContent = '...';

        try {
            const response = await fetch(NĭnŏAPI.linoFetch(folderName, fileName));

            if (!response.ok) {
                const errorText = await response.text();
                this.setOutputEditorValue(`Error fetching example row: ${errorText}`);
            } else {
                const result = await response.text();
                this.setInputEditorValue(result);
            }
        } catch (error) {
            this.setOutputEditorValue(`API request failed during fetch: ${error.message}`);
        } finally {
            this.fetchRowBtn.disabled = false;
            this.fetchRowBtn.querySelector('.refresh-icon').textContent = '↻';
        }
    }
}
customElements.define('nino-execution', NinoExecution);
