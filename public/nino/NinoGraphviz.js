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
                 #graph-container svg { width: 100%; height: 100%; }
            </style>
            <script src="/lib/d3.v7.min.js"></script>
            <script src="/lib/d3-graphviz.js"></script>
            <script>
                window.d3 = d3; // Ensure d3 is available globally for d3-graphviz
            </script>

            <div id="graph-container"></div>
        `;
        this._graphviz = null;
    }

    connectedCallback() {
        this.render();
    }

    attributeChangedCallback(name, oldValue, newValue) {
        if (name === 'url' && oldValue !== newValue) {
            this.render();
        }
    }

    render() {
        const url = this.getAttribute('url');
        if (!url) {
            return;
        }

        const graphContainer = this.shadowRoot.querySelector('#graph-container');
        if (!this._graphviz) {
            this._graphviz = window.d3.select(graphContainer).graphviz({ useWorker: false , fit: true});
        }

        fetch(url)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                return response.text();
            })
            .then(dot => {
                 if (dot) {
                    this._graphviz.renderDot(dot);
                } else {
                    console.error(`Received empty dot source from ${url}`);
                }
            })
            .catch(error => console.error(`Failed to load dot source from ${url}:`, error));
    }
}

customElements.define('nino-graphviz', NinoGraphviz);
