// Create a class for the element
class NinoDialog extends HTMLElement {
  constructor() {
    // Always call super first in constructor
    super();
  }

  connectedCallback() {
    const shadow = this.attachShadow({ mode: "open" });

    const template = document.createElement("template");
    template.innerHTML = `
      <link rel="stylesheet" href="NinoStyle.css">
      <style>
        :host {
          position: absolute;
          z-index: 1000;
          border: 1px solid #ccc;
          background-color: #252526;
          padding: 10px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        }
        .dialog-container {
          display: flex;
          flex-direction: column;
        }
        .dialog-container > * {
            margin-bottom: 5px;
        }
        .dialog-container > *:last-child {
            margin-bottom: 0;
        }
        .buttons {
            display: flex;
            justify-content: flex-end;
        }
        .buttons button {
            margin-left: 5px;
        }
        input {
            background-color: #3c3c3c;
            color: #ccc;
            border: 1px solid #555;
        }
      </style>
      <div class="dialog-container">
        <label id="label"></label>
        <input type="text" id="pathname"/>
        <div class="buttons">
          <button id="cancel-btn">Cancel</button>
          <button id="ok-btn">OK</button>
        </div>
      </div>
    `;

    shadow.appendChild(template.content.cloneNode(true));

    this.shadowRoot.getElementById('ok-btn').addEventListener('click', this._onOk.bind(this));
    this.shadowRoot.getElementById('cancel-btn').addEventListener('click', this._onCancel.bind(this));
    this.shadowRoot.getElementById('pathname').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        this._onOk();
      } else if (e.key === 'Escape') {
        this._onCancel();
      }
    });
  }

  open(x, y, label, defaultValue, onOk) {
    this.style.left = `${x}px`;
    this.style.top = `${y}px`;
    this.shadowRoot.getElementById('label').textContent = label;
    const input = this.shadowRoot.getElementById('pathname');
    input.value = defaultValue;
    this._onOkCallback = onOk;
    document.body.appendChild(this);
    input.focus();
    input.select();
  }

  _onOk() {
    if (this._onOkCallback) {
      const value = this.shadowRoot.getElementById('pathname').value;
      this._onOkCallback(value);
    }
    this.close();
  }

  _onCancel() {
    this.close();
  }

  close() {
    if (this.parentNode) {
      this.parentNode.removeChild(this);
    }
  }
}

// Define the new element
customElements.define("nino-dialog", NinoDialog);
