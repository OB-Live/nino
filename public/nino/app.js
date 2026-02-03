document.addEventListener("DOMContentLoaded", () => {
  // --- DOM Elements ---
  const sidebar = document.getElementById("sidebar");
  const sidebarToggle = document.getElementById("sidebar-toggle");
  const mainContent = document.getElementById("main-content");
  const rightPanel = document.getElementById("right-panel");
  const examplesContainer = document.getElementById("examples-container");
  const executeBtn = document.getElementById("execute-btn");
  const tabs = document.querySelectorAll(".tab-button");
  const tabContents = document.querySelectorAll(".tab-content");
  const tabHeader = document.querySelector(".tab-header");
  const downloadGraphBtn = document.getElementById("download-graph-btn");

  // --- Monaco Editor Instances ---
  let yamlEditor, inputEditor, outputEditor;

  // --- State ---
  let examples = [];
  const editorInstances = {};
  let workspaceFiles = null; // To cache the fetched file list
  let mainEditorFileType = 'masking'; // To track what's in the main 'yaml' editor

  // --- Monaco Editor Initialization ---
  require.config({
    paths: {
      vs: "https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.33.0/min/vs",
    },
  });

  require(["vs/editor/editor.main"], () => {
    const commonOptions = {
      theme: "vs-dark",
      minimap: { enabled: false },
    };

    editorInstances["yaml"] = monaco.editor.create(
      document.getElementById("yaml-editor-container"),
      { ...commonOptions, language: "yaml" }
    );
    yamlEditor = editorInstances["yaml"]; // Keep alias for existing logic
    // Add a custom property to the main editor instance to track its file type
    editorInstances["yaml"]._currentFileType = 'masking';

    editorInstances["input"] = monaco.editor.create(
      document.getElementById("input-editor-container"),
      { ...commonOptions, language: "json" }
    );
    inputEditor = editorInstances["input"];

    editorInstances["output"] = monaco.editor.create(
      document.getElementById("output-viewer-container"),
      { ...commonOptions, language: "json", readOnly: true }
    );
    outputEditor = editorInstances["output"];

    loadInitialData();
    // Setup custom validation and autocompletion for YAML
    setupYamlValidationAndCompletion(monaco, jsyaml, editorInstances);
    restoreUiState();
  });

  // --- Data Loading ---
  async function loadInitialData() {
    const staticExamples = await getStaticExamples();
    const workspaceExamples = await fetchWorkspaceFiles();

    const finalCategories = staticExamples.map((category) => {
      if (category.name === "Workspace") {
        return { ...category, examples: workspaceExamples };
      }
      return category;
    });

    examples = finalCategories;
    renderExamples(examples);
    restoreUiState(); // Restore UI after examples are loaded

    // Load default example
    if (examples.length > 0 && examples[0].examples.length > 0) {
      const defaultExample = examples[0].examples[0];
      yamlEditor.setValue(defaultExample.yaml);
      inputEditor.setValue(defaultExample.input);
    }
  }

  async function fetchWorkspaceFiles() {
    try {
      const response = await fetch("/api/files");
      if (!response.ok) return [];
      const files = await response.json();
      workspaceFiles = files; // Cache the files
      const workspaceExamples = [];
      for (const folder in files) {
        files[folder].forEach((file) => {
          if (file.endsWith(".yaml") || file.endsWith(".yml")) {
            const path = `${folder}/${file}`;
            workspaceExamples.push({
              id: `workspace-${path}`,
              name: `${file}`,
              description: `${folder}`,
              url: `/api/file/${folder}/${file}`,
              input: `{}`,
              yaml: "",
            });
          }
        });
      }
      return workspaceExamples;
    } catch (error) {
      console.error("Failed to fetch workspace files:", error);
      return [];
    }
  }

  // --- UI Rendering ---
  function renderExamples(categories) {
    examplesContainer.innerHTML = "";
    categories.forEach((category) => {
      const item = document.createElement("div");
      item.className = "accordion-item";

      const trigger = document.createElement("button");
      trigger.className = "accordion-trigger";
      trigger.innerHTML = `${category.name} <span>&#9660;</span>`;

      const content = document.createElement("div");
      content.className = "accordion-content";

      category.examples.forEach((example) => {
        const btn = document.createElement("button");
        btn.className = "example-btn";
        btn.innerHTML = `<div class="example-name">${example.name}</div><div class="example-desc">${example.description}</div>`;
        btn.onclick = () => handleSelectExample(example);
        content.appendChild(btn);
      });

      trigger.onclick = () => {
        const isExpanded = content.style.maxHeight;
        if (isExpanded) {
          content.style.maxHeight = null;
        } else {
          content.style.maxHeight = content.scrollHeight + "px";
        }
      };

      item.appendChild(trigger);
      item.appendChild(content);
      examplesContainer.appendChild(item);
    });
  }

  // --- Event Handlers ---
  sidebarToggle.addEventListener("click", () => {
    sidebar.classList.toggle("collapsed");
    const isCollapsed = sidebar.classList.contains("collapsed");
    localStorage.setItem("nino-sidebar-collapsed", isCollapsed);

    // Adjust left panel width to keep right panel width constant
    const leftPanel = document.getElementById("left-panel");
    const sidebarWidth = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--sidebar-width'));
    const currentLeftWidth = leftPanel.offsetWidth;

    if (isCollapsed) {
      leftPanel.style.width = `${currentLeftWidth + sidebarWidth}px`;
    } else {
      leftPanel.style.width = `${currentLeftWidth - sidebarWidth}px`;
    }
  });

  // --- Dialog and Graph Logic ---
  let graphviz;

  function initializeGraph() {
    if (graphviz) return; // Already initialized

    graphviz = d3.select("#graph-view-container").graphviz({ useWorker: false });

    // Replaces the output panel with table statistics
    window.openTableStat = (tableName, folderName) => {
      const outputContainer = document.getElementById("output-viewer-container");
      outputContainer.innerHTML = ''; // Clear the editor
      outputContainer.style.padding = "1em";
      outputContainer.style.overflow = "auto";

      const title = document.createElement('h3');
      title.textContent = `Statistics for ${folderName}/${tableName}`;

      const plotImage = document.createElement('img');
      plotImage.src = `/api/plot/${folderName}/${tableName}`;
      plotImage.style.maxWidth = '100%';
      plotImage.style.border = '1px solid #555';

      const createMaskLink = document.createElement('a');
      createMaskLink.href = `/api/mask/${folderName}/${tableName}`;
      createMaskLink.textContent = 'Create Boilerplate Mask File';
      createMaskLink.className = 'example-btn'; // Reuse style
      createMaskLink.style.display = 'inline-block';
      createMaskLink.style.marginTop = '1em';

      outputContainer.append(title, plotImage, createMaskLink);
      // activateTab(document.querySelector('.tab-button[data-tab="output"]'));
    };

    // Replaces the input panel with the execution graph
    window.openExecutionGraph = (folderName) => {
      const inputContainer = document.getElementById("input-editor-container");
      inputContainer.innerHTML = ''; // Clear the editor content
      const executionGraphviz = d3.select(inputContainer).graphviz({ useWorker: false });
      d3.text(`/api/playbook/${folderName}`).then(dot => {
        executionGraphviz.renderDot(dot).on("end", function () {
          // Set initial zoom to 0.5 and center the graph
          const { width, height } = this.getBBox();
          const container = d3.select(inputContainer);
          const containerWidth = container.node().clientWidth;
          const containerHeight = container.node().clientHeight;
          const scale = 0.5;
          const x = (containerWidth - width * scale) / 2;
          const y = (containerHeight - height * scale) / 2;
          const initialTransform = d3.zoomIdentity.translate(x, y).scale(scale);
          d3.select(this).call(d3.zoom().transform, initialTransform);
        });
      }).catch(error => console.error("Failed to load playbook graph:", error));
      // activateTab(document.querySelector('.tab-button[data-tab="input"]'));
    };
  }

  function loadGraph() {
    initializeGraph();

    d3.text("/api/schema.dot")
      .then(dot => {
        graphviz.renderDot(dot).on("end", function () {
          const savedTransform = localStorage.getItem('nino-graph-transform');
          if (savedTransform) {
            const transform = JSON.parse(savedTransform);
            const d3Transform = d3.zoomIdentity.translate(transform.x, transform.y).scale(transform.k);
            d3.select(this).call(d3.zoom().transform, d3Transform);
          } else {
            // Set initial zoom to 0.5 and center if no saved transform
            const { width, height } = this.getBBox();
            const container = d3.select("#graph-view-container");
            const containerWidth = container.node().clientWidth;
            const containerHeight = container.node().clientHeight;
            const scale = 0.5;
            const x = (containerWidth - width * scale) / 2;
            const y = (containerHeight - height * scale) / 2;
            const initialTransform = d3.zoomIdentity.translate(x, y).scale(scale);
            d3.select(this).call(d3.zoom().transform, initialTransform);
          }
          d3.select(this).on("zoom", () => {
            const transform = d3.zoomTransform(this);
            localStorage.setItem('nino-graph-transform', JSON.stringify(transform));
          });
        });

        // Find the first descriptor and open its table stats and execution graph
        if (workspaceFiles) {
          for (const folderName in workspaceFiles) {
            const descriptorFile = workspaceFiles[folderName].find(f => f.endsWith('-descriptor.yaml'));
            if (descriptorFile) {
              const tableName = descriptorFile.replace('-descriptor.yaml', '');
              openTableStat(tableName, folderName);
              openExecutionGraph(folderName);
              return; // Stop after finding the first one
            }
          }
        }
      });
  }

  downloadGraphBtn.addEventListener("click", (e) => {
    e.stopPropagation(); // Prevent the outside click handler from closing it immediately

    // Remove any existing dialog
    const existingDialog = document.getElementById('download-format-dialog');
    if (existingDialog) {
      existingDialog.remove();
      return;
    }

    // Create the dialog container
    const dialog = document.createElement('div');
    dialog.id = 'download-format-dialog';
    dialog.style.position = 'absolute';
    dialog.style.backgroundColor = '#3c3c3c';
    dialog.style.border = '1px solid #666';
    dialog.style.borderRadius = '5px';
    dialog.style.padding = '5px';
    dialog.style.zIndex = '1001';

    const rect = downloadGraphBtn.getBoundingClientRect();
    dialog.style.top = `${rect.bottom + 5}px`;
    dialog.style.left = `${rect.left}px`;

    // Create format buttons
    ['dot', 'svg', 'png'].forEach(format => {
      const button = document.createElement('button');
      button.textContent = format.toUpperCase();
      button.className = 'example-btn'; // Reuse existing button style
      button.style.margin = '3px';
      button.onclick = () => {
        window.open(`/api/schema.${format}`, '_blank');
        dialog.remove(); // Close dialog after click
      };
      dialog.appendChild(button);
    });

    document.body.appendChild(dialog);

    // Add a one-time event listener to close the dialog when clicking outside
    const closeDialog = (event) => {
      if (!dialog.contains(event.target)) {
        dialog.remove();
        document.removeEventListener('click', closeDialog);
      }
    };
    setTimeout(() => document.addEventListener('click', closeDialog), 0);
  });

  async function handleSelectExample(example) {
    // TODO: fix this later 
    if (example.id.startsWith("workspace-")) {
      openWorkspaceFileInNewTab(example);
      // return;
    }

    // Switch to the main YAML tab for static examples
    const yamlTabButton = document.querySelector('.tab-button[data-tab="yaml"]');
    if (yamlTabButton) {
      activateTab(yamlTabButton);
    }

    // Track the file type being loaded into the main editor
    if (example.url && example.url.includes('/')) {
      mainEditorFileType = example.url.split('/').pop();
    } else {
      mainEditorFileType = 'masking'; // Default for static, non-workspace examples
    }
    editorInstances["yaml"]._currentFileType = mainEditorFileType;

    if (example.yaml) {
      yamlEditor.setValue(example.yaml);
    } else if (example.url) {
      fetch(example.url).then(res => res.text()).then(text => yamlEditor.setValue(text)).catch(err => yamlEditor.setValue(`# Failed to load: ${example.url}`));
    }
    inputEditor.setValue(example.input);
    outputEditor.setValue("");
  }

  async function openWorkspaceFileInNewTab(example) {
    const tabId = `file-tab-${example.id}`;
    const existingTab = document.querySelector(`.tab-button[data-tab="${tabId}"]`);

    if (existingTab) {
      activateTab(existingTab);
      return; // Don't create a duplicate
    }

    // Create new tab button
    const newTabButton = document.createElement("button");
    newTabButton.className = "tab-button";
    newTabButton.dataset.tab = tabId;
    let playButtonHTML = '';
    // Store file info in data attributes for later use
    newTabButton.dataset.fileName = example.name;
    newTabButton.dataset.folderName = example.description;
    if (example.name.includes('playbook') || example.name.includes('dataconnector')) {
      playButtonHTML = `<span class="play-icon"></span>`;
    }
    newTabButton.innerHTML = `<span class="save-icon" style="cursor: pointer;">💾</span>${playButtonHTML}<span>${example.name}</span><span class="close-tab">&times;</span>`;

    tabHeader.appendChild(newTabButton);

    // Create new tab content
    const newTabContent = document.createElement("div");
    newTabContent.id = tabId;
    newTabContent.className = "tab-content";
    newTabContent.className = "tab-content editor-wrapper"; // Use editor-wrapper for 100% height/width
    document.getElementById("left-panel").appendChild(newTabContent);

    // Create Monaco editor in the new tab
    editorInstances[tabId] = monaco.editor.create(newTabContent, {
      theme: "vs-dark",
      minimap: { enabled: false },
      language: "yaml",
    });
    const fileEditor = editorInstances[tabId];

    // Fetch content and set it
    const text = await fetch(example.url).then(res => res.text()).catch(err => `# Failed to load: ${example.url}`);
    fileEditor.setValue(text);
    console.log(fileEditor)

    // Re-run setup to attach validation to the new editor instance
    setupYamlValidationAndCompletion(monaco, jsyaml, { [tabId]: fileEditor });

    // Activate the new tab
    activateTab(newTabButton);

    // Add event listener for the save icon
    newTabButton.querySelector(".save-icon").addEventListener("click", async (e) => {
      e.stopPropagation(); // Prevent tab activation
      const saveIcon = e.target;
      saveIcon.textContent = "⏳"; // Show saving indicator

      try {
        await fetch(`/api/file/${example.description}/${example.name}`, {
          method: "POST",
          headers: { "Content-Type": "application/yaml" },
          body: fileEditor.getValue(),
        });
        saveIcon.textContent = "✅"; // Show success
        setTimeout(() => (saveIcon.textContent = "💾"), 2000); // Revert after 2s
      } catch (error) {
        console.error("Failed to save file:", error);
        saveIcon.textContent = "❌"; // Show error
        setTimeout(() => (saveIcon.textContent = "💾"), 2000);
      }
    });

    // Add event listener for the play icon
    const playIcon = newTabButton.querySelector(".play-icon");
    if (playIcon) {
      playIcon.addEventListener('click', async (e) => {
        e.stopPropagation();
        outputEditor.setValue("Executing...");
        activateTab(document.querySelector('.tab-button[data-tab="output"]'));

        let url = '';
        if (example.name.includes('playbook')) {
          url = `/api/exec/playbook/${example.description}/${example.name}`;
        } else if (example.name.includes('dataconnector')) {
          url = `/api/exec/pull/${example.description}/${example.name}`;
        }
        if (!url) return;

        try {
          const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain' },
            body: inputEditor.getValue()
          });
          const text = await response.text();
          outputEditor.setValue(text);
        } catch (error) {
          outputEditor.setValue(`Error: ${error.message}`);
        }
      });
    }

    // Add event listener for the close button
    newTabButton.querySelector(".close-tab").addEventListener("click", (e) => {
      e.stopPropagation(); // Prevent tab activation
      delete editorInstances[tabId];
      newTabContent.remove();
      newTabButton.remove();
      activateTab(document.querySelector('.tab-button[data-tab="yaml"]')); // Activate default tab
      saveTabsState();
    });
  }

  // Add click listener to the tab header to handle dynamically added tabs
  tabHeader.addEventListener("click", (e) => {
    const tabButton = e.target.closest(".tab-button");
    if (tabButton) {
      activateTab(tabButton);
    }
  });

  executeBtn.addEventListener("click", async () => {
    executeBtn.textContent = "Executing...";
    executeBtn.disabled = true;
    outputEditor.setValue("");

    try {
      const response = await fetch("/api/pimo/exec", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          yaml: yamlEditor.getValue(),
          json: inputEditor.getValue(),
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        outputEditor.setValue(JSON.stringify({ error: `Command execution failed: ${errorText}` }, null, 2));
      } else {
        const resultJson = await response.json();
        outputEditor.setValue(JSON.stringify(resultJson, null, 2));
      }
    } catch (error) {
      outputEditor.setValue(
        JSON.stringify({ error: "API request failed" }, null, 2)
      );
    } finally {
      executeBtn.textContent = "";
      executeBtn.disabled = false;
    }
  });

  function activateTab(tabToActivate) {
    // Deactivate all tabs
    document.querySelectorAll(".tab-button").forEach((t) => t.classList.remove("active"));
    document.querySelectorAll(".tab-content").forEach((c) => c.classList.remove("active"));

    // Activate the selected one
    if (!tabToActivate) return;
    tabToActivate.classList.add("active");
    const contentId = tabToActivate.dataset.tab;
    saveTabsState();
    // The original logic for finding the content element was a bit complex.
    const inputContainer = document.getElementById("input-editor-container");
    const outputContainer = document.getElementById("output-viewer-container");

    // Restore editors if they were replaced by graphs/stats
    if (!inputContainer.querySelector('.monaco-editor')) {
      inputContainer.innerHTML = ''; // Clear graph
      inputContainer.appendChild(editorInstances["input"].getDomNode());
      editorInstances["input"].layout();
    }
    if (!outputContainer.querySelector('.monaco-editor')) {
      outputContainer.innerHTML = ''; // Clear stats
      outputContainer.style.padding = "0"; // Reset style
      outputContainer.style.overflow = "hidden";
      outputContainer.appendChild(editorInstances["output"].getDomNode());
      editorInstances["output"].layout();
    }




    const contentElement = document.getElementById(contentId) ?? document.getElementById(contentId + "-editor-container") ?? document.getElementById(contentId + "-view-container");
    if (contentElement) {
      contentElement.classList.add("active");
      // If there's an editor in this tab, tell it to resize.
      const editor = editorInstances[contentId] || editorInstances[tabToActivate.dataset.tab];
      if (editor) {
        editor.layout();
      }
    }

    // Adjust panel width for graph view
    if (contentId === 'graph') {
      rightPanel.style.width = '80px';
      // Clear editor panels and prepare for graph/stats display
      clearAndPrepareGraphPanels();
      loadGraph();
    } else {
      rightPanel.style.width = '30%'; // Or whatever default you prefer
    }

    // Change input editor language and content based on tab
    const fileName = tabToActivate.dataset.fileName || '';
    const folderName = tabToActivate.dataset.folderName || '';

    if (fileName.includes('dataconnector.yaml')) {
      monaco.editor.setModelLanguage(inputEditor.getModel(), 'shell');
      inputEditor.setValue(`cd ${folderName}
lino table extract source
lino relation extract source
lino analyse source > analyze.yaml`);
    } else if (fileName.includes('playbook.yaml')) {
      monaco.editor.setModelLanguage(inputEditor.getModel(), 'shell');
      inputEditor.setValue(`ansible-playbook ${folderName}/${fileName} --connection=local`);
    } else {
      // Revert to default for other tabs
      monaco.editor.setModelLanguage(inputEditor.getModel(), 'json');
      // If we have a default example loaded, restore its input
      const activeExampleId = localStorage.getItem('nino-active-example-id');
      const example = examples.flatMap(c => c.examples).find(e => e.id === activeExampleId);
      if (example && example.input) {
        inputEditor.setValue(example.input);
      } else {
        inputEditor.setValue('{}');
      }
    }

    // Restore editors if switching away from graph tab
    if (contentId !== 'graph') {
      restoreEditorPanels();
    }
  }

  function clearAndPrepareGraphPanels() {
    // Clear input editor and output editor to make space for graphs/stats
    document.getElementById("input-editor-container").innerHTML = '';
    document.getElementById("output-viewer-container").innerHTML = '';
    document.getElementById("output-viewer-container").style.padding = "0"; // Reset padding
    document.getElementById("output-viewer-container").style.overflow = "hidden"; // Reset overflow
  }

  function restoreEditorPanels() {
    const inputContainer = document.getElementById("input-editor-container");
    const outputContainer = document.getElementById("output-viewer-container");

    // Only restore if the Monaco editor is not already present (i.e., it was replaced by a graph/stats)
    if (!inputContainer.querySelector('.monaco-editor')) {
      inputContainer.innerHTML = ''; // Clear any graph content
      inputContainer.appendChild(editorInstances["input"].getDomNode());
    }
    if (!outputContainer.querySelector('.monaco-editor')) {
      outputContainer.innerHTML = ''; // Clear any stats content
      outputContainer.appendChild(editorInstances["output"].getDomNode());
    }
    editorInstances["input"].layout();
    editorInstances["output"].layout();
  }

  // --- UI State Persistence ---
  function saveTabsState() {
    const openTabs = [];
    document.querySelectorAll(".tab-button").forEach(tab => {
      const tabId = tab.dataset.tab;
      if (tabId.startsWith("file-tab-")) {
        const exampleId = tabId.replace("file-tab-", "");
        // Find the original example data to save it
        for (const category of examples) {
          const example = category.examples.find(ex => ex.id === exampleId);
          if (example) {
            openTabs.push(example);
            break;
          }
        }
      }
    });
    const activeTab = document.querySelector(".tab-button.active")?.dataset.tab;
    localStorage.setItem("nino-open-tabs", JSON.stringify(openTabs));
    localStorage.setItem("nino-active-tab", activeTab);
  }

  async function restoreUiState() {
    // Restore sidebar state
    const isSidebarCollapsed = localStorage.getItem("nino-sidebar-collapsed") === "true";
    if (isSidebarCollapsed) {
      sidebar.classList.add("collapsed");
    }

    // Restore panel sizes
    const hPrevWidth = localStorage.getItem("nino-panel-h-prev");
    const hNextWidth = localStorage.getItem("nino-panel-h-next");
    if (hPrevWidth && hNextWidth) {
      document.getElementById("left-panel").style.width = hPrevWidth;
      document.getElementById("right-panel").style.width = hNextWidth;
    }

    const vPrevHeight = localStorage.getItem("nino-panel-v-prev");
    const vNextHeight = localStorage.getItem("nino-panel-v-next");
    if (vPrevHeight && vNextHeight) {
      document.getElementById("top-panel").style.height = vPrevHeight;
      document.getElementById("bottom-panel").style.height = vNextHeight;
    }
    Object.values(editorInstances).forEach(editor => {
      if (editor) editor.layout();
    });

    // This function can only run after examples are loaded
    if (examples.length === 0) return;

    const savedTabs = localStorage.getItem("nino-open-tabs");
    if (savedTabs) {
      const openTabs = JSON.parse(savedTabs);
      for (const example of openTabs) {
        // This re-uses the existing function to open tabs
        await openWorkspaceFileInNewTab(example);
      }
    }

    // Restore the active tab
    const activeTabId = localStorage.getItem("nino-active-tab");
    let tabToActivate = document.querySelector(`.tab-button[data-tab="${activeTabId}"]`);
    if (!tabToActivate) {
      // Fallback to the default YAML tab if the saved one doesn't exist
      tabToActivate = document.querySelector('.tab-button[data-tab="yaml"]');
    }
    activateTab(tabToActivate);
  }


  // --- Resizable Panels Logic ---
  function makeResizable(handle, prev, next, direction) {
    let isResizing = false;
    handle.addEventListener("mousedown", () => (isResizing = true));
    document.addEventListener("mouseup", () => {
      if (isResizing) {
        if (direction === "horizontal") {
          localStorage.setItem("nino-panel-h-prev", prev.style.width);
          localStorage.setItem("nino-panel-h-next", next.style.width);
        } else {
          localStorage.setItem("nino-panel-v-prev", prev.style.height);
          localStorage.setItem("nino-panel-v-next", next.style.height);
        }
      }
      isResizing = false;
    });
    document.addEventListener("mousemove", (e) => {
      if (!isResizing) return;
      const container = handle.parentElement;
      const rect = container.getBoundingClientRect();
      if (direction === "horizontal") {
        // Set the width of the left panel and let the right one fill the rest
        prev.style.width = `${e.clientX - rect.left}px`;
        next.style.flex = '1';
        // Trigger layout for all editors as their container widths have changed
        Object.values(editorInstances).forEach(editor => {
          if (editor) editor.layout();
        });
      } else {
        const prevHeight = e.clientY - rect.top;
        const nextHeight = rect.bottom - e.clientY;
        prev.style.height = `${prevHeight}px`;
        next.style.height = `${nextHeight}px`;
        // Specifically trigger layout for the input and output editors
        if (editorInstances.input) editorInstances.input.layout();
        if (editorInstances.output) editorInstances.output.layout();
      }
    });
  }

  makeResizable(
    document.getElementById("resize-handle-h"),
    document.getElementById("left-panel"),
    document.getElementById("right-panel"),
    "horizontal"
  );

  makeResizable(
    document.getElementById("resize-handle-v"),
    document.getElementById("top-panel"),
    document.getElementById("bottom-panel"),
    "vertical"
  );


});
