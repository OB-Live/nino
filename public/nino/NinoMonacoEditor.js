/**
 * Reusable component that encapsulates the Monaco Editor. 
 * It dynamically loads the Monaco Editor library and creates an editor instance within its shadow DOM.
 * The component supports setting the language and value via attributes, and it dispatches a custom event when the editor is ready.
 */
class NinoMonacoEditor extends HTMLElement {
    static get observedAttributes() {
        return ['language', 'value', 'id'];
    }

    constructor() {
        super();
        this.shadow = this.attachShadow({ mode: 'closed' });
        this.monaco = null;
        this.editorInstance = null;

        const template = document.createElement('template');
        template.innerHTML = ` 
        <style>

            ::slotted(*) {
                all: unset;
            } 

            :host {
                all: initial;               
                box-sizing: border-box;
                display: block;
                
                height: 100%;
                margin: 0;
                padding: 0; 
                overflow: hidden;
            } 
            #editor-container { 
                height: 100%;
            }
            
        </style>
        <link rel="stylesheet" data-name="vs/editor/editor.main" href="/lib/monaco-editor-0.55.1/package/min/vs/editor/editor.main.css" />

        <div id="editor-container"></div>
        `;
        this.shadow.appendChild(template.content.cloneNode(true));
        this.editorContainer = this.shadow.getElementById('editor-container');
    }

    connectedCallback() {
        this._loadMonacoAndCreateEditor();
    }

    _loadMonacoAndCreateEditor() {
        // Ensure require.js is available globally.
        // If not, load it dynamically.
        if (!window.require) {
            const script = document.createElement('script');
            script.src = '/lib/monaco-editor-0.55.1/package/min/vs/loader.js';
            script.onload = () => {
                this._initializeMonaco();
            };
            script.onerror = (error) => {
                console.error("Failed to load Monaco loader:", error);
            };
            this.shadow.appendChild(script); // Append to head for global availability
        } else {
            this._initializeMonaco();
        }
    }

    _initializeMonaco() {
        if (this.monaco) { // Already initialized
            this.createEditor();
            return;
        }
        // Configure require.js for Monaco. This ensures the path is set for this component.
        window.require.config({ paths: { 'vs': '/lib/monaco-editor-0.55.1/package/min/vs' } });

        window.require(['vs/editor/editor.main'], (monaco) => {
            this.monaco = monaco;
            this.createEditor();
        });
    }

    attributeChangedCallback(name, oldValue, newValue) {
        if (!this.editorInstance) return;

        if (name === 'language' && oldValue !== newValue) {
            this.setLanguage(newValue);
        } else if (name === 'value' && oldValue !== newValue) {
            this.setValue(newValue);
        }
    }

    createEditor() {
        if (!this.monaco || this.editorInstance) return;

        const language = this.getAttribute('language') || 'plaintext';
        const value = this.getAttribute('value') || '';

        this.editorInstance = this.monaco.editor.create(this.editorContainer, {
            value: value,
            language: language,
            lineNumbers: "on",
            wordWrap: 'on',
            theme: "vs-dark",
            minimap: { enabled: true },
            automaticLayout: true,
            mouseWheelZoom: true,
            // No theme specified to ignore all theming, as requested.
        });

        this.dispatchEvent(new CustomEvent('monaco-editor-ready', { bubbles: true, composed: true }));
    }

    setValue(value) {
        if (this.editorInstance) {
            this.editorInstance.setValue(value);
        }
    }

    getValue() {
        return this.editorInstance ? this.editorInstance.getValue() : '';
    }

    setLanguage(language) {
        if (this.editorInstance && this.monaco) {
            this.monaco.editor.setModelLanguage(this.editorInstance.getModel(), language);
        }
    }

    layout() {
        if (this.editorInstance) {
            this.editorInstance.layout();
        }
    }

    disconnectedCallback() {
        if (this.editorInstance) {
            this.editorInstance.dispose();
            this.editorInstance = null;
        }
    }
}

customElements.define('nino-monaco-editor', NinoMonacoEditor);