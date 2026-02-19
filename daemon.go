package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"io/fs"
	"log"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
)

const (
	CONTENT_TYPE        = "Content-Type"
	CONTENT_TYPE_GRAPH  = "text/vnd.graphviz"
	CONTENT_TYPE_JSON   = "application/json"
	CONTENT_TYPE_YAML   = "application/yaml"
	CONTENT_DISPOSITION = "Content-Disposition"
	CONTENT_TYPE_IMAGE  = "image/png"
	SUFFIX_MASKING      = "-masking.yaml"
	SUFFIX_SH           = ".sh"
)

// startDaemon initializes and starts the web server.
func startDaemon(projectData ProjectData, fileMap map[string]string, inputPaths []string, port string, publicFS fs.FS) {
	r := chi.NewRouter()

	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(middleware.Compress(5)) // Add gzip compression middleware

	// API routes
	r.Get("/api/schema.{format:(dot|svg|png)}", serveSchema(&projectData))
	r.Get("/api/schema/{folder}.{format:(dot|svg|png)}", serveSchema(&projectData))
	r.Get("/api/plot/{folder}/{tableName}", servePlot(projectData))
	r.Get("/api/playbook/{folder}", servePlaybook(&projectData))
	r.Get("/api/new/mask/{folderName}/{tableName}", createMaskFile(&projectData, inputPaths, fileMap))

	// New API routes for folder and file creation
	r.Get("/api/folder/*", createFolderHandler())
	// r.Post("/api/new/mask/*", createFileHandler("mask", &projectData, inputPaths))
	r.Get("/api/new/playbook/*", createFileHandler("playbook", &projectData, inputPaths))
	r.Get("/api/new/dataconnectors/*", createFileHandler("dataconnectors", &projectData, inputPaths))
	r.Get("/api/new/bash/*", createFileHandler("bash", &projectData, inputPaths))

	// API routes for file handling
	r.Get("/api/files", listFilesHandler(inputPaths))
	r.Get("/api/file/*", getFileHandler(inputPaths))
	r.Post("/api/file/*", updateFileHandler(inputPaths, &projectData))

	// API routes that executes Command lines actions
	r.Post("/api/exec/pimo", pimoExecHandler())
	r.Post("/api/exec/playbook/{folder}/{filename}", execCommandHandler())
	r.Get("/api/exec/lino/fetch/{folder}/{filename}", fetchLinoExampleHandler(inputPaths, fileMap))
	r.Post("/api/exec/pull/{folder}/{filename}", execCommandHandler())

	// New API route for reloading schemas
	r.Post("/api/reload", reloadHandler(&projectData, inputPaths))

	log.Printf("Starting web server on http://localhost:%s", port)

	// Serve files from the 'public' directory. This should be the last route.
	// workDir, _ := os.Getwd()
	r.Handle("/*", customFileServer(publicFS))

	if err := http.ListenAndServe(":"+port, r); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}

// customFileServer wraps http.FileServer to set correct MIME types for CSS.
func customFileServer(fs fs.FS) http.Handler {
	fsh := http.FileServer(http.FS(fs))
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.HasSuffix(r.URL.Path, ".css") {
			w.Header().Set(CONTENT_TYPE, "text/css; charset=utf-8")
		}
		fsh.ServeHTTP(w, r)
	})
}

