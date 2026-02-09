import { HELPER_LOAD_METADATA, staticExamples, MASK_KEYWORDS } from './NinoConstants.js';
import './NinoEditor.js';
import './NinoWorkspace.js';
import './NinoExecution.js';
import './NinoGraph.js';

const $sidebar = $("nino-workspace");
const $sidebarToggle = $("#sidebar-toggle");
export const $ninoEditor = document.querySelector('nino-editor');
export const $ninoExecution = document.querySelector('nino-execution');
export const $ninoWorkspace = document.querySelector('nino-workspace');


// --- Event Handlers ---
$sidebarToggle.on("click", toggleSidebar);

document.addEventListener("DOMContentLoaded", initializeApp);

/**
 * Makes an element resizable by dragging a handle.
 * @param {HTMLElement} handle - The handle element to drag.
 * @param {HTMLElement} prev - The element to resize before the handle.
 * @param {HTMLElement} next - The element to resize after the handle.
 * @param {'horizontal'|'vertical'} direction - The direction of resizing.
 */
export function makeHorizontalResizable(handle, prevComponent, nextComponent) {
    let isResizing = false;
    $(handle).on("mousedown", () => (isResizing = true));
    $(document).on("mouseup", () => {
        if (isResizing) {
            // Access the internal panels via shadow DOM for the top-level split
            const prev = prevComponent.shadowRoot.getElementById('left-panel');
            const next = nextComponent.shadowRoot.getElementById('right-panel');


            // This branch is for internal vertical split, not used here directly for top-level
            localStorage.setItem("nino-panel-v-prev", $(prev).css('height'));
            localStorage.setItem("nino-panel-v-next", $(next).css('height'));

        }
        isResizing = false;
    });
    $(document).on("mousemove", (e) => {
        if (!isResizing) return;

        // Access the internal panels via shadow DOM for the top-level split
        const prev = prevComponent;
        const next = nextComponent;

        const $container = $(handle).parent(); // The container of the panels
        const rect = $container[0].getBoundingClientRect();
        const newPrevWidth = e.clientX - rect.left;
        $(prev).width(newPrevWidth);
        $(next).width(rect.width - newPrevWidth - $(handle).width());
        $ninoEditor.layoutEditors();

    });
}

async function initializeApp() {
    // Monaco initialization is now handled within NinoEditor.js and NinoExecution.js
    // Wait for both components to signal that Monaco is ready and editors are created.
    await Promise.all([
        new Promise(resolve => $ninoEditor.addEventListener('monaco-ready', resolve, { once: true })),
        new Promise(resolve => $ninoExecution.addEventListener('monaco-ready', resolve, { once: true }))
    ]);

    $ninoEditor.setJsyaml(jsyaml); // jsyaml is still assumed to be global and needed by NinoEditor
    await restoreUiState();

    makeHorizontalResizable($("#resize-handle-h"), $ninoEditor, $ninoExecution);
    window.openExecutionGraph = openExecutionGraph;
    // The makeResizable call for the vertical split within NinoExecution is handled internally by NinoExecution.js

    window.openTableStat = openTableStat;
     
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
    $ninoExecution.setOutputEditorValue(''); // Clear output container via NinoExecution
    const tableStats = document.createElement('table-stats');
    tableStats.setAttribute('table-name', tableName);
    tableStats.setAttribute('folder-name', folderName);
    $ninoExecution.shadowRoot.getElementById('output-viewer-container').append(tableStats);
}

/**
 * openExecutionGraph
 *
 * Displays a graph of the current YAML in the output panel.
 * @param {string} folderName - The name of the folder where the YAML definition resides.
 */
function openExecutionGraph(folderName) {
    $ninoExecution.setOutputEditorValue(''); // Clear output container via NinoExecution
    const playbookPlan = document.createElement('playbook-plan');
    playbookPlan.setAttribute('folder-name', folderName);
    $ninoExecution.shadowRoot.getElementById('output-viewer-container').append(playbookPlan);
}

/**
 * Toggles the collapsed state of the sidebar.
 * It adds or removes the 'collapsed' class, saves the state to localStorage,
 * and adjusts the width of the left panel to compensate for the sidebar's change in width.
 */
function toggleSidebar() {
    const isCollapsed = $ninoWorkspace.toggleCollapse();
    localStorage.setItem("nino-sidebar-collapsed", isCollapsed);

    // Adjust left panel width to keep right panel width constant
    const $leftPanel = $("#left-panel");
    const sidebarWidth = parseFloat(getComputedStyle($ninoWorkspace).getPropertyValue('--sidebar-width'));
    const currentLeftWidth = $leftPanel.width();

    if (isCollapsed) {
        $leftPanel.width(currentLeftWidth + sidebarWidth);
    } else {
        $leftPanel.width(currentLeftWidth - sidebarWidth);
    }
    $ninoEditor.layoutEditors();
}

