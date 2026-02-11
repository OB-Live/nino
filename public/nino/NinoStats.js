class NinoStats extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this.shadowRoot.innerHTML = `
            <link rel="stylesheet" href="NinoStyle.css">
            <div id="stats-container"></div>
        `;
    }

    connectedCallback() {
        this.render();
    }

    attributeChangedCallback(name, oldValue, newValue) {
        if ((name === 'table-name' || name === 'folder-name') && oldValue !== newValue) {
            this.render();
        }
    }

    static get observedAttributes() {
        return ['table-name', 'folder-name'];
    }

    render() {
        const tableName = this.getAttribute('table-name');
        const folderName = this.getAttribute('folder-name');
        const statsContainer = this.shadowRoot.querySelector('#stats-container');
        statsContainer.innerHTML = ''; // Clear previous content

        if (!tableName || !folderName) {
            statsContainer.textContent = 'No table or folder selected for statistics.';
            return;
        }

        const tableStats = document.createElement('table-stats');
        tableStats.setAttribute('table-name', tableName);
        tableStats.setAttribute('folder-name', folderName);
        statsContainer.appendChild(tableStats);
    }
}

customElements.define('nino-stats', NinoStats);