// createMaskFile handles the creation of a boilerplate masking file.
func createMaskFile(projectData *ProjectData, inputPaths []string, fileMap map[string]string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		folderName := chi.URLParam(r, "folderName")
		tableName := chi.URLParam(r, "tableName")
		currentProjectData := *projectData
		// Find the table to get its columns
		tableFolder, table, err := findTableLocation(currentProjectData, tableName, folderName)
		if err != nil {
			log.Printf("Creating mask.yaml for '%s'.'%s': %v", folderName, tableName, err)
			http.Error(w, err.Error(), http.StatusNotFound)
			return
		}

		// Find the base path for the folder to construct the file path.
		// This logic finds the base path from the original input paths.
		basePath, ok := findBasePathForFolder(inputPaths, tableFolder, fileMap)
		if !ok {
			http.Error(w, fmt.Sprintf("Could not determine file path for folder '%s'", tableFolder), http.StatusInternalServerError)
			return
		}
		if info, err := os.Stat(basePath); err == nil && info.IsDir() {
			basePath = filepath.Join(basePath, tableFolder)
		}

		filePath := filepath.Join(basePath, fmt.Sprintf("%s"+SUFFIX_MASKING, tableName))

		var sb strings.Builder
		sb.WriteString("version: \"1\"\n")
		sb.WriteString("seed: 42\n")
		sb.WriteString("masking:\n")
		for _, col := range table.Columns {
			sb.WriteString(fmt.Sprintf("  - selector:\n      jsonpath: \"%s\"\n    mask:\n      # regex: \"\"\n", col.Name))
		}

		if err := os.WriteFile(filePath, []byte(sb.String()), 0644); err != nil {
			http.Error(w, fmt.Sprintf("Failed to create masking file: %v", err), http.StatusInternalServerError)
			return
		}

		// Reload schemas
		reloadSchemas(projectData, inputPaths)
		w.WriteHeader(http.StatusCreated)
		fmt.Fprintf(w, "File %s created successfully", filePath)
	}
}

func findBasePathForFolder(inputPaths []string, folderName string, fileMap map[string]string) (string, bool) {
	// This function needs to find the correct base directory where the folder `folderName` lives.
	// The logic in `inferAllSchemas` determines the `folderName` (relPath). We need to reverse that to find the correct output path.
	for _, path := range inputPaths {
		info, err := os.Stat(path)
		if err != nil {
			continue // Ignore invalid paths
		}
		if info.IsDir() {
			// If an input path is a directory, check if `folderName` is a direct subdirectory.
			if filepath.Base(path) == folderName {
				return filepath.Dir(path), true
			}
			// Check for subdirectories inside this input path
			if _, err := os.Stat(filepath.Join(path, folderName)); err == nil {
				return path, true
			}
		} else if filepath.Base(filepath.Dir(path)) == folderName {
			return filepath.Dir(path), true
		}
	}
	return "", false
}

// serveSchema generates and returns the DOT graph schema.
func serveSchema(projectData *ProjectData) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		format := chi.URLParam(r, "format")
		folderName := chi.URLParam(r, "folder")

		var dotString string
		// Add a recover block to catch panics from generateCombinedDotGraph
		defer func() {
			if r := recover(); r != nil {
				log.Printf("Panic in generateCombinedDotGraph: %v", r)
				http.Error(w, "Internal server error during graph generation", http.StatusInternalServerError)
			}
		}()

		if folderName != "" {
			dotString = generateCombinedDotGraph(*projectData, folderName)
		} else {
			dotString = generateCombinedDotGraph(*projectData)
		}

		if dotString == "" {
			log.Println("Error: generateCombinedDotGraph returned an empty string. Returning 500.")
			http.Error(w, "Failed to generate graph: empty DOT string", http.StatusInternalServerError)
			return
		}

		log.Printf("Generated DOT string for format '%s', folder '%s':\n", format, folderName)

		switch format {
		case "dot":
			w.Header().Set(CONTENT_TYPE, CONTENT_TYPE_GRAPH)
			w.Header().Set("CONTENT_DISPOSITION", `attachment; filename="schema.dot"`)
			w.Write([]byte(dotString))
			// return // Explicitly return here

		case "svg", "png":
			cmd := exec.Command("dot", "-T"+format)
			cmd.Stderr = io.Discard // Silence warnings by redirecting stderr
			cmd.Stdin = strings.NewReader(dotString)

			output, err := cmd.Output() // Use Output() to get only stdout
			if err != nil {
				// If there's an error but we still got some output, log it as a warning and proceed.
				log.Printf("Warning: dot command for format %s exited with an error but still produced output. Error: %v", format, err)
			}

			if len(output) == 0 {
				http.Error(w, "Generated graph image is empty", http.StatusInternalServerError)
				return
			}

			if format == "svg" {
				w.Header().Set(CONTENT_TYPE, "image/svg+xml")
				w.Header().Set("CONTENT_DISPOSITION", `attachment; filename="schema.svg"`)
			} else {
				w.Header().Set(CONTENT_TYPE, CONTENT_TYPE_IMAGE)
				w.Header().Set("CONTENT_DISPOSITION", `attachment; filename="schema.png"`)
			}
			w.Write(output)
		default:
			http.Error(w, fmt.Sprintf("Unsupported format: %s", format), http.StatusBadRequest)
		}
	}
}

