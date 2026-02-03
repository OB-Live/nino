package main

import (
	"flag"
	"fmt"
	"log"
	"os"

	"github.com/davecgh/go-spew/spew"
)

// Global flags
var (
	daemonMode bool
	port       string
	baseFolder string
	baseTable  string
	plotColumn string
)

func main() {
	// flag.BoolVar(&daemonMode, "daemon", false, "Run in daemon mode (web server).")
	flag.BoolVar(&daemonMode, "d", false, "Run in daemon mode (web server).")
	// flag.StringVar(&port, "port", "2442", "Port for the web server.")
	flag.StringVar(&port, "p", "2442", "Port for the web server. ")
	// flag.StringVar(&baseFolder, "folder", "", "Base folder to run nino from.")

	flag.StringVar(&baseTable, "t", "", "Table to run nino from. ")
	// flag.StringVar(&plotColumn, "column", "", "Base column to run nino from.")
	flag.StringVar(&plotColumn, "c", "", "Column to run nino from. ")

	flag.Parse()

	inputPaths := flag.Args()
	// Ensure at least one file or folder path is provided.
	if len(inputPaths) == 0 {
		log.Fatalf("Error: No input files or folders provided. Usage: %s <file/folder paths...>", os.Args[0])
	}

	fileMap, err := findYAMLFiles(inputPaths)
	if err != nil {
		log.Fatalf("Error finding YAML files: %v", err)
	}

	// Create a flat list for logging purposes
	var fileList []string
	for file := range fileMap {
		fileList = append(fileList, file)
	}
	log.Printf("Found %d YAML files to process: %v", len(fileList), fileList)

	schemas, err := inferAllSchemas(fileMap)
	if err != nil {
		log.Fatalf("Error during schema inference: %v", err)
	}

	// Debugging: print the inferred schemas
	spew.Config.MaxDepth = 3
	// spew.Dump(schemas)

	// Check if we are in plotting mode. Pass fileMap for daemon mode.
	handleExecutionMode(schemas, fileMap, inputPaths, baseTable, plotColumn, daemonMode, port)
}

// handleExecutionMode decides whether to generate plots or the main graph.
func handleExecutionMode(projectData ProjectData, fileMap map[string]string, inputPaths []string, plotTable, plotColumn string, daemonMode bool, port string) {
	if daemonMode {
		log.Println("Starting in daemon mode...")
		startDaemon(projectData, fileMap, inputPaths, port)
		return
	}
	if plotTable != "" {
		if plotColumn != "" {
			log.Printf("Generating single plot for table '%s', column '%s'", plotTable, plotColumn)
			err := generateSinglePlotForColumn(projectData, plotTable, plotColumn)
			if err != nil {
				log.Fatalf("Failed to generate single plot: %v", err)
			}
		} else {
			log.Printf("Generating composite plot for table '%s'", plotTable)
			err := generatePlotForTable(projectData, plotTable)
			if err != nil {
				log.Fatalf("Failed to generate plot: %v", err)
			}
		}
	} else {
		// Default mode: generate the main graph.
		dotString := generateCombinedDotGraph(projectData)
		writeFile("schema.dot", dotString)
		// dotJS := fmt.Sprintf("const dot = `%s`;", dotString)
		// writeFile("schema.js", dotJS)
	}
}

func createDirIfNotExist(dir string) {
	if _, err := os.Stat(dir); os.IsNotExist(err) {
		err = os.MkdirAll(dir, 0755)
		if err != nil {
			log.Fatalf("Failed to create directory %s: %v", dir, err)
		}
	}
}

// writeFile saves content to a file and logs a success message.
func writeFile(filename, content string) {
	if err := os.WriteFile(filename, []byte(content), 0666); err != nil {
		log.Fatalf("Failed to write %s: %v", filename, err)
	}
	fmt.Printf("✅ Fichier %s généré avec succès.\n", filename)
}
