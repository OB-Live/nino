// Create a class for the element
class PopupInfo extends HTMLElement {
  constructor() {
    // Always call super first in constructor
    super();
  }

  connectedCallback() {
    // Create a shadow root
    const shadow = this.attachShadow({ mode: "open" });

    // Create spans
    const wrapper = document.createElement("span");
    wrapper.setAttribute("class", "wrapper");

    const icon = document.createElement("span");
    icon.setAttribute("class", "icon");
    icon.setAttribute("tabindex", 0);

    const info = document.createElement("span");
    info.setAttribute("class", "info");

    // Take attribute content and put it inside the info span
    const text = this.getAttribute("data-text");
    info.textContent = text;

    // Insert icon
    let imgUrl;
    if (this.hasAttribute("img")) {
      imgUrl = this.getAttribute("img");
    } else {
      imgUrl = "img/default.png";
    }

    const img = document.createElement("img");
    img.src = imgUrl;
    icon.appendChild(img);

    // Apply external styles to the shadow dom
    const linkElem = document.createElement("link");
    linkElem.setAttribute("rel", "stylesheet");
    linkElem.setAttribute("href", "style.css");

    // Attach the created elements to the shadow dom
    shadow.appendChild(linkElem);
    shadow.appendChild(wrapper);
    wrapper.appendChild(icon);
    wrapper.appendChild(info);
  }
}

// Define the new element
customElements.define("popup-info", PopupInfo);
  
  
  // <!-- Dialogs moved to the end of body for better DOM management by jQuery UI -->
  // <div id="dialog" title="Column's data distribution" style="display:none;">
  //   <p>Would you like to <a target="_blank" href="#" id="dialog-create-button">create a mask</a></p>
  //   <img id="dialog-image" src="" alt="Image" style="width: 100%;" />
  // </div>
  // <div id="execution-dialog" title="Ansible playbook execution" style="display:none;">
  //   <div id="execution-graph-container" style="width: 100%; height: 100%;"></div>
  // </div>
  