// createFolderHandler creates a new folder recursively.
func createFolderHandler() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		folderName := chi.URLParam(r, "*")
		if folderName == "" {
			http.Error(w, "Folder name is required", http.StatusBadRequest)
			return
		}

		// Sanitize folderName to prevent directory traversal
		cleanFolderName := filepath.Clean(folderName)
		if strings.HasPrefix(cleanFolderName, "..") || filepath.IsAbs(cleanFolderName) {
			http.Error(w, "Invalid folder name: cannot use absolute or parent paths", http.StatusBadRequest)
			return
		}

		// For simplicity, new folders are created relative to the current working directory
		fullPath := cleanFolderName

		err := os.MkdirAll(fullPath, 0755) // 0755 gives read/write/execute for owner, read/execute for group/others
		if err != nil {
			log.Printf("Error creating folder '%s': %v", fullPath, err)
			http.Error(w, fmt.Sprintf("Failed to create folder: %v", err), http.StatusInternalServerError)
			return
		}

		w.WriteHeader(http.StatusCreated)
		fmt.Fprintf(w, "Folder '%s' created successfully", fullPath)
	}
}

// createFileHandler creates a new file with boilerplate content based on type.
func createFileHandler(fileType string, projectData *ProjectData, inputPaths []string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		path := chi.URLParam(r, "*")
		// filename := chi.URLParam(r, "filename")

		// if folderName == "" {
		// 	http.Error(w, "Folder name is required", http.StatusBadRequest)
		// 	return
		// }

		content, ok := templates[fileType]
		if !ok {
			http.Error(w, "Unsupported file type", http.StatusBadRequest)
			return
		}
		switch fileType {
		case "mask":
			if !strings.HasSuffix(path, SUFFIX_MASKING) {
				path += SUFFIX_MASKING
			}
		case "playbook":
			path += "/playbook.yaml"
		case "dataconnectors":
			path += "/dataconnector.yaml"

		case "bash":
			if !strings.HasSuffix(path, SUFFIX_SH) {
				path += SUFFIX_SH
			}
		}
		// For simplicity, new files are created relative to the current working directory
		// or within the first input path if available.
		basePath := "." // Default to current directory
		if len(inputPaths) > 0 {
			basePath = inputPaths[0]
			info, err := os.Stat(basePath)
			if err == nil && !info.IsDir() {
				basePath = filepath.Dir(basePath) // If inputPath is a file, use its directory
			}
		}

		// fullPath := filepath.Join(basePath, folderName, finalFilename)

		// Ensure the directory exists
		dir := filepath.Dir(path)
		if err := os.MkdirAll(dir, 0755); err != nil {
			log.Printf("Error creating directory '%s': %v", dir, err)
			http.Error(w, fmt.Sprintf("Failed to create directory: %v", err), http.StatusInternalServerError)
			return
		}

		if err := os.WriteFile(path, []byte(content), 0644); err != nil {
			log.Printf("Error creating file '%s': %v", path, err)
			http.Error(w, fmt.Sprintf("Failed to create file: %v", err), http.StatusInternalServerError)
			return
		}

		// Reload schemas after file creation
		reloadSchemas(projectData, inputPaths)

		w.WriteHeader(http.StatusCreated)
		fmt.Fprintf(w, "File '%s' created successfully", path)
	}
}

// reloadHandler resets and re-parses all YAML files.
func reloadHandler(projectData *ProjectData, inputPaths []string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		reloadSchemas(projectData, inputPaths)
		w.WriteHeader(http.StatusOK)
		fmt.Fprint(w, "Schemas reloaded successfully")
	}
}

