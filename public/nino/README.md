# NINŎ Frontend Application

This directory contains the frontend application for NINŎ, a data masking playground. The application is built as a Single Page Application (SPA) using Web Components, providing a modular and interactive user interface for visualizing data transformation plans, executing masking operations, and managing workspace files.

## Architecture Overview

The frontend is structured around custom Web Components, promoting reusability, encapsulation, and clear separation of concerns. Key technologies employed include:

-   **Web Components**: Custom elements (`<nino-editor>`, `<nino-execution>`, `<nino-workspace>`, etc.) are used to build the UI.
-   **Monaco Editor**: Integrated for rich code editing experiences (YAML, JSON, shell scripts). Each editor instance is now isolated within its respective component.
-   **D3.js & d3-graphviz**: Utilized for rendering interactive graph visualizations of data schemas and execution plans.
-   **jstree**: Powers the file system tree view in the sidebar for workspace navigation.
-   **jQuery**: Used for general DOM manipulation and event handling.
-   **Shadow DOM**: Each Web Component leverages Shadow DOM for style encapsulation, preventing style conflicts and promoting component independence.
-   **Event-Driven Communication**: Components communicate with each other and the main application logic through custom events.
-   **State Persistence**: User interface state, such as sidebar collapse status, open tabs, and panel sizes, is persisted using `localStorage`.
-   **Backend Interaction**: The frontend communicates with a Go backend via a RESTful API for data fetching, execution, and file management.

## Core Components

### 1. `index.html`

The main entry point of the application. It sets up the basic HTML structure, loads all necessary libraries (jQuery, Monaco Editor, D3.js, jstree, etc.), and defines the top-level layout of the application by embedding the custom Web Components:

-   `<nino-workspace>`: The collapsible sidebar.
-   `<nino-editor>`: The central code editor and graph visualization panel.
-   `<nino-execution>`: The input/output execution panel.

### 2. `NinoApp.js`

This script orchestrates the overall application logic and interactions between the main Web Components. It handles:

-   **UI State Management**: Persists and restores the collapsed state of the sidebar, open file tabs, and the sizes of the main editor and execution panels.
-   **Backend API Calls**: Manages calls to the backend for PIMO execution (`/api/pimo/exec`), playbook/dataconnector execution (`/api/exec/playbook`, `/api/exec/pull`), and table statistics (`/api/plot`).
-   **Event Handling**: Listens for custom events dispatched by child components (e.g., `tab-activated`, `execute-nino`, `select-example`) and reacts accordingly.
-   **Resizing Logic**: Contains the `makeHorizontalResizable` function to manage the horizontal split between the editor and execution panels.

### 3. `NinoEditor.js` (`<nino-editor>`)

This Web Component is responsible for the central editing and visualization area.

-   **Monaco Editor**: Hosts Monaco Editor instances for editing YAML and JSON files.
-   **Tabbed Interface**: Provides tabs for the main YAML editor, a graph visualization, and dynamically opened files from the workspace.
-   **File Management**: Allows opening new files in dedicated tabs, switching between them, and closing them.
-   **Syntax Highlighting**: Automatically applies syntax highlighting based on file extensions (e.g., `.yaml`, `.json`).
-   **Graph Integration**: Displays graph visualizations by embedding the `<transformation-plan>` component.
-   **Monaco Initialization**: Manages its own Monaco Editor instance, including configuration and layout.

### 4. `NinoExecution.js` (`<nino-execution>`)

This Web Component manages the input and output panels for executing data masking and transformation tasks.

-   **Input Editor**: A Monaco Editor instance for providing input (e.g., JSON data for PIMO, shell commands for playbooks).
-   **Output Editor**: A read-only Monaco Editor instance to display the results of executions.
-   **Execution Trigger**: Features an "Execute" button that dispatches an event to `NinoApp.js` to trigger backend processing.
-   **Resizing**: Includes a vertical resize handle to adjust the height of the input and output editors.
-   **Monaco Initialization**: Manages its own Monaco Editor instances, ensuring proper isolation and layout.

### 5. `NinoWorkspace.js` (`<nino-workspace>`)

