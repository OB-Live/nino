import { pimoExamples, NĭnŏAPI, fileTypes } from './NinoConstants.js';
import './NinoEditor.js';
import './NinoWorkspace.js';
import './NinoExecution.js';
import './NinoGraphviz.js';

const sidebarToggle = document.querySelector("#sidebar-toggle");
const ninoEditor = document.querySelector('nino-editor');
const ninoExecution = document.querySelector('nino-execution');
const ninoWorkspace = document.querySelector('nino-workspace');

window.openTableStat = openTableStat;
window.openExecutionGraph = openExecutionGraph;
$(sidebarToggle).on("click", toggleSidebar);
 
async function _createFileOrFolder(apiCall, ...args) {
    const response = await fetch(apiCall(...args), { method: 'GET' });
    const result = await response.json();
    console.log(result);
}

/**
 * @typedef {Object} Nĭnŏ
 * @property {function(string, string): Promise<void>} createMasking - Creates a masking file.
 * @property {function(string, string): Promise<void>} createPlaybook - Creates a playbook file.
 * @property {function(string, string): Promise<void>} createBash - Creates a bash script.
 * @property {function(string, string): Promise<void>} createDataconnector - Creates a dataconnector file.
 * @property {function(string): Promise<void>} createFolder - Creates a folder.
 */ 
export const Nĭnŏ = {
    createMasking: (folderName, tableName) => _createFileOrFolder(NĭnŏAPI.createMasking, folderName, tableName),
    createPlaybook: (folderName) => _createFileOrFolder(NĭnŏAPI.createPlaybook, folderName),
    createBash: (folderName) => _createFileOrFolder(NĭnŏAPI.createBash, folderName),
    createDataconnector: (folderName) => _createFileOrFolder(NĭnŏAPI.createDataConnector, folderName),
    createFolder: (folderName) => _createFileOrFolder(NĭnŏAPI.postFolder, folderName),

    // UI elements
    editors: () => ninoEditor.editorInstances,
    inputEditor: () => ninoExecution.inputEditor,
    outputEditor: () => ninoExecution.outputEditor,
    getCurrentTabContent: () => ninoEditor.editorInstances[ninoEditor.activeTab].getValue(),
    getCurrentInputContent: () => ninoExecution.inputEditor.getValue(),
    setOutputContent: (value) => ninoExecution.outputEditor.setValue(value),

    // constants 
    "API": NĭnŏAPI,
    "Templates": fileTypes,
    "Examples": pimoExamples, 
};
window.Nĭnŏ = Nĭnŏ;


makeHorizontalResizable();

// document.addEventListener("DOMContentLoaded", initializeApp);

/**
 * Makes the right panel, execution-panel resizable  
 */
function makeHorizontalResizable() {
    let handle = $("#resize-handle-h")
    $(handle).on("mousedown", (e) => {
        // console.log("mousedown", e);
        e.preventDefault();
        const container = $(handle).parent();
        const rect = container[0].getBoundingClientRect();
        // console.log("mousedown", rect);
        const onMouseMove = (moveEvent) => {
            const sidebarWidth = $(ninoWorkspace).outerWidth();
            const handleWidth = $(handle).outerWidth();

            const newNextWidth = rect.right - moveEvent.clientX;
            $(ninoExecution).css('flex', `0 0 ${newNextWidth}px`);

            const newPrevWidth = moveEvent.clientX - rect.left - sidebarWidth - handleWidth;
            $(ninoEditor).css('flex', `1 1 ${newPrevWidth}px`);
            ninoExecution.layoutEditors();
            ninoEditor.layoutEditors();
        };

        const onMouseUp = () => {
            $(document).off("mousemove", onMouseMove);
            $(document).off("mouseup", onMouseUp);
        };

        $(document).on("mousemove", onMouseMove);
        $(document).on("mouseup", onMouseUp);
    });
}

