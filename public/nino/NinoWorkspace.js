import { staticExamples } from './NinoConstants.js';

class NinoWorkspace extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this.shadowRoot.innerHTML = `
            <link rel="stylesheet" href="NinoStyle.css">
            <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/jstree/3.3.12/themes/default-dark/style.min.css" /> 
            <div class="sidebar-header">
                <span>Data masks</span>
            </div>
            <div id="sidebar-content" class="sidebar-content">
                <div id="examples-container" class="scroll-area"></div>
                <div id="jstree-workspace" class="jstree-default-dark"></div>
            </div>
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
        staticExamples.forEach(category => {
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
            const response = await fetch('/api/files');
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
            /**
             * Recursively processes a node (folder or file) from the input data
             * and adds it to the jstreeData array.
             * @param {Array<string|object>} items - An array of file names (strings) or folder objects.
             * @param {string} parentId - The ID of the parent node in the jstree.
             * @param {string} currentPath - The current path in the file tree (e.g., "Workspace/folderA").
             */
            const processNode = (items, parentId, currentTreePath, currentUrlPath) => {
                const children = [];
                for (const item of items) {
                    if (typeof item === 'string') {
                        // It's a file
                        if (item.endsWith(".yaml") || item.endsWith(".yml")) {
                            const fileName = item;
                            const nodeTreePath = `${currentTreePath}/${fileName}`;
                            const nodeUrlPath = currentUrlPath ? `${currentUrlPath}/${fileName}` : fileName;
                            jstreeData.push({
                                id: `ws_file_${idCounter++}`,
                                parent: parentId,
                                text: fileName,
                                icon: 'jstree-file',
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
                    } else if (typeof item === 'object' && item !== null) {
                        // It's a folder
                        const folderName = Object.keys(item)[0];  
                        const folderContent = item[folderName];  
                        const newFolderId = `ws_folder_${idCounter++}`; // This is the jstree node ID
                        const newCurrentTreePath = `${currentTreePath}/${folderName}`; // This is the full path for jstree hierarchy
                        const newCurrentUrlPath = currentUrlPath ? `${currentUrlPath}/${folderName}` : folderName; // This is the path for the URL
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
 
            // Assuming the top-level 'files' object contains a 'Workspace' key with an array of items
            if (files.Workspace && Array.isArray(files.Workspace)) {
                workspaceRootNode.children = processNode(files.Workspace, 'ws_root', 'Workspace', '');
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
     */
    renderFileTree(jstreeData) {
        const jstreeDiv = this.shadowRoot.querySelector("#jstree-workspace");
        $(jstreeDiv)
            .jstree({
                core: {
                    data: jstreeData,
                    check_callback: true,
                },
                plugins: ['wholerow', 'types'],
                types: {
                    default: { icon: 'jstree-file' },
                    folder: { icon: 'jstree-folder' },
                    file: { icon: 'jstree-file' },
                },
            })
            .on('select_node.jstree', (e, data) => {
                if (data.node.type === 'file') {
                    this.dispatchEvent(new CustomEvent('select-file', { detail: { node: data.node } }));
                }
            })
            .on('dblclick.jstree', (e) => {
                const instance = $.jstree.reference(e.target);
                const node = instance.get_node(e.target);
                if (node && node.type === 'file') {
                    this.dispatchEvent(new CustomEvent('open-file', { detail: { node } }));
                }
            });
    }
}

customElements.define('nino-workspace', NinoWorkspace);