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

        this.readyEditorCount = 0;
    }
    /**
     * TODO: comment and document 
     */
    connectedCallback() {
        this.createEditors();
    }
    /**
     * TODO: comment and document 
     */
    handleChildEditorReady() {
        this.readyEditorCount++;
        if (this.readyEditorCount === NinoExecution.EDITOR_COUNT) {
            // All child Monaco editors are ready, dispatch our own ready event
            this.dispatchEvent(new CustomEvent('monaco-ready', { bubbles: true, composed: true }));
            this.makeVerticalResizable(this.shadowRoot.getElementById("resize-handle-v"), this.shadowRoot.getElementById("input-panel"), this.shadowRoot.getElementById("output-panel"));
        }
    }

    /**
     * TODO: comment and document 
     */
    createEditors() {
        const inputEditor = document.createElement('nino-monaco-editor');
        inputEditor.setAttribute('language', 'json');
        inputEditor.setAttribute('value', '');
        inputEditor.setAttribute('id', 'input');
        this.$inputEditorContainer.appendChild(inputEditor);
        this.editorInstances["input"] = inputEditor;
 
        const outputEditor = document.createElement('nino-monaco-editor');
        outputEditor.setAttribute('language', 'json');
        outputEditor.setAttribute('value', '');
        inputEditor.setAttribute('id', 'output');
        outputEditor.setAttribute('read-only', 'true'); // Set read-only attribute
        this.$outputEditorContainer.appendChild(outputEditor);
        this.editorInstances["output"] = outputEditor;
        outputEditor.addEventListener('monaco-editor-ready', this.handleChildEditorReady.bind(this));
    }
    layoutEditors() {
        if (this.editorInstances["input"]) {
            this.editorInstances["input"].layout();
        }
        if (this.editorInstances["output"]) {
            this.editorInstances["output"].layout();
        }
    }
    setInputEditorLanguage(language) {
        if (this.editorInstances["input"]) {
            this.editorInstances["input"].setLanguage(language);
        }
    }
    setInputEditorValue(value) {
        if (this.editorInstances["input"]) {
            this.editorInstances["input"].setValue(value);
        }
    }
    getInputEditorValue() {
        return this.editorInstances["input"] ? this.editorInstances["input"].getValue() : '';
    }
    setOutputEditorValue(value) {
        if (this.editorInstances["output"]) {
            this.editorInstances["output"].setValue(value);
        }
    }
    getOutputEditorValue() {
        return this.editorInstances["output"] ? this.editorInstances["output"].getValue() : '';
    }
    activateOutputTab() {
        // In NinoExecution, the output is always visible, so this might just ensure focus or visibility.
        // If the output editor is hidden by other tabs in NinoEditor, NinoEditor should handle activating the correct tab.
    }
    // The output-viewer-container is now exclusively for the Monaco output editor.
    clearOutputViewerContainer() { this.$outputEditorContainer.innerHTML = ''; }
    restoreInputOutputEditors() {
        // With web components, they manage their own DOM.
        // We just need to ensure they are laid out correctly if their container size changes.
        // The web components should already be in the DOM if they were created.
        if (!this.$inputEditorContainer.querySelector('nino-monaco-editor')) {
            this.createEditors(); // Recreate if somehow removed
        }
        if (!this.$outputEditorContainer.querySelector('nino-monaco-editor')) {
            this.createEditors(); // Recreate if somehow removed
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