/**
 * Handles the click event for the download graph button.
 * It opens a small dialog with options to download the schema graph in different formats (DOT, SVG, PNG).
 * @param {Event} e - The click event object.
 */

/**
 * Handles the click event for the execute button.
 * It sends the YAML and JSON content from the editors to the backend for execution
 * and displays the result in the output editor.
 */
async function handleExecute(yamlValue, jsonValue) {
    const executeBtn = $ninoExecution.shadowRoot.getElementById('execute-btn');
    executeBtn.textContent = "Executing...";
    executeBtn.disabled = true;
    $ninoExecution.setOutputEditorValue("");

    try {
        const response = await fetch("/api/pimo/exec", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                yaml: yamlValue,
                json: jsonValue,
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            $ninoExecution.setOutputEditorValue(JSON.stringify({ error: `Command execution failed: ${errorText}` }, null, 2));
        } else {
            const resultJson = await response.json();
            $ninoExecution.setOutputEditorValue(JSON.stringify(resultJson, null, 2));
        }
    } catch (error) {
        $ninoExecution.setOutputEditorValue(
            JSON.stringify({ error: "API request failed" }, null, 2)
        );
    } finally {
        executeBtn.textContent = "";
        executeBtn.disabled = false;
    }
}

// --- UI State Persistence ---
/**
 * Saves the state of open file tabs (excluding the main YAML, input, and output tabs)
 * and the currently active tab to localStorage.
 */
function saveTabsState() {
    const openTabs = [];
    $ninoEditor.shadowRoot.querySelectorAll(".tab-button").forEach(function (tab) {
        const tabId = tab.dataset.tab;
        if (tabId.startsWith("file-tab-")) {
            openTabs.push({
                id: tab.dataset.exampleId,
                name: tab.dataset.fileName,
                description: tab.dataset.folderName,
                url: tab.dataset.url,
            });
        }
    });
    const activeTab = $ninoEditor.shadowRoot.querySelector(".tab-button.active")?.dataset.tab;
    localStorage.setItem("nino-open-tabs", JSON.stringify(openTabs));
    localStorage.setItem("nino-active-tab", activeTab);
}

async function handlePlay(example) {
    $ninoExecution.setOutputEditorValue("Executing...");
    $ninoExecution.activateOutputTab(); // Assuming NinoExecution has a method to activate its output tab

    let url = '';
    if (example.name.includes('playbook')) {
        url = `/api/exec/playbook/${example.description}/${example.name}`;
    } else if (example.name.includes('dataconnector')) {
        url = `/api/exec/pull/${example.description}/${example.name}`;
    }
    if (!url) return;

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain' },
            body: $ninoExecution.getInputEditorValue()
        });
        const text = await response.text();
        $ninoExecution.setOutputEditorValue(text);
    } catch (error) {
        $ninoExecution.setOutputEditorValue(`Error: ${error.message}`);
    }
}

async function handleFileAction(event) {
    const { action, example } = event.detail;
    if (action === 'play') {
        let url = '';
        if (example.name.includes('playbook')) {
            url = `/api/exec/playbook/${example.description}/${example.name}`;
        } else if (example.name.includes('dataconnector')) {
            url = `/api/exec/pull/${example.description}/${example.name}`;
        }
        if (!url) return;

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain' },
                body: $ninoExecution.getInputEditorValue()
            });
            const text = await response.text();
            $ninoExecution.setOutputEditorValue(text);
        } catch (error) {
            $ninoExecution.setOutputEditorValue(`Error: ${error.message}`);
        }
    }
}