// servePlaybook generates and returns the DOT graph for a playbook.
func servePlaybook(projectData *ProjectData) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		folderName := chi.URLParam(r, "folder")
		if folderData, ok := (*projectData)[folderName]; ok {
			if folderData.Playbook != nil {
				dotString := generateAnsiblePlaybookGraph(folderData.Playbook)
				w.Write([]byte(dotString))
				return
			}
		}
		http.Error(w, fmt.Sprintf("No playbook.yaml found for folder '%s'", folderName), http.StatusNotFound)
	}
}

// servePlot generates and returns a plot image for a given table.
func servePlot(projectData ProjectData) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		folderName := chi.URLParam(r, "folder")
		tableName := chi.URLParam(r, "tableName")
		if tableName == "" {
			http.Error(w, "Table name is required", http.StatusBadRequest)
			return
		}

		imgBytes, err := generatePlotForTableToMemory(projectData, tableName, folderName)
		if err != nil {
			log.Printf("Error generating plot for table %s: %v", tableName, err)
			// Return a placeholder DOT graph instead of an image
			w.Header().Set(CONTENT_TYPE, "text/vnd.graphviz")
			dotPlaceholder := fmt.Sprintf(`digraph G { label="No plot data available for %s"; node [shape=box]; "No Data"; }`, tableName)
			w.Write([]byte(dotPlaceholder))
			// Return a placeholder image instead of a dot graph
			w.Header().Set(CONTENT_TYPE, CONTENT_TYPE_IMAGE)
			// Create a 1x1 transparent PNG
			w.Write([]byte{
				0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
				0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
				0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4, 0x89, 0x00, 0x00, 0x00,
				0x0a, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
				0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49,
				0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
			})
			return
		}

		w.Header().Set(CONTENT_TYPE, CONTENT_TYPE_IMAGE)
		w.Write(imgBytes)
	}
}

// reloadSchemas finds all YAML files and re-infers the project data structure.
func reloadSchemas(projectData *ProjectData, inputPaths []string) {
	newFileMap, err := findYAMLFiles(inputPaths)
	if err != nil {
		log.Printf("Error finding YAML files during reload: %v", err)
		return
	}
	newSchemas, err := inferAllSchemas(newFileMap)
	if err != nil {
		log.Printf("Error inferring schemas during reload: %v", err)
		return
	}
	// Atomically update the project data
	*projectData = newSchemas
	log.Println("Successfully reloaded schemas.")
}

// buildFileTree recursively builds a tree of files and folders for a given path.
// It skips hidden files/folders and the "public" directory.
func buildFileTree(path string) ([]interface{}, error) {
	entries, err := os.ReadDir(path)
	if err != nil {
		return nil, err
	}

	content := make([]interface{}, 0, len(entries))
	for _, entry := range entries {
		name := entry.Name()
		// Skip hidden files and folders, and the 'public' folder
		if strings.HasPrefix(name, ".") || name == "public" {
			continue
		}

		entryPath := filepath.Join(path, name)

		if entry.IsDir() {
			subfolderContent, err := buildFileTree(entryPath)
			if err != nil {
				return nil, err
			}
			if len(subfolderContent) > 0 {
				content = append(content, map[string][]interface{}{name: subfolderContent})
			}
		} else if strings.HasSuffix(name, ".yaml") || strings.HasSuffix(name, ".yml") {
			content = append(content, name)
		}
	}

	return content, nil
}

