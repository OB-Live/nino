import { pimoExamples, NĭnŏAPI } from './NinoConstants.js';
import { Nĭnŏ } from './NinoApp.js';
import './NinoDialog.js';
import * as  jstree from 'https://cdnjs.cloudflare.com/ajax/libs/jstree/3.3.12/jstree.min.js';

class NinoWorkspace extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this.shadowRoot.innerHTML = `
            <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/jstree/3.3.12/themes/default-dark/style.min.css" /> 
            <link rel="stylesheet" href="NinoStyle.css" />
            <div class="sidebar-header">
                <span>Masks & Workspace</span>
            </div>
            <div id="sidebar-content" class="sidebar-content">
                <div id="examples-container" class="scroll-area"></div>
                <div id="jstree-workspace" class="jstree-default-dark"></div>
            </div>
            <nino-dialog></nino-dialog>
        `;
    }

    toggleCollapse() {
        this.classList.toggle('collapsed');
        return this.classList.contains('collapsed');
    }

    collapse() {
        this.classList.add('collapsed');
    }

    expand() {
        this.classList.remove('collapsed');
    }

    connectedCallback() {
        this.renderExamplesMenu();
        this.loadWorkspace();
        this._contextMenuEvent = null;
    }

    refresh() {
        
        console.log("refresh")
        const jstreeDiv = this.shadowRoot.querySelector("#jstree-workspace");
        jstreeDiv.clear()
        this.loadWorkspace();
    }

    getWorkspaceData() {
        return this._workspaceData;
    }

    /**
      * Renders the static examples menu in an accordion-style format.
      * Each category can be expanded/collapsed to show its examples.
      */
    renderExamplesMenu() {
        const examplesContainer = this.shadowRoot.querySelector("#examples-container");
        pimoExamples.forEach(category => {
            const item = document.createElement("div");
            item.className = "accordion-item";

            const trigger = document.createElement("button");
            trigger.className = "accordion-trigger";
            trigger.innerHTML = `${category.name} <span>&#9660;</span>`;

            const content = document.createElement("div");
            content.className = "accordion-content";

            category.examples.forEach(example => {
                const btn = document.createElement("button");
                btn.className = "example-btn";
                btn.innerHTML = `<div class="example-name">${example.name}</div><div class="example-desc">${example.description}</div>`;
                btn.onclick = () => this.dispatchEvent(new CustomEvent('select-example', { detail: example }));
                content.appendChild(btn);
            });

            trigger.onclick = () => {
                const isExpanded = content.style.maxHeight && content.style.maxHeight !== "0px";
                if (isExpanded) { // If it's expanded, collapse it
                    content.style.maxHeight = null;
                } else { // If it's collapsed, expand it
                    content.style.maxHeight = content.scrollHeight + "px"; // Use scrollHeight to get the full height of the content
                }
            };
            item.appendChild(trigger);
            item.appendChild(content);
            examplesContainer.appendChild(item);
        });
    }

    async loadWorkspace() {
        const jstreeData = await this.fetchWorkspaceFiles();
        this.renderFileTree(jstreeData);
    }

    /**
    * Fetches workspace files from the backend API and transforms them into jstree-compatible data.
    */
    async fetchWorkspaceFiles() {
        try {
            const response = await fetch(NĭnŏAPI.getFiles());
            if (!response.ok) return [];
            const files = await response.json();
            console.log(files);

            const jstreeData = [];
            let idCounter = 1;

            // Create a root node for "Workspace" 
            const workspaceRootNode = {
                id: `ws_root`,
                parent: '#',
                text: 'Workspace',
                state: { opened: true },
                type: 'folder'
            };

            jstreeData.push(workspaceRootNode);

            let currentIdCounter = 1; // Use a local counter for unique IDs

            /**
             * Recursively processes a node (folder or file) from the input data
             * and adds it to the jstreeData array.
             * Recursively processes a node (folder or file) from the input data and adds it to the jstreeData array.
             * @param {Array<string|object>} items - An array of file names (strings) or folder objects.
             * @param {string} parentId - The ID of the parent node in the jstree.
             * @param {string} currentPath - The current path in the file tree (e.g., "Workspace/folderA").
             * @param {string} currentTreePath - The current path in the file tree (e.g., "Workspace/folderA").
             * @param {string} currentUrlPath - The current path for constructing URLs.
             */
            const processNode = (items, parentId, currentTreePath, currentUrlPath) => {
                const children = [];
                for (const item of items) {
                    if (typeof item === 'string') { // It's a file
                        if (item.endsWith(".yaml") || item.endsWith(".yml")) {
                            const fileName = item;
                            const nodeTreePath = `${currentTreePath}/${fileName}`;
                            const nodeUrlPath = currentUrlPath ? `${currentUrlPath}/${fileName}` : fileName;

                            const getIconForFile = (fileName) => {
                                switch (true) {
                                    case fileName.includes("masking"): return "/img/masks_24.png";
                                    case fileName.includes("dataconnector"): return "/img/db_icon_24.png";
                                    case fileName.includes("playbook"): return "/img/ansible_24.png";
                                    case fileName.includes("docker-compose"): return "/img/docker_24.png";
                                    case fileName.includes("tables"): return "/img/tables_24.png";
                                    case fileName.includes("analyze"): return "/img/analyze_24.png";
                                    case fileName.includes("swagger"): return "/img/swagger_24.png";
                                    case fileName.includes("descriptor"): return "/img/description_24.png";
                                    case fileName.includes("relations"): return "/img/relations_24.png";
                                    case fileName.endsWith(".sh"): return "/img/bash_24.png";
                                    default: return "jstree-file";
                                }
                            };
                            const ico = getIconForFile(fileName);
                            jstreeData.push({
                                id: `ws_file_${currentIdCounter++}`,
                                parent: parentId,
                                text: fileName,
                                icon: ico,
                                li_attr: {
                                    'data-url': `/api/file/${nodeUrlPath}`,
                                    'data-input': '{}', // Default input for workspace files  
                                    'data-file-name': fileName,
                                    'data-folder-name': currentUrlPath.split('/').pop() || '', // Get the immediate parent folder name for the URL path
                                    'data-example-id': `workspace-${nodeTreePath}` // To identify it later  
                                },
                                type: 'file'
                            });
                        }
                    } else if (typeof item === 'object' && item !== null) { // It's a folder
                        const folderName = Object.keys(item)[0];
                        const folderContent = item[folderName];

                        const newFolderId = `ws_folder_${currentIdCounter++}`;
                        const newCurrentTreePath = `${currentTreePath}/${folderName}`;
                        const newCurrentUrlPath = currentUrlPath ? `${currentUrlPath}/${folderName}` : folderName;
                        jstreeData.push({
                            id: newFolderId,
                            parent: parentId,
                            text: folderName,
                            icon: 'jstree-folder',
                            state: { opened: true },
                            type: 'folder',
                            children: processNode(folderContent, newFolderId, newCurrentTreePath, newCurrentUrlPath) // Recursively call for children
                        });
                    }
                }
            };

            if (files.Workspace && Array.isArray(files.Workspace)) { // Assuming the top-level 'files' object contains a 'Workspace' key
                processNode(files.Workspace, 'ws_root', 'Workspace', '');
            }

            return jstreeData;
        } catch (error) {
            console.error('Failed to fetch workspace files:', error);
            return [];
        }
    }

    /**
        * Renders the file tree using jstree.
        * Sets up event listeners for node selection and double-click to open files.
        * documentation there : https://github.com/vakata/jstree/blob/master/src/jstree.contextmenu.js
        */
    renderFileTree(jstreeData) {
        const jstreeDiv = this.shadowRoot.querySelector("#jstree-workspace");
        const $jstreeElement = $(jstreeDiv); // Get the jQuery object for the div
        $jstreeElement // Initialize jstree on the jQuery element
            .jstree({
                core: {
                    data: jstreeData,
                    dots: true,
                    check_callback: true,
                },
                plugins: ["state", "types", "sort", "search", "contextmenu"],

                types: {
                    default: { icon: 'jstree-file' },
                    folder: { icon: 'jstree-folder' },
                    file: { icon: 'iMask' },
                    dataconnector: { icon: 'iDataconnector' },
                    masking: { icon: 'iMask' },
                    playbook: { icon: '▶️' },
                    table: { icon: '📊' },
                    analyse: { icon: '🔍' },
                },
                "contextmenu": {
                    "items": ($node) => {
                        const directory = $node.li_attr['data-folder-name']
                        const filename = $node.li_attr['data-file-name']

                        const showInputDialog = (action, label, defaultValue, callback) => {
                            if (!this._contextMenuEvent) return;
                            let dialog = this.shadowRoot.querySelector('nino-dialog');

                            dialog.open(
                                this._contextMenuEvent.clientX,
                                this._contextMenuEvent.clientY,
                                label,
                                defaultValue,
                                callback
                            );
                        };

                        return {
                            createFolder: {
                                "separator_before": false,
                                "separator_after": true,
                                "icon": 'iFolder',
                                "label": "Create Folder",
                                "action": (obj) => showInputDialog('CreateFolder', 'Folder Name:', directory ? `${directory}/new-folder` : 'new-folder', (path) => Nĭnŏ.createFolder(path))
                            },
                            createDB: {
                                "separator_before": false,
                                "separator_after": true,
                                "icon": 'iDataconnector',
                                "label": "Create DataConnector",
                                "action": (obj) => showInputDialog(
                                    'CreateDataConnector',
                                    'DataConnector Path:', directory ? `${directory}/dataconnector.yaml` : 'dataconnector.yaml',
                                    (path) => Nĭnŏ.createDataconnector(path)
                                ),
                                "_class": "class"
                            },
                            createMasking: {
                                "separator_before": false,
                                "separator_after": true,
                                "icon": 'iMask',
                                "label": "Create Masking File",
                                "action": (obj) => showInputDialog(
                                    'CreateMasking',
                                    'Table Name for Mask:',
                                    directory ? `${directory}/xxx-masking.yaml` : 'xxx-masking.yaml',
                                    (path) => Nĭnŏ.createMasking(path)
                                )
                            },
                            createPlaybook: {
                                "separator_before": false,
                                "separator_after": true,
                                "icon": 'iAnsible',
                                "label": "Create Playbook",
                                "action": (obj) => showInputDialog(
                                    'CreatePlaybook',
                                    'Playbook Path:',
                                    directory ? `${directory}/playbook.yaml` : 'playbook.yaml',
                                    (path) => Nĭnŏ.createPlaybook(path)
                                )
                            },
                            createScript: {
                                "separator_before": false,
                                "separator_after": true,
                                "icon": 'iBash',
                                "label": "Create bash script",
                                "action": (obj) => showInputDialog(
                                    'CreateBash',
                                    'Bash Script Path:',
                                    directory ? `${directory}/aScript.sh` : 'aScript.sh',
                                    (path) => Nĭnŏ.createBash(path)
                                )
                            },
                            deleteFile: {
                                "separator_before": true,
                                "separator_after": false,
                                "icon": 'iDelete',
                                "label": "Delete",
                                "action": (obj) => showInputDialog(
                                    'DeleteFile',
                                    'Delete File Path:',
                                    directory ? `${directory}/${filename}` : `${filename}`,
                                    (path) => Nĭnŏ.deleteFile(path)
                                )
                            }
                        };
                    }
                },
            })
        // Bind events to the jQuery object directly after initialization
        $jstreeElement
            .on('dblclick.jstree', (e) => {
                const instance = $.jstree.reference(e.target);
                const node = instance.get_node(e.target);
                if (node && node.type === 'file') {
                    this.dispatchEvent(new CustomEvent('open-file', { detail: { node } }));
                }
            })
            .on('contextmenu.jstree', (e) => {
                e.preventDefault();
                this._contextMenuEvent = e;
            });
    }
}

customElements.define('nino-workspace', NinoWorkspace);