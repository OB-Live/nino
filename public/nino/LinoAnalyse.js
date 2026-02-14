class LinoAnalyse extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this.shadowRoot.innerHTML = `
            <link rel="stylesheet" href="NinoStyle.css">
            <style>
                

            </style>
            <p>
                <span> 
                <button class="btn"> 📈 (Re)Start Analysis</button> 
                 or 
                <button class="btn"><i class="iMask mediumIcon"></i> Create a mask</button> 
                </span> 
            </p>
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

        const plotUrl = `/api/plot/${folderName}/${tableName}`;
        const plotImage = document.createElement('img');
        plotImage.src = plotUrl;
        plotImage.alt = `Statistics plot for ${tableName} in ${folderName}`;
        plotImage.style.maxWidth = '100%';
        plotImage.style.height = 'auto';
        plotImage.style.display = 'block'; // Ensure it takes up its own line
        plotImage.style.margin = 'auto'; // Center the image

        plotImage.onerror = () => {
            statsContainer.textContent = `Failed to load plot for ${tableName}. It might not exist or there was a server error.`;
            plotImage.remove(); // Remove the broken image element
        };

        statsContainer.appendChild(plotImage);
    }
}

customElements.define('lino-analyse', LinoAnalyse);