// listFilesHandler serves a JSON structure of all discovered YAML files.
func listFilesHandler(inputPaths []string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		// The top-level structure should be a map with "Workspace" as the key,
		// and its value an array of items (files or folders).
		workspaceItems := make([]interface{}, 0)

		for _, basePath := range inputPaths {
			// Normalize basePath to ensure consistent path separators
			basePath = filepath.Clean(basePath)

			info, err := os.Stat(basePath)
			if err != nil {
				log.Printf("Error stating path %s: %v", basePath, err)
				continue
			}

			if info.IsDir() {
				// If basePath is a directory, its name becomes a top-level folder under "Workspace"
				folderContent, err := buildFileTree(basePath)
				if err != nil {
					http.Error(w, fmt.Sprintf("Failed to build file tree for %s: %v", basePath, err), http.StatusInternalServerError)
					return
				}
				if len(folderContent) > 0 {
					folderName := filepath.Base(basePath)
					if folderName == "." {
						// If the folder is '.', flatten its content into the workspace
						workspaceItems = append(workspaceItems, folderContent...)
					} else {
						workspaceItems = append(workspaceItems, map[string][]interface{}{folderName: folderContent})
					}
				}
			} else {
				// If basePath is a file, add it directly to "Workspace"
				fileName := filepath.Base(basePath)
				if strings.HasSuffix(fileName, ".yaml") || strings.HasSuffix(fileName, ".yml") {
					workspaceItems = append(workspaceItems, fileName)
				}
			}
		}

		fileTree := map[string]interface{}{
			"Workspace": workspaceItems,
		}

		w.Header().Set(CONTENT_TYPE, CONTENT_TYPE_JSON)
		if err := json.NewEncoder(w).Encode(fileTree); err != nil {
			http.Error(w, "Failed to encode file list to JSON", http.StatusInternalServerError)
		}
	}
}

// getFileHandler serves the content of a specific file.
func getFileHandler(inputPaths []string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		filepathParam := strings.TrimPrefix(chi.URLParam(r, "*"), "/")
		log.Printf("getFileHandler: Received request for filepath: %s", filepathParam)

		fullPath, err := findSecureFilePath(inputPaths, filepathParam)
		if err != nil {
			log.Printf("getFileHandler: Error finding secure file path for %s: %v", filepathParam, err)
			http.Error(w, err.Error(), http.StatusNotFound)
			return
		}
		log.Printf("getFileHandler: Serving file from full path: %s", fullPath)
		http.ServeFile(w, r, fullPath)
	}
}

// updateFileHandler replaces a file with the content from the POST body.
func updateFileHandler(inputPaths []string, projectData *ProjectData) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		filepathParam := strings.TrimPrefix(chi.URLParam(r, "*"), "/")
		log.Printf("updateFileHandler: Received request to update filepath: %s", filepathParam)

		fullPath, err := findSecureFilePath(inputPaths, filepathParam)
		if err != nil {
			log.Printf("updateFileHandler: Error finding secure file path for %s: %v", filepathParam, err)
			http.Error(w, err.Error(), http.StatusNotFound)
			return
		}

		filePath := fullPath

		body, err := io.ReadAll(r.Body)
		log.Printf("updateFileHandler: Attempting to write to file: %s", filePath)
		if err != nil {
			http.Error(w, "Failed to read request body", http.StatusInternalServerError)
			return
		}
		defer r.Body.Close()

		if err := os.WriteFile(filePath, body, 0644); err != nil {
			http.Error(w, "Failed to write file", http.StatusInternalServerError)
			return
		}

		// After updating the file, reload all schemas
		reloadSchemas(projectData, inputPaths)

		w.WriteHeader(http.StatusOK)
		fmt.Fprintf(w, "File %s updated successfully", filepathParam)
	}
}

// findSecureFilePath locates the absolute path for a file within the allowed input directories.
func findSecureFilePath(inputPaths []string, relativeFilePath string) (string, error) {
	for _, basePath := range inputPaths {
		// Attempt 1: Join the basePath and the relative path.
		// This works for paths like `nino -d .` and URL `/api/file/petstore/source/analyze.yaml`
		candidatePath1 := filepath.Join(basePath, relativeFilePath)
		if _, err := os.Stat(candidatePath1); err == nil {
			cleanPath, err := filepath.Abs(candidatePath1)
			if err != nil {
				return "", err
			}
			log.Printf("findSecureFilePath: File found at %s", cleanPath)
			return cleanPath, nil
		}

		// Attempt 2: Check if the relative path is complete from the parent of the basePath.
		// This works for paths like `nino -d ./petstore` and URL `/api/file/petstore/source/analyze.yaml`
		// where `basePath` is `./petstore` and `relativeFilePath` is `petstore/source/analyze.yaml`.
		parentOfBasePath := filepath.Dir(basePath)
		candidatePath2 := filepath.Join(parentOfBasePath, relativeFilePath)
		if _, err := os.Stat(candidatePath2); err == nil {
			cleanPath, err := filepath.Abs(candidatePath2)
			if err != nil {
				return "", err
			}
			log.Printf("findSecureFilePath: File found at %s", cleanPath)
			return cleanPath, nil
		}
	}

	return "", fmt.Errorf("file '%s' not found in any configured input path", relativeFilePath)
}

