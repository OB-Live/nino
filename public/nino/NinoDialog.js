// Create a class for the element
class NinoDialog extends HTMLElement {
  constructor() {
    // Always call super first in constructor
    super();
    this.hidden = true;
    this.attachShadow({ mode: 'open' });
    this.shadowRoot.innerHTML = `<link rel="stylesheet" href="NinoStyle.css">
      <style>
        :host {
          position: absolute;
          z-index: 1000;
          background: var(--sidebar-background);
           color: black;
        }
        :host([hidden]) {
            display: none;
        }
        .dialog-container {
          display: flex;
          flex-direction: column;
          gap: 4px;
          padding: 6px 6px;
          border: 2px solid var(--sidebar-border-color)

        }  
        .buttons {
            display: flex;
            justify-content: flex-end;
            gap: 5px;
        }
        input {
            background-color: #4b4b4bff;
            color: #ccc;
            border: 1px solid #555;
            padding: 2px;
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
  }

  connectedCallback() { 

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
    this.hidden = false;
    this.style.left = `${x}px`;
    this.style.top = `${y}px`;
    this.shadowRoot.getElementById('label').textContent = label;
    const input = this.shadowRoot.getElementById('pathname');
    input.value = defaultValue;
    this._onOkCallback = onOk;
    input.focus();
    input.select();
  }

  async _onOk() {
    if (this._onOkCallback) {
      const value = this.shadowRoot.getElementById('pathname').value;
      await this._onOkCallback(value);
    }
    this.close();
  }

  _onCancel() {
    this.close();
  }

  close() {
    this.hidden = true;
  }
}

// Define the new element
customElements.define("nino-dialog", NinoDialog);