/**
 * infer language and dialect from a given filename based on its suffix and name patterns. 
 * It checks against a predefined list of file types and returns the best match.
 * If no match is found, it defaults to plaintext.
 * 
 * @param {string} filename 
 * @returns {Object} FileType. the file type ex : { language: "yaml", suffix: ["yaml", "yml"], dialect: "masking", regex: "masking" } 
 */
export function getFileType(filename) {
    const lowerFilename = filename.toLowerCase();
    const parts = lowerFilename.split('.');
    const suffix = parts.length > 1 ? parts.pop() : '';
    const nameWithoutSuffix = parts.join('.');

    for (const key in fileTypes) {
        const type = fileTypes[key];
        const suffixMatch = type.suffix && type.suffix.includes(suffix);
        const regexMatch = type.regex && (nameWithoutSuffix.includes(type.regex) || lowerFilename.includes(type.regex));

        if (suffixMatch && regexMatch) {
            return type;
        }
    }
    return { language: "plaintext", suffix: [], dialect: "plaintext", regex: "" }; // Default if no match
}

async function initializeApp() {
    // Monaco initialization is now handled within NinoEditor.js and NinoExecution.js
    // Wait for both components to signal that Monaco is ready and editors are created.
    // NinoEditor now waits for its child components to be ready.
    // await new Promise(resolve => ninoEditor.addEventListener('monaco-ready', resolve, { once: true }));
    // await new Promise(resolve => ninoExecution.addEventListener('monaco-ready', resolve, { once: true }));
}

/**
 * openTableStat
 * 
 * Displays an image of a given table's plots from `/api/plot/{folderName}/{tableName}`
 * and provides a link to create a boilerplate mask file.
 * This function replaces the content of the output panel.
 * 
 * @param {string} tableName - The name of the table to display statistics for.
 * @param {string} folderName - The name of the folder where the table definition resides.
 */
function openTableStat(tableName, folderName) {
    ninoEditor.activateTab('stats', false, {
        tableName: tableName,
        folderName: folderName
    });
    ninoEditor.statsViewContainer.setAttribute('folder-name', folderName)
    ninoEditor.statsViewContainer.setAttribute('table-name', tableName)
}

/**
 * openExecutionGraph
 *
 * Displays a graph of the current YAML in the output panel.
 * @param {string} folderName - The name of the folder where the YAML definition resides.
 */
function openExecutionGraph(folderName) {
    console.log("openExecutionGraph", folderName);

    // Find the first folder with a playbook.yaml if folderName is not provided
    if (!folderName) {
        const workspaceData = ninoWorkspace.getWorkspaceData();
        const firstPlaybookFolder = findFirstPlaybookFolder(workspaceData);
        if (firstPlaybookFolder) {
            folderName = firstPlaybookFolder;
        }
    }

    ninoEditor.activateTab('execution', false, { folderName: folderName });
}

/**
 * Toggles the collapsed state of the sidebar.
 * It adds or removes the 'collapsed' class, saves the state to localStorage,
 * and adjusts the width of the left panel to compensate for the sidebar's change in width.
 */
function toggleSidebar() {
    const isCollapsed = ninoWorkspace.toggleCollapse(); 

    // Adjust left panel width to keep right panel width constant
    const editorPanel = $(ninoEditor);
    const sidebarWidth = parseFloat(getComputedStyle(ninoWorkspace).getPropertyValue('--sidebar-width'));
    const currentLeftWidth = editorPanel.width();

    if (isCollapsed) {
        editorPanel.width(currentLeftWidth + sidebarWidth);
    } else {
        editorPanel.width(currentLeftWidth - sidebarWidth);
    }
    ninoEditor.layoutEditors();
}

/**
 * handleFileAction - Handles file actions such as "play" for playbooks and dataconnector files.
 * It constructs the appropriate API endpoint based on the file type and sends a POST request with the input editor content.
 * The response is then displayed in the output editor.
 * @param {*} event 
 * @returns 
 */
