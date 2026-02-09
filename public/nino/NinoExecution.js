// No longer importing makeResizable from NinoApp.js

class NinoExecution extends HTMLElement {
    constructor() {
        super();
        this.editorInstances = {};
        this.monaco = null;

        this.attachShadow({ mode: 'open' });

        const template = document.createElement('template');
        template.innerHTML = `
            <link rel="stylesheet" href="NinoStyle.css">
            <div id="execution-panel" class="panel">
                <div id="input-panel" class="sub-panel">
                    <div class="editor-header">Input</div>
                    <div id="input-editor-container" class="editor-wrapper"></div>
                </div>
                <div id="resize-handle-v" class="resize-handle-v"></div>
                <div id="output-panel" class="sub-panel">
                    <div class="editor-header">
                        <button id="execute-btn" class="execute-btn"></button>
                        <span>Output</span>
                    </div>
                    <div id="output-viewer-container" class="editor-wrapper"></div>
                </div>
            </div>
        `;

        this.shadowRoot.appendChild(template.content.cloneNode(true));

        this.$inputEditorContainer = this.shadowRoot.getElementById('input-editor-container');
        this.$outputEditorContainer = this.shadowRoot.getElementById('output-viewer-container');
        this.$executeBtn = this.shadowRoot.getElementById('execute-btn');

        this.$executeBtn.addEventListener('click', () => {
            this.dispatchEvent(new CustomEvent('execute-nino', {
                detail: {
                    yaml: this.editorInstances.yaml ? this.editorInstances.yaml.getValue() : '', // Assuming yaml editor is external or passed
                    json: this.editorInstances.input ? this.editorInstances.input.getValue() : ''
                },
                bubbles: true,
                composed: true
            }));
        });
    }
    /**
     * TODO: comment and document 
     */
    connectedCallback() {
        // Monaco Editor Initialization - embedded within the component
        require.config({ paths: { vs: "/lib/monaco-editor-0.55.1/package/min/vs" } });

        require(["vs/editor/editor.main"], async (monaco) => {
            this._setMonacoInstance(monaco);
            // Signal to NinoApp.js that Monaco is ready for this component
            this.dispatchEvent(new CustomEvent('monaco-ready', { bubbles: true, composed: true }));
        });
    }
    /**
     * TODO: comment and document 
     */
    _setMonacoInstance(monaco) {
        this.monaco = monaco;
        this.createEditors();
        this.makeVerticalResizable(this.shadowRoot.getElementById("resize-handle-v"), this.shadowRoot.getElementById("input-panel"), this.shadowRoot.getElementById("output-panel"));
    }

    /**
     * TODO: comment and document 
     */
    createEditors() {
        this.monaco.editor.defineTheme('nino-dark', {
            base: 'vs-dark',
            inherit: true,
            rules: [
                { token: 'comment', foreground: '608b4e' },
                { token: 'string', foreground: 'ce9178' },
                { token: 'number', foreground: 'b5cea8' },
                { token: 'keyword', foreground: '569cd6' },
            ],
            colors: {
                'editor.background': '#2f2b0e',
                'editor.foreground': '#020202ff',
                'editorCursor.foreground': '#f0f2f0',
                'editor.lineHighlightBackground': '#333833',
                'editor.selectionBackground': '#264f78',
                'editorWidget.background': '#232623',
                'editorWidget.border': '#3b4239',
                'dropdown.background': '#232623',
                'dropdown.border': '#3b4239',
            }
        });

        const commonOptions = {
            theme: "nino-dark",
            minimap: { enabled: true },
            lineNumbers: x=>x,
            automaticLayout: true, // Ensure editors resize automatically
        };
        this.editorInstances["input"] = this.monaco.editor.create(this.$inputEditorContainer, { 
            ...commonOptions, language: "json" 
        });
        this.editorInstances["output"] = this.monaco.editor.create(this.$outputEditorContainer, { 
            ...commonOptions, language: "json", readOnly: true 
        });
    }
    layoutEditors() { Object.values(this.editorInstances).forEach(editor => editor && editor.layout()); }
    setInputEditorLanguage(language) { this.monaco.editor.setModelLanguage(this.editorInstances.input.getModel(), language); }
    setInputEditorValue(value) { this.editorInstances.input.setValue(value); }
    getInputEditorValue() { return this.editorInstances.input.getValue(); }
    setOutputEditorValue(value) { this.editorInstances.output.setValue(value); }
    getOutputEditorValue() { return this.editorInstances.output.getValue(); }
    activateOutputTab() {
        // In NinoExecution, the output is always visible, so this might just ensure focus or visibility.
        // If the output editor is hidden by other tabs in NinoEditor, NinoEditor should handle activating the correct tab.
    }
    // The output-viewer-container is now exclusively for the Monaco output editor.
    clearOutputViewerContainer() { this.$outputEditorContainer.innerHTML = ''; }
    restoreInputOutputEditors() {
        // Check if the editor DOM node is already there. If not, it means it was replaced.
        if (this.editorInstances.input && !this.$inputEditorContainer.contains(this.editorInstances.input.getDomNode())) {
            this.$inputEditorContainer.innerHTML = '';
            this.$inputEditorContainer.appendChild(this.editorInstances.input.getDomNode());
        }
        if (this.editorInstances.output && !this.$outputEditorContainer.contains(this.editorInstances.output.getDomNode())) {
            this.$outputEditorContainer.innerHTML = '';
            this.$outputEditorContainer.appendChild(this.editorInstances.output.getDomNode());
        }
        this.editorInstances.input.layout();
        this.editorInstances.output.layout();
    }

    /**
     * Makes an element resizable by dragging a handle (vertical split).
     * This function is specific to the internal vertical split of NinoExecution.
     * @param {HTMLElement} handle - The handle element to drag.
     * @param {HTMLElement} topPanel - The element to resize above the handle.
     * @param {HTMLElement} bottomPanel - The element to resize below the handle.
     */
    makeVerticalResizable(handle, topPanel, bottomPanel) {
        let isResizing = false;
        $(handle).on("mousedown", () => {
            isResizing = true;
            $(handle).addClass("active");
        });
        $(document).on("mouseup", () => {
            isResizing = false;
            $(handle).removeClass("active");
        });
        $(document).on("mousemove", (e) => {
            if (!isResizing) return;

            const $container = $(handle).parent(); // The container of the panels
            const rect = $container[0].getBoundingClientRect();
            const newTopHeight = e.clientY - rect.top;
            $(topPanel).height(newTopHeight);
            $(bottomPanel).height(rect.height - newTopHeight - $(handle).height());
            this.layoutEditors();
        });
    }
}
customElements.define('nino-execution', NinoExecution);
