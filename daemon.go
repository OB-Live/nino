package main

import (
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
	r.Get("/api/mask/{folderName}/{tableName}", createMaskFile(&projectData, inputPaths, fileMap))

	// API routes for external tool integration
	r.Get("/api/files", listFilesHandler(inputPaths))
	r.Get("/api/file/*", getFileHandler(inputPaths))
	r.Post("/api/file/*", updateFileHandler(inputPaths, &projectData))

	// API route for pimo execution
	r.Post("/api/pimo/exec", pimoExecHandler())

	// API routes for exec actions
	r.Post("/api/exec/playbook/{folder}/{filename}", execCommandHandler())
	r.Post("/api/exec/pull/{folder}/{filename}", execCommandHandler())


	// // API routes
	// // r.Get("/api/page", serveIndexPage())            // Serve the html using api
	// r.Get("/api/schema.{format:(dot|svg|png)}", serveSchema(&projectData))
	// r.Get("/api/schema/{folder}.{format:(dot|svg|png)}", serveSchema(&projectData))
	// r.Get("/api/plot/{folder}/{tableName}", servePlot(projectData))
	// r.Get("/api/playbook/{folder}", servePlaybook(&projectData))
	// r.Get("/api/mask/{folderName}/{tableName}", createMaskFile(&projectData, inputPaths, fileMap))

	// // API routes for external tool integration
	// r.Get("/api/files", listFilesHandler(inputPaths)) // This route is for listing files, not for serving a specific file
	// r.Get("/api/file/{filepath}", getFileHandler(inputPaths))
	// r.Post("/api/file/{filepath:*}", updateFileHandler(inputPaths, &projectData))

	// // API route for pimo execution
	// r.Post("/api/pimo/exec", pimoExecHandler())

	// // API routes for exec actions
	// r.Post("/api/exec/playbook/{folder}/{filename}", execCommandHandler())
	// r.Post("/api/exec/pull/{folder}/{filename}", execCommandHandler())

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
			w.Header().Set("Content-Type", "text/css; charset=utf-8")
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

		filePath := filepath.Join(basePath, fmt.Sprintf("%s-masking.yaml", tableName))

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
			// w.Header().Set("Content-Type", "text/vnd.graphviz")
			// w.Header().Set("Content-Disposition", `attachment; filename="schema.dot"`)
			w.Write([]byte(dotString))
			// return // Explicitly return here

		case "svg", "png":
			cmd := exec.Command("dot", "-T"+format)
			cmd.Stderr = io.Discard // Silence warnings by redirecting stderr
			cmd.Stdin = strings.NewReader(dotString)

			output, err := cmd.Output() // Use Output() to get only stdout
			if err != nil {
				if len(output) == 0 {
					// If there's an error AND no output, it's a fatal error.
					log.Printf("Error executing dot command for format %s: %v. No output was generated.", format, err)
					http.Error(w, "Failed to generate graph image", http.StatusInternalServerError)
					return
				}
				// If there's an error but we still got some output, log it as a warning and proceed.
				log.Printf("Warning: dot command for format %s exited with an error but still produced output. Error: %v", format, err)
				// If there's an error AND no output, it's a fatal error.
				log.Printf("Error executing dot command for format %s: %v. Output: %s", format, err, string(output))
				http.Error(w, "Failed to generate graph image", http.StatusInternalServerError)
				return
			}

			if len(output) == 0 {
				http.Error(w, "Generated graph image is empty", http.StatusInternalServerError)
				return
			}

			if format == "svg" {
				w.Header().Set("Content-Type", "image/svg+xml")
				w.Header().Set("Content-Disposition", `attachment; filename="schema.svg"`)
			} else {
				w.Header().Set("Content-Type", "image/png")
				w.Header().Set("Content-Disposition", `attachment; filename="schema.png"`)
			}
			w.Write(output)
		default:
			http.Error(w, fmt.Sprintf("Unsupported format: %s", format), http.StatusBadRequest)
		}
	}
}

// servePlaybook generates and returns the DOT graph for a playbook.
func servePlaybook(projectData *ProjectData) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		folderName := chi.URLParam(r, "folder")
		if folderData, ok := (*projectData)[folderName]; ok {
			if folderData.Playbook != nil {
				dotString := generateAnsiblePlaybookGraph(folderData.Playbook)
				// w.Header().Set("Content-Type", "text/vnd.graphviz")
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
			w.Header().Set("Content-Type", "text/vnd.graphviz")
			dotPlaceholder := fmt.Sprintf(`digraph G { label="No plot data available for %s"; node [shape=box]; "No Data"; }`, tableName)
			w.Write([]byte(dotPlaceholder))
			// Return a placeholder image instead of a dot graph
			w.Header().Set("Content-Type", "image/png")
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

		w.Header().Set("Content-Type", "image/png")
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

// listFilesHandler serves a JSON structure of all discovered YAML files.
func listFilesHandler(inputPaths []string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		// The top-level structure should be a map with "Workspace" as the key,
		// and its value an array of items (files or folders).
		workspaceItems := make([]interface{}, 0)

		// Helper function to recursively build the file tree for a given directory
		// Returns an array of items (files or nested folders)
		var buildFolderContent func(folderPath string) ([]interface{}, error)
		buildFolderContent = func(folderPath string) ([]interface{}, error) {
			content := make([]interface{}, 0)
			entries, err := os.ReadDir(folderPath)
			if err != nil {
				return nil, err
			}

			for _, entry := range entries {
				name := entry.Name()
				// Skip hidden files and folders, and the 'public' folder
				if strings.HasPrefix(name, ".") || name == "public" {
					continue // Just skip this entry
				}

				entryPath := filepath.Join(folderPath, name)

				if entry.IsDir() {
					// Recursively get content for the subfolder
					subfolderContent, err := buildFolderContent(entryPath)
					if err != nil {
						return nil, err // Propagate actual errors
					}
					// If the subfolder has content, add it as a nested object
					if len(subfolderContent) > 0 {
						nestedFolder := make(map[string][]interface{})
						nestedFolder[name] = subfolderContent
						content = append(content, nestedFolder)
					}
				} else {
					// It's a file, append its name to the current folder's content
					if strings.HasSuffix(name, ".yaml") || strings.HasSuffix(name, ".yml") {
						content = append(content, name)
					}
				}
			}
			return content, nil
		}

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
				folderName := filepath.Base(basePath)
				folderContent, err := buildFolderContent(basePath)
				if err != nil {
					http.Error(w, fmt.Sprintf("Failed to build file tree for %s: %v", basePath, err), http.StatusInternalServerError)
					return
				}
				if len(folderContent) > 0 {
					nestedFolder := make(map[string][]interface{})
					nestedFolder[folderName] = folderContent
					workspaceItems = append(workspaceItems, nestedFolder)
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

		w.Header().Set("Content-Type", "application/json")
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
			if err != nil { return "", err }
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
			if err != nil { return "", err }
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
		maskFile, err := os.CreateTemp("", "mask-*.yaml")
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
		cmd.Stdin = strings.NewReader(req.JSON)
		cmd.Stdout = w // Pipe command output directly to the HTTP response writer

		// Execute the command
		if err := cmd.Run(); err != nil {
			http.Error(w, fmt.Sprintf("Failed to execute pimo command: %v", err), http.StatusInternalServerError)
			return
		}
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

		w.Header().Set("Content-Type", "text/plain")
		w.Write([]byte(responseOutput))
	}
}
