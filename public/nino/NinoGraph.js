class TransformationPlan extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this.shadowRoot.innerHTML = `<link rel="stylesheet" href="NinoStyle.css">
            <style>
                 #graph-container { height: 100%; width: 100%; }
            </style>
            <div id="graph-container"></div>
        `;
    }

    connectedCallback() {
        const graphContainer = this.shadowRoot.querySelector('#graph-container');
        let transformationPlan = d3.select(graphContainer).graphviz({ useWorker: false });

        d3.text("/api/schema.dot")
            .then(dot => {
                if (!dot) {
                    console.error("Received empty dot source for transformation plan.");
                    return;
                }
                transformationPlan.renderDot(dot).on("end", function () {
                    const { width, height } = this.getBBox();
                    const containerWidth = graphContainer.clientWidth;
                    const containerHeight = graphContainer.clientHeight;
                    const scale = 0.5;
                    const x = (containerWidth - width * scale) / 2;
                    const y = (containerHeight - height * scale) / 2;
                    const initialTransform = d3.zoomIdentity.translate(x, y).scale(scale);
                    d3.select(this).call(d3.zoom().transform, initialTransform);
                    d3.select(this).on("zoom", () => {});
                });
            })
            .catch(error => console.error("Failed to load schema.dot:", error));
    }
}

class PlaybookPlan extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this.shadowRoot.innerHTML = `<link rel="stylesheet" href="NinoStyle.css">
            <div id="graph-container" style="height: 100%; width: 100%;"></div>
        `;
    }

    connectedCallback() {
        const folderName = this.getAttribute('folder-name');
        if (!folderName) return;

        const graphContainer = this.shadowRoot.querySelector('#graph-container');
        let executionGraphviz = d3.select(graphContainer).graphviz({ useWorker: false });

        d3.text(`/api/playbook/${folderName}`)
            .then(dot => {
                if (!dot) {
                    console.error("Received empty dot source for playbook.");
                    return;
                }
                executionGraphviz.renderDot(dot).on("end", function () {
                    const { width, height } = this.getBBox();
                    const containerWidth = graphContainer.clientWidth;
                    const containerHeight = graphContainer.clientHeight;
                    const scale = 0.5;
                    const x = (containerWidth - width * scale) / 2;
                    const y = (containerHeight - height * scale) / 2;
                    const initialTransform = d3.zoomIdentity.translate(x, y).scale(scale);
                    d3.select(this).call(d3.zoom().transform, initialTransform);
                });
            })
            .catch(error => console.error("Failed to load playbook graph:", folderName, error));
    }
}

class TableStats extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this.shadowRoot.innerHTML = `<link rel="stylesheet" href="NinoStyle.css">
            <style>
                img { max-width: 100%; border: 1px solid #555; }
                a { display: inline-block; margin-top: 1em; }
                .example-btn { background-color: #3a3a3a; color: #eee; border: 1px solid #555; padding: 8px 12px; cursor: pointer; text-decoration: none; border-radius: 4px; }
                .example-btn:hover { background-color: #4a4a4a; }
            </style>
            <h3></h3>
            <img />
            <a class="example-btn"></a>
        `;
    }

    connectedCallback() {
        const tableName = this.getAttribute('table-name');
        const folderName = this.getAttribute('folder-name');
        if (!tableName || !folderName) return;

        const shadow = this.shadowRoot;
        shadow.querySelector('h3').textContent = `Statistics for ${folderName}/${tableName}`;
        shadow.querySelector('img').src = `/api/plot/${folderName}/${tableName}`;
        const link = shadow.querySelector('a');
        link.href = `/api/mask/${folderName}/${tableName}`;
        link.textContent = 'Create Boilerplate Mask File';
    }
}

customElements.define('transformation-plan', TransformationPlan);
customElements.define('playbook-plan', PlaybookPlan);
customElements.define('table-stats', TableStats);