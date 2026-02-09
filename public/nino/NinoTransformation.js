class NinoTransformation extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this.shadowRoot.innerHTML = `
            <link rel="stylesheet" href="NinoStyle.css">
            <style>
                #transformation-container { flex: 1; overflow: hidden; }
            </style>
            <div id="transformation-container"></div>
        `;
    }

    connectedCallback() {
        this.render();
    }

    attributeChangedCallback(name, oldValue, newValue) {
        if (name === 'folder-name' && oldValue !== newValue) {
            this.render();
        }
    }

    static get observedAttributes() {
        return ['folder-name'];
    }

    render() {
        const folderName = this.getAttribute('folder-name');
        const transformationContainer = this.shadowRoot.querySelector('#transformation-container');
        transformationContainer.innerHTML = ''; // Clear previous content

        if (!folderName) {
            transformationContainer.textContent = 'No folder selected for transformation graph.';
            return;
        }

        const playbookPlan = document.createElement('playbook-plan');
        playbookPlan.setAttribute('folder-name', folderName);
        transformationContainer.appendChild(playbookPlan);
    }
}

customElements.define('nino-transformation', NinoTransformation);