export async function restoreUiState() {
    // Restore sidebar state
    const isSidebarCollapsed = localStorage.getItem("nino-sidebar-collapsed") === "true";
    if (isSidebarCollapsed) {
        $sidebar.addClass("collapsed");
    }
    const savedTabs = localStorage.getItem("nino-open-tabs");
    if (savedTabs) {
        const openTabs = JSON.parse(savedTabs);
        for (const example of openTabs) { // This re-uses the existing function to open tabs
            // The example object might not have all properties needed by openWorkspaceFileInNewTab,
            // but it should have enough to reconstruct the tab.
            await openWorkspaceFileInNewTab(example);
        }
    }

    // Restore the active tab
    const activeTabId = localStorage.getItem("nino-active-tab");
    let tabToActivate = $ninoEditor.shadowRoot.querySelector(`.tab-button[data-tab="${activeTabId}"]`);
    if (!tabToActivate) {
        // Fallback to the default YAML tab if the saved one doesn't exist
        tabToActivate = $ninoEditor.shadowRoot.querySelector('.tab-button[data-tab="yaml"]');
    }
    $ninoEditor.activateTab(tabToActivate);

    // Restore panel sizes
    const hPrevWidth = localStorage.getItem("nino-panel-h-prev");
    const hNextWidth = localStorage.getItem("nino-panel-h-next");
    if (hPrevWidth && hNextWidth) {
        // Access the custom elements directly
        $($ninoEditor).width(parseFloat(hPrevWidth));
        $($ninoExecution).width(parseFloat(hNextWidth));
    } else {
        // Set initial 60/40 split if no saved state
        const mainContainerWidth = $(".main-container").width();
        const sidebarWidth = parseFloat(getComputedStyle($ninoWorkspace).getPropertyValue('--sidebar-width'));
        const resizeHandleWidth = $("#resize-handle-h").width();
        const availableWidth = mainContainerWidth - sidebarWidth - resizeHandleWidth;
        $($ninoEditor).width(availableWidth * 0.6);
        $($ninoExecution).width(availableWidth * 0.4);
    }

    $ninoEditor.layoutEditors();
}

/**
 * Opens a workspace file in a new tab, creating a Monaco editor for it.
 * It fetches the file content, sets up syntax validation, and adds save and play (if applicable) functionalities.
 * @param {Object} example - The example object containing file information (id, name, description, url).
 */
async function openWorkspaceFileInNewTab(example) {
    await $ninoEditor.openFile(example);
    saveTabsState();
}

/**
 * Handles the selection of an example from the static examples menu or a file from the workspace tree.
 * It loads the corresponding content into the main YAML and input editors.
 */
async function handleSelectExample(example) {
    // Switch to the main YAML tab in NinoEditor
    $ninoEditor.activateTab('yaml');

    // Track the file type being loaded into the main editor
    const fileName = (example.url && example.url.includes('/')) ? example.url.split('/').pop() : 'masking.yaml';
    $ninoEditor.setYamlEditorFileType(fileName);

    if (example.yaml !== undefined) {
        $ninoEditor.setYamlValue(example.yaml);
    } else if (example.url) {
        await fetch(example.url)
            .then(res => res.text())
            .then(text => $ninoEditor.setYamlValue(text))
            .catch(err => $ninoEditor.setYamlValue(`# Failed to load: ${example.url}`));
    }
    $ninoExecution.setInputEditorValue(example.input);
    $ninoExecution.setOutputEditorValue("");
}

$ninoExecution.addEventListener('execute-nino', async (event) => {
    const yamlValue = $ninoEditor.getYamlValue();
    const jsonValue = $ninoExecution.getInputEditorValue();
    await handleExecute(yamlValue, jsonValue);
});

$ninoEditor.addEventListener('tab-activated', (event) => {
    const { tabId, fromClick, fileName, folderName } = event.detail;
    saveTabsState();

    if (tabId === 'graph') {
        $ninoExecution.setOutputEditorValue('');
    } else {
        $ninoExecution.restoreInputOutputEditors();
    }

    if (fileName && fileName.includes('dataconnector.yaml')) {
        $ninoExecution.setInputEditorLanguage('shell');
        $ninoExecution.setInputEditorValue(HELPER_LOAD_METADATA(folderName));
    } else if (fileName && fileName.includes('playbook.yaml')) {
        $ninoExecution.setInputEditorLanguage('shell');
        $ninoExecution.setInputEditorValue(`ansible-playbook ${folderName}/${fileName} --connection=local`);
    } else if (tabId === 'yaml') {
        $ninoExecution.setInputEditorLanguage('json');
        if (!fromClick) {
            const activeExampleId = localStorage.getItem('nino-active-example-id');
            const example = staticExamples.flatMap(c => c.examples).find(e => e.id === activeExampleId);
            $ninoExecution.setInputEditorValue(example?.input || '{}');
        }
    }
});

$ninoEditor.addEventListener('file-action', handleFileAction);
$ninoEditor.addEventListener('tab-closed', saveTabsState);

$ninoWorkspace.addEventListener('select-example', (e) => handleSelectExample(e.detail));
$ninoWorkspace.addEventListener('select-file', (e) => handleSelectExample(e.detail.node.li_attr));
$ninoWorkspace.addEventListener('open-file', (e) => openWorkspaceFileInNewTab(e.detail.node.li_attr));