// PimoExecRequest defines the structure for the /pimo/exec request body.
type PimoExecRequest struct {
	YAML string `json:"yaml"`
	JSON string `json:"json"`
}

// pimoExecHandler handles the execution of the pimo CLI tool.
func pimoExecHandler() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req PimoExecRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, fmt.Sprintf("Invalid request body: %v", err), http.StatusBadRequest)
			return
		}

		// Define temporary file paths
		maskFile, err := os.CreateTemp(".", "mask-*.yaml")
		if err != nil {
			http.Error(w, "Failed to create temporary mask file", http.StatusInternalServerError)
			return
		}
		defer os.Remove(maskFile.Name()) // Clean up the file afterwards

		// Write the YAML and JSON content to temporary files
		if _, err := maskFile.Write([]byte(req.YAML)); err != nil {
			http.Error(w, fmt.Sprintf("Failed to write mask file: %v", err), http.StatusInternalServerError)
			return
		}
		maskFile.Close()

		// Prepare the command
		cmd := exec.Command("pimo", "-c", maskFile.Name())
		var stderr bytes.Buffer
		cmd.Stderr = &stderr
		cmd.Stdin = strings.NewReader(req.JSON)

		// Execute the command
		output, err := cmd.Output()
		if err != nil {
			log.Printf("Error executing pimo command %s: %v\n%s", cmd, err, stderr.String())
			http.Error(w, fmt.Sprintf("Failed to execute pimo command: %v\n%s", err, stderr.String()), http.StatusInternalServerError)
			return
		}

		w.Header().Set(CONTENT_TYPE, "application/json")
		w.Write(output)
	}
}

// execCommandHandler creates a handler that executes a given command and returns its output.
func execCommandHandler() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		body, err := io.ReadAll(r.Body)
		if err != nil {
			http.Error(w, "Failed to read request body", http.StatusInternalServerError)
			return
		}
		defer r.Body.Close()

		script := string(body)
		if script == "" {
			http.Error(w, "No script provided to execute", http.StatusBadRequest)
			return
		}

		log.Printf("Executing command: %s", script)

		cmd := exec.Command("bash", "-c", script)
		output, err := cmd.CombinedOutput()
		if err != nil {
			http.Error(w, fmt.Sprintf("Failed to execute command: %v\nOutput:\n%s", err, string(output)), http.StatusInternalServerError)
			return
		}
		responseOutput := fmt.Sprintf("$ %s\n%s", script, string(output))

		w.Header().Set(CONTENT_TYPE, "text/plain")
		w.Write([]byte(responseOutput))
	}
}