This Web Component implements the collapsible sidebar, providing navigation and file browsing capabilities.

-   **Static Examples**: Presents a list of predefined data masking examples in an accordion-style menu.
-   **Workspace File Tree**: Displays a dynamic file tree fetched from the `/api/files` endpoint using `jstree`, allowing users to browse and select files within their project.
-   **File Actions**: Dispatches events to `NinoApp.js` to open selected files in the `<nino-editor>`.
-   **Collapse/Expand**: Manages its own collapsed state, which is persisted across sessions.

### 6. `NinoGraphviz.js`

This script defines several Web Components responsible for rendering various visualizations:

-   **`<transformation-plan>`**: Renders the overall data schema graph by fetching DOT data from `/api/schema.dot` and using D3.js/d3-graphviz.
-   **`<playbook-plan>`**: Visualizes Ansible playbook execution plans by fetching DOT data from `/api/playbook/{folder}`.
-   **`<table-stats>`**: Displays data distribution plots for specific table columns (fetched as PNG images from `/api/plot/{folder}/{tableName}`) and provides a button to create boilerplate masking files via `/api/mask/{folderName}/{tableName}`.

### 7. `NinoConstants.js`

A utility file that defines:

-   `staticExamples`: Predefined data masking examples used in the sidebar.
-   `MASK_KEYWORDS`: A list of keywords related to masking operations.
-   `HELPER_LOAD_METADATA`: Helper functions for loading metadata.
-   `api`: Backend API endpoint definitions.
-   `fileTypes`: Definitions for various file types.

### 8. `NinoStyle.css`

Contains the global CSS styling for the application, including:

-   **CSS Variables**: Defines theming variables for colors, fonts, and layout.
-   **Layout**: Styles for the main container, header, sidebar, and panels.
-   **Component-Specific Styles**: Styles for tabs, buttons, editors, and other UI elements.
-   **Responsive Design**: Basic styles for adapting to different screen sizes.

## Frontend Features

-   **Interactive Data Schema Visualization**: Explore data transformation plans as interactive graphs.
-   **Code Editing with Monaco Editor**: Edit YAML and JSON files with syntax highlighting, auto-completion (implicitly via Monaco's language features), and validation.
-   **Dynamic Workspace Navigation**: Browse project files through a tree view in the sidebar.
-   **Execution Environment**: Dedicated panels for providing input data and viewing execution results from backend services (PIMO, Ansible).
-   **Table Statistics & Masking File Generation**: Visualize data distribution for tables and easily generate boilerplate masking configuration files.
-   **Persistent UI State**: The application remembers your preferred layout, open files, and sidebar state across sessions.
-   **Modular Design**: Built with Web Components for maintainability and extensibility.
-   **Theming**: Utilizes CSS variables for easy theme customization.

## How it Works (High-Level Flow)

1.  **Initialization**: `index.html` loads the core `NinoApp.js` and custom Web Components. `NinoApp.js` initializes the application, restores UI state, and sets up event listeners.
2.  **Monaco Editor Setup**: `NinoEditor.js` and `NinoExecution.js` each load and configure their own Monaco Editor instances, ensuring they are ready for use.
3.  **Workspace Loading**: `NinoWorkspace.js` fetches the project file structure from `/api/files` and renders it as a jstree.
4.  **User Interaction**:
    *   Selecting a file in the workspace or an example loads its content into the `<nino-editor>`'s YAML tab and potentially sets up the `<nino-execution>`'s input.
    *   Clicking "Execute" in `<nino-execution>` sends the current YAML and input JSON to the backend.
    *   Switching to the "Graph" tab in `<nino-editor>` triggers the rendering of the transformation plan.
    *   Clicking on a table in the graph or selecting a table from the workspace can open `<table-stats>` in the output panel of `<nino-execution>`.
5.  **Backend Communication**: API calls are made to the Go backend to fetch graph data, execute PIMO/Ansible, list files, and create new files.
6.  **Rendering**: D3.js/d3-graphviz renders SVG graphs, while Monaco Editor handles code display.

This architecture provides a flexible and powerful platform for interacting with data masking and transformation pipelines, offering both visual insights and direct control over execution.
```
