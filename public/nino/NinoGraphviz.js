import * as d3 from '/lib/d3.v7.min.js';
import '/lib/d3-graphviz.js';
class NinoGraphviz extends HTMLElement {
    static get observedAttributes() {
        return ['url'];
    }
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this.shadowRoot.innerHTML = `<link rel="stylesheet" href="NinoStyle.css">
            <style>
                 #graph-container { height: 100%; width: 100%; }
            </style>
            <script src="/lib/d3.v7.min.js"></script>
            <script src="/lib/d3-graphviz.js"></script>
            <script>
                window.d3 = d3; // Ensure d3 is available globally for d3-graphviz
            </script>

            <div id="graph-container"></div>
        `;
    }

    connectedCallback() {
        const graphContainer = this.shadowRoot.querySelector('#graph-container');
        let graph = window.d3.select(graphContainer).graphviz({ useWorker: false });

        window.d3.text("/api/schema.dot")
            .then(dot => {
                if (!dot) {
                    console.error("Received empty dot source for transformation plan.");
                    return;
                }
                graph.renderDot(dot, () => this.attachClickHandlers())
                    .on("end", function () {
                        const { width, height } = this.getBBox();
                        const containerWidth = graphContainer.clientWidth;
                        const containerHeight = graphContainer.clientHeight;
                        const scale = 0.5;
                        const x = (containerWidth - width * scale) / 2;
                        const y = (containerHeight - height * scale) / 2;
                        const initialTransform = window.d3.zoomIdentity.translate(x, y).scale(scale);
                        window.d3.select(this)
                            .call(window.d3.zoom().transform, initialTransform);

                    });
            })
            .catch(error => console.error("Failed to load schema.dot:", error));
    }
}


customElements.define('nino-graphviz', NinoGraphviz);