async function handleFileAction(event) {
    const { action, example } = event.detail;
    if (action === 'play') {
        let url;
        if (example.name.includes('playbook')) {
            url = NĭnŏAPI.execPlaybook(example.description, example.name);
        } else if (example.name.includes('dataconnector')) {
            url = NĭnŏAPI.execPull(example.description, example.name);
        }
        if (!url) return;

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain' },
                body: ninoExecution.getInputEditorValue()
            });
            const text = await response.text();
            ninoExecution.setOutputEditorValue(text);
        } catch (error) {
            ninoExecution.setOutputEditorValue(`Error: ${error.message}`);
        }
    }

    if (action == 'save') {
        let url = NĭnŏAPI.postFile(example.folderName, example.name);
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain' },
            body: ninoEditor.editorInstances[ninoEditor.activeTab].getValue()
        });
        const text = await response.text();
        ninoExecution.setOutputEditorValue(text);
    }
}

/**
 * Handles the selection of an example from the static examples menu or a file from the workspace tree.
 * It loads the corresponding content into the main YAML and input editors.
 */
async function openExample(example) {
    // Switch to the main YAML tab in NinoEditor
    ninoEditor.activateTab('example');

    // Track the file type being loaded into the main editor
    const fileName = (example.url && example.url.includes('/')) ? example.url.split('/').pop() : 'masking.yaml';
    ninoEditor.setYamlEditorFileType(fileName);

    if (example.yaml !== undefined) {
        ninoEditor.setYamlValue(example.yaml);
    } else if (example.url) {
        await fetch(example.url)
            .then(res => res.text())
            .then(text => ninoEditor.setYamlValue(text))
            .catch(err => ninoEditor.setYamlValue(`# Failed to load: ${example.url} : ${err}`));
    }
    ninoExecution.setInputEditorLanguage("json")
    ninoExecution.setInputEditorValue(example.input ?? example['data-input'] ?? '');
    ninoExecution.setOutputEditorLanguage("json");
}

/**
 * handleTabActivation - Handles the activation of different tabs in the editor. 
 */
function handleTabActivation(event) {

    const { tabId, fromClick, fileName, folderName } = event.detail;
    let inputEditorLanguage = 'shell';
    let inputEditorContent = '';

    if (tabId === 'graph' || tabId === 'execution') {
        ninoExecution.setOutputEditorValue('');
    } else {
        ninoExecution.layoutEditors();
    }
    if (fileName) {
        const fileType = getFileType(fileName);
        inputEditorLanguage = fileType.language;
        if (fileType.template) {
            inputEditorContent = fileType.template(folderName, fileName);
        }
    } else if (tabId === 'example' && !fromClick) {
        inputEditorLanguage = 'json';
        // Removed localStorage logic
        const example = pimoExamples[0].examples[0]; // Default to first example
        inputEditorContent = example?.input || '{}';
    } else {
        inputEditorLanguage = 'shell';
    }

    ninoExecution.setInputEditorLanguage(inputEditorLanguage);
    ninoExecution.setInputEditorValue(inputEditorContent);
    ninoExecution.activeFile = { fileName, folderName };
}

/**
 * Recursively searches for the first folder containing a 'playbook.yaml' file.
 * @param {Array<Object>} items - The workspace items (files and folders).
 * @returns {string|null} The name of the first folder found with a playbook.yaml, or null.
 */
function findFirstPlaybookFolder(items) {
    for (const item of items) {
        if (typeof item === 'object' && !Array.isArray(item)) {
            const folderName = Object.keys(item)[0];
            const folderContent = item[folderName];
            if (folderContent.some(file => typeof file === 'string' && file.includes('playbook.yaml'))) {
                return folderName;
            }
        }
    }
    return null;
}

ninoExecution.addEventListener('execute-nino', (e) => handleExecution(e));
ninoEditor.addEventListener('tab-activated', (e) => handleTabActivation(e));
ninoEditor.addEventListener('file-action', handleFileAction);
ninoWorkspace.addEventListener('select-example', (e) => openExample(e.detail)); 
ninoWorkspace.addEventListener('open-file', (e) => ninoEditor.openFile(e));