# Gemini Project Best Practices and Structure

This document outlines the recommended best practices and project structure for the Gemini project. Adhering to these guidelines ensures consistency, maintainability, and scalability of the codebase.

## Project Structure

The project follows a modular and layered architecture.

```
nino/
├── public/
│   ├── img/
│   ├── lib/
│   ├── nino/
│   │   ├── NinoApp.js
│   │   ├── NinoConstants.js
│   │   ├── NinoDialog.js
│   │   ├── NinoEditor.js
│   │   ├── NinoExecution.js
│   │   ├── NinoGraphviz.js
│   │   ├── LinoAnalyse.js
│   │   ├── NinoStyle.css
│   │   ├── NinoTransformation.js
│   │   ├── NinoWorkspace.js
│   │   └── index.html
│   └── ...
├── daemon.go
├── parser.go
├── renderer.go
└── README.md
```

### `public/`
This directory contains all client-side assets that are served directly by the web server.

*   **`img/`**: Image files used in the frontend.
*   **`lib/`**: Third-party JavaScript libraries (e.g., jQuery, Monaco Editor, D3.js, jstree). These are typically minified and should not be directly modified.
*   **`nino/`**: Contains the core frontend application files, organized by Web Component.
    *   **`NinoApp.js`**: The main application orchestrator, handling global state, event listeners, and interactions between major components.
    *   **`NinoConstants.js`**: Defines constants, static examples, and utility functions shared across the frontend.
    *   **`NinoDialog.js`**: Web Component for generic popup/dialog functionality.
    *   **`NinoEditor.js`**: Web Component for the main code editor area, managing Monaco Editor instances and tabs.
    *   **`NinoExecution.js`**: Web Component for the input/output execution panel, also using Monaco Editors.
    *   **`NinoGraphviz.js`**: Web Components for rendering various graph visualizations (e.g., `transformation-plan`, `playbook-plan`, `table-stats`).
    *   **`LinoAnalyse.js`**: Web Component for displaying table statistics.
    *   **`NinoStyle.css`**: Global CSS styles for the application, including theming variables. all styling for the application is here nothing  in the web components
    *   **`NinoTransformation.js`**: Web Component for displaying transformation-related plans.
    *   **`NinoWorkspace.js`**: Web Component for the collapsible sidebar, managing static examples and the file tree.
    *   **`index.html`**: The main HTML file, serving as the entry point for the single-page application.

### Backend (`.go` files)

*   **`daemon.go`**: Contains the main server logic, API route definitions, and handlers for backend services (e.g., file operations, PIMO execution, graph generation).
*   **`parser.go`**: Responsible for parsing various YAML configuration files (tables, relations, data connectors, masking rules, playbooks) into Go data structures.
*   **`renderer.go`**: Handles the generation of Graphviz DOT strings and image plots from the parsed data.

### Documentation

*   **`README.md`**: Provides a high-level overview of the project, its features, and how to set it up.

## Testing

### Backend Testing with Bruno (Folder Structure)

The `./tests/bruno/` folder contains a Bruno API collection with automated tests for each backend endpoint, organized into subfolders. This structured collection can be imported into the Bruno client to ensure API functionality and regression detection.

## Default Context Items

The following files should be loaded by default as context items for Gemini Code Assist:

*   `public/nino/NinoApp.js`
*   `public/nino/NinoConstants.js`
*   `public/nino/NinoDialog.js`
*   `public/nino/NinoEditor.js`
*   `public/nino/NinoExecution.js`
*   `public/nino/NinoGraphviz.js`
*   `public/nino/LinoAnalyse.js`
*   `public/nino/NinoStyle.css`
*   `public/nino/NinoTransformation.js`
*   `public/nino/NinoWorkspace.js`
*   `public/nino/index.html`
*   `daemon.go`
*   `main.go`
*   `parser.go`
*   `renderer.go`
*   `README.md`

## Best Practices

### Frontend (Web Components, JavaScript, CSS)

1.  **Modularity and Encapsulation**:
    *   Each major UI element should be a self-contained Web Component (`<nino-editor>`, `<nino-execution>`, etc.).
    *   Use Shadow DOM (`mode: 'open'`) for style and DOM encapsulation within components to prevent global style conflicts.
    *   **Important**: Components should not directly manipulate the DOM of other components.
    *   Components should communicate primarily through custom events (`dispatchEvent` and `addEventListener`) rather than direct DOM manipulation of other components.

2.  **State Management**:
    *   Persist user preferences and UI state (e.g., sidebar collapse, active tabs, panel sizes) using `localStorage` to enhance user experience across sessions.
    *   Avoid global variables where possible; pass data explicitly between components or use a centralized state management pattern if the application complexity grows.

3.  **Performance**:
    *   Lazy load Monaco Editor instances within their respective components (`NinoEditor.js`, `NinoExecution.js`) to reduce initial load time.
    *   Optimize rendering of large data (e.g., graph visualizations) using libraries like D3.js, ensuring efficient DOM updates.
    *   Debounce or throttle expensive operations (e.g., resizing, input events) to maintain UI responsiveness.

4.  **Accessibility**:
    *   Ensure all interactive elements have appropriate ARIA attributes (`role`, `aria-label`, `aria-expanded`, etc.) for screen reader compatibility.
    *   Provide keyboard navigation for all interactive components.

5.  **Code Quality**:
    *   Use `const` and `let` consistently.
    *   Follow a consistent coding style (e.g., ESLint with a predefined style guide).
    *   Write clear, concise, and well-documented code.
    *   Handle errors gracefully, providing user feedback where appropriate.

### Backend (Go)

1.  **API Design**:
    *   Follow RESTful principles for API endpoints, using appropriate HTTP methods and status codes.
    *   Ensure API endpoints are well-documented and provide clear input/output specifications.
    *   Implement robust error handling and return meaningful error messages.

2.  **Security**:
    *   Sanitize all user inputs to prevent injection attacks.
    *   Validate file paths and access to prevent directory traversal vulnerabilities.
    *   Handle temporary files securely, ensuring they are properly cleaned up.

3.  **Performance**:
    *   Optimize file I/O operations.
    *   Use concurrency (goroutines) where appropriate to handle multiple requests efficiently.
    *   Cache frequently accessed data to reduce redundant computations.

4.  **Modularity**:
    *   Separate concerns into distinct packages or files (e.g., `parser.go` for parsing, `renderer.go` for rendering).
    *   Use clear and descriptive function names.

### General

1.  **Version Control**: Use Git for version control, with clear commit messages and a branching strategy (e.g., Git Flow).
2.  **Testing**: Implement unit and integration tests for both frontend and backend components to ensure correctness and prevent regressions.
3.  **Documentation**: Maintain up-to-date documentation for the project setup, architecture, API endpoints, and component usage.
4.  **Theming**: Utilize CSS variables for theming, allowing easy customization of the application's look and feel.

By adhering to these practices, the Gemini project aims to deliver a high-quality, maintainable, and user-friendly application.