// fetchLinoExampleHandler fetches the first line of a table as an example for masking files.
func fetchLinoExampleHandler(inputPaths []string, fileMap map[string]string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		folderName := chi.URLParam(r, "folder")
		fileName := chi.URLParam(r, "filename")

		if !strings.HasSuffix(fileName, SUFFIX_MASKING) {
			http.Error(w, "File is not a masking file", http.StatusBadRequest)
			return
		}

		tableName := strings.TrimSuffix(fileName, SUFFIX_MASKING)

		// Find the base path for the folder to execute the lino command from.
		basePath, ok := findBasePathForFolder(inputPaths, folderName, fileMap)
		if !ok {
			http.Error(w, fmt.Sprintf("Could not determine base path for folder '%s'", folderName), http.StatusInternalServerError)
			return
		}

		// Change to the correct directory before executing the command
		originalDir, err := os.Getwd()
		if err != nil {
			http.Error(w, fmt.Sprintf("Failed to get current working directory: %v", err), http.StatusInternalServerError)
			return
		}
		defer os.Chdir(originalDir) // Restore original directory

		targetDir := filepath.Join(basePath, folderName)
		if err := os.Chdir(targetDir); err != nil {
			http.Error(w, fmt.Sprintf("Failed to change directory to '%s': %v", targetDir, err), http.StatusInternalServerError)
			return
		}

		cmd := exec.Command("lino", "pull", "--table", tableName, "source", "-l", "1")
		output, err := cmd.CombinedOutput()
		if err != nil {
			log.Printf("Error executing lino pull command: %v\nOutput:\n%s", err, string(output))
			http.Error(w, fmt.Sprintf("Failed to fetch example data: %v\n%s", err, string(output)), http.StatusInternalServerError)
			return
		}

		w.Header().Set(CONTENT_TYPE, "text/plain")
		w.Write(output)
	}
}

// templates contains the boilerplate content for different file types.
var templates = map[string]string{
	"mask": `version: "1"
seed: 42
masking:
  - selector:
      jsonpath: "$.id"
    mask:
      randomUUID: {}
`,
	"playbook": `---
- name: LINO Petstore Example
  hosts: localhost
  connection: local
  become: false
  gather_facts: true
  environment:
    PATH: "{{ ansible_env.PATH }}:{{ install_dir }}"
    ADMIN: admin
  vars:
    #  Business variables
    workspace: "./" 
    truncate_target: true
    # fifos_dir: "/tmp/lino"
    source_db: "postgresql://localhost:5432/jhpetclinic?sslmode=disable -P ADMIN -u jhpetclinic"
    target_db: "postgresql://localhost:5433/jhpetclinic?sslmode=disable -P ADMIN -u jhpetclinic"
    id_json: "{{ fifos_dir }}/{{ idName }}.jsonl"
    id_mask: "{{ fifos_dir }}/{{ idName }}-masked.jsonl"
    # yaml_mask: "{{ workspace }}/target/{{ idName }}-masking.yml"

  pre_tasks:
    - name: "Example Docker environnement"
      # become: true
      community.docker.docker_compose_v2:
        project_src: "{{ workspace }}"
        files:
          - docker-compose.yml 
        state: present
        wait: true                   
        # build: never                 
      register: compose_output

    - name: Debug compose status
      debug:
        var: compose_output.actions
    
    - name: "Cron task"
      ansible.builtin.cron:
        name: "check dirs"
        minute: "0"
        hour: "0"
        job: "ansible-playbook -i tests/inventory tests/petstore-test.yml --connection=local -c ansible.cfg > cron.log"
        # state: present
        state: absent


  
  #### BUSINESS LOGIC HERE ####
  roles:
    - name: OB-Live.nino
  # tasks:
  #   - include_tasks: tasks/main.yml  
      vars:
        entities:
          - name: "owners"
            id_json: "{{ fifos_dir }}/owners.jsonl"
          - name: "pets"
            id_json: "{{ fifos_dir }}/pets.jsonl"
            id_mask: "{{ fifos_dir }}/pets-masking.jsonl"
            yaml_mask: "{{ workspace }}/target/pets-masking.yml"  # Required
            # id_json: "{{ fifos_dir }}/{{ idName }}.jsonl"         # Optional
            # id_mask: "{{ fifos_dir }}/{{ idName }}-masked.jsonl"  # Optional  
`,
	"dataconnectors": `version: v1
dataconnectors:
  - name: source
    url: postgresql://jhpetclinic@bdd_prod:5432/jhpetclinic?sslmode=disable
    readonly: true
    password:
      valueFromEnv: ADMIN
  - name: target
    url: postgresql://jhpetclinic@bdd_qualif:5433/jhpetclinic?sslmode=disable
    readonly: false
    password:
      valueFromEnv: ADMIN

`,
	"bash": `#!/bin/bash
echo "Hello from bash script!"
`,
}
