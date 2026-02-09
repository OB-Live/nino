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

    async fetchWorkspaceFiles() {
        try {
            const response = await fetch('/api/files');
            if (!response.ok) return [];
            var res =  await response.json();
            console.log(res);
            return res ; 
        } catch (error) {
            console.error('Failed to fetch workspace files:', error);
            return [];
        }
    }

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