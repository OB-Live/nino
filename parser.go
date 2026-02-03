package main

import (
	"fmt"
	"log"
	"os"
	"path/filepath"
	"strings"

	"gopkg.in/yaml.v3"
)

// Relation defines a single foreign key relationship
type Relation struct {
	Name   string `yaml:"name"`
	Parent Table  `yaml:"parent"`
	Child  Table  `yaml:"child"`
}

// RelationSchema holds the data from a relations.yaml file
type RelationSchema struct {
	Version   string     `yaml:"version"`
	Relations []Relation `yaml:"relations"`
}

// Column defines a table column
type Column struct {
	Name   string `yaml:"name"`
	Export string `yaml:"export"`
}

// Table defines a database table with its columns and keys
type Table struct {
	Name    string   `yaml:"name"`
	Keys    []string `yaml:"keys"`
	Columns []Column `yaml:"columns"`
}

// TableSchema holds the data from a tables.yaml file
type TableSchema struct {
	Version string  `yaml:"version"`
	Tables  []Table `yaml:"tables"`
}

// DataConnector defines a single data source connection.
type DataConnector struct {
	Name     string `yaml:"name"`
	URL      string `yaml:"url"`
	Readonly bool   `yaml:"readonly"`
	Password struct {
		ValueFromEnv string `yaml:"valueFromEnv"`
	} `yaml:"password"`
}

// DataConnectorSchema holds the data from a dataconnector.yaml file.
type DataConnectorSchema struct {
	Version        string          `yaml:"version"`
	DataConnectors []DataConnector `yaml:"dataconnectors"`
}

// MaskingRule defines a single masking rule.
type MaskingRule struct {
	Selector struct {
		Jsonpath string `yaml:"jsonpath"`
	} `yaml:"selector"`
	Mask struct {
		Regex             string `yaml:"regex"`
		RandomChoiceInUri string `yaml:"randomChoiceInUri"`
		Incremental       struct {
			Start     int `yaml:"start"`
			Increment int `yaml:"increment"`
		} `yaml:"incremental"`
	} `yaml:"mask"`
	Masks []struct { // For the 'masks' field which is a list of masks
		AddTransient      string `yaml:"add-transient"`
		RandomChoiceInUri string `yaml:"randomChoiceInUri"`
		Template          string `yaml:"template"`
	} `yaml:"masks"`
}

// IngressDescriptorSchema holds the data from an ingress-descriptor.yaml file (now masking rules).
type IngressDescriptorSchema struct {
	Version string        `yaml:"version"`
	Seed    int           `yaml:"seed"`
	Masking []MaskingRule `yaml:"masking"`
}

// StringMetric holds detailed metrics for string type columns.
type StringMetric struct {
	Lengths []struct {
		Length int     `yaml:"length"`
		Freq   float64 `yaml:"freq"`
	} `yaml:"lengths"`
}

// NumericMetric holds detailed metrics for numeric type columns.
type NumericMetric struct {
	Mean float64 `yaml:"mean"`
}

// AnalyzeColumn holds metric data for a single column from analyze.yaml.
type AnalyzeColumn struct {
	Name       string `yaml:"name"`
	MainMetric struct {
		Count int         `yaml:"count"`
		Min   interface{} `yaml:"min"`
	} `yaml:"mainMetric"`
	StringMetric  StringMetric  `yaml:"stringMetric"`
	NumericMetric NumericMetric `yaml:"numericMetric"`
}

// AnalyzeTable holds metric data for a single table from analyze.yaml.
type AnalyzeTable struct {
	Name       string          `yaml:"name"`
	Columns    []AnalyzeColumn `yaml:"columns"`
	MainMetric struct {
		Count int `yaml:"count"`
	} `yaml:"mainMetric"`
}

// AnalyzeSchema holds the data from an analyze.yaml file.
type AnalyzeSchema struct {
	Database string         `yaml:"database"`
	Tables   []AnalyzeTable `yaml:"tables"`
}

// maskInfo holds the extracted details of a masking rule for easy use.
type maskInfo struct{ maskType, maskValue string }

// FolderData holds all schemas for a single folder.
type FolderData struct {
	Relations      RelationSchema
	DataConnectors DataConnectorSchema
	Analysis       AnalyzeSchema
	Tables         []Table
	Descriptors    map[string]IngressDescriptorSchema
	TargetTables   []Table
	TargetAnalysis AnalyzeSchema
	Playbook       AnsiblePlaybook // Added this line
}

// AnsiblePlaybook holds the data from a playbook.yaml file.
type AnsiblePlaybook []AnsiblePlay

// AnsiblePlay represents a single play in an Ansible playbook.
type AnsiblePlay struct {
	Name     string            `yaml:"name"`
	Hosts    string            `yaml:"hosts"`
	Vars     map[string]string `yaml:"vars"`
	PreTasks []AnsibleTask     `yaml:"pre_tasks"`
	Roles    []AnsibleRole     `yaml:"roles"`
}

// AnsibleTask represents a task within a play.
type AnsibleTask struct {
	Name string `yaml:"name"`
}

// AnsibleRole represents a role within a play.
type AnsibleRole struct {
	Name string `yaml:"name"`
	Vars struct {
		Entities []AnsibleEntity `yaml:"entities"`
	} `yaml:"vars"`
}

// AnsibleEntity represents an entity within a role's variables.
type AnsibleEntity struct {
	Name string `yaml:"name"`
}

// ProjectData is the top-level structure, mapping folder names to their data.
type ProjectData map[string]*FolderData

// inferAllSchemas parses all primary, descriptor, and analysis YAML files.
func inferAllSchemas(fileMap map[string]string) (ProjectData, error) {
	projectData := make(ProjectData)

	for file, basePath := range fileMap {
		baseName := filepath.Base(file)
		dir := filepath.Dir(file)
		var relPath string

		// Determine the relative path to use as the folder/cluster key.
		// If the file's directory is the same as the base path provided during startup,
		// the folder key should be the name of that base directory itself.
		if filepath.Clean(dir) == filepath.Clean(basePath) {
			relPath = filepath.Base(basePath)
		} else {
			// Otherwise, it's in a subdirectory. We take the first-level directory name.
			relPath = strings.Split(strings.TrimPrefix(dir, basePath+string(os.PathSeparator)), string(os.PathSeparator))[0]
		}
		log.Printf("File: %s, BasePath: %s, RelPath: %s", file, basePath, relPath)

		// Ensure a FolderData struct exists for the current path.
		if _, ok := projectData[relPath]; !ok {
			projectData[relPath] = &FolderData{
				Descriptors: make(map[string]IngressDescriptorSchema),
			}
		}
		folder := projectData[relPath]

		// Route file parsing based on filename.
		switch {
		case baseName == "relations.yaml":
			parseRelations(file, folder)
		case baseName == "dataconnector.yaml":
			parseDataConnector(file, folder)
		case baseName == "analyze.yaml":
			parseAnalyze(file, folder)
		case strings.HasSuffix(baseName, "-descriptor.yaml"):
			parseDescriptor(file, folder)
		case baseName == "target-tables.yaml":
			parseTargetTables(file, folder)
		case baseName == "target-analyze.yaml":
			parseTargetAnalyze(file, folder)
		case baseName == "playbook.yaml":
			parsePlaybook(file, folder)
		default:
			// Assume any other .yaml file contains table definitions.
			parseTables(file, folder)
		}
	}

	return projectData, nil
}

// Helper functions to parse specific YAML file types.

func parseRelations(file string, folder *FolderData) {
	var relSchema RelationSchema
	if err := parseYAMLFile(file, &relSchema); err == nil {
		folder.Relations = relSchema
	}
}

func parseDataConnector(file string, folder *FolderData) {
	var dcSchema DataConnectorSchema
	if err := parseYAMLFile(file, &dcSchema); err == nil {
		folder.DataConnectors = dcSchema
	}
}

func parseAnalyze(file string, folder *FolderData) {
	var analysisSchema AnalyzeSchema
	if err := parseYAMLFile(file, &analysisSchema); err == nil {
		folder.Analysis = analysisSchema
	}
}

func parseDescriptor(file string, folder *FolderData) {
	var desc IngressDescriptorSchema
	if err := parseYAMLFile(file, &desc); err == nil {
		tableName := strings.TrimSuffix(filepath.Base(file), "-descriptor.yaml")
		folder.Descriptors[tableName] = desc
	}
}

func parseTargetTables(file string, folder *FolderData) {
	var tableSchema TableSchema
	if err := parseYAMLFile(file, &tableSchema); err == nil {
		folder.TargetTables = append(folder.TargetTables, tableSchema.Tables...)
	}
}

func parseTargetAnalyze(file string, folder *FolderData) {
	var analysisSchema AnalyzeSchema
	if err := parseYAMLFile(file, &analysisSchema); err == nil {
		folder.TargetAnalysis = analysisSchema
	}
}

func parsePlaybook(file string, folder *FolderData) {
	var playbook AnsiblePlaybook
	if err := parseYAMLFile(file, &playbook); err == nil {
		folder.Playbook = playbook
	}
}

func parseTables(file string, folder *FolderData) {
	var tableSchema TableSchema
	if err := parseYAMLFile(file, &tableSchema); err == nil {
		folder.Tables = append(folder.Tables, tableSchema.Tables...)
	}
}

// findYAMLFiles recursively searches input paths for .yaml and .yml files.
func findYAMLFiles(paths []string) (map[string]string, error) {
	fileMap := make(map[string]string)
	for _, path := range paths {
		info, err := os.Stat(path)
		if err != nil {
			return nil, fmt.Errorf("invalid path %s: %w", path, err)
		}

		basePath := path
		if !info.IsDir() {
			if strings.HasSuffix(path, ".yaml") || strings.HasSuffix(path, ".yml") {
				fileMap[path] = filepath.Dir(path) // For single files, the base is their own dir.
			}
			continue
		}

		// It's a directory, walk it recursively.
		err = filepath.WalkDir(basePath, func(p string, d os.DirEntry, err error) error {
			if err != nil {
				return err
			}
			if !d.IsDir() && (strings.HasSuffix(p, ".yaml") || strings.HasSuffix(p, ".yml")) {
				fileMap[p] = basePath
			}
			return nil
		})
		if err != nil {
			return nil, fmt.Errorf("error walking directory %s: %w", path, err)
		}
	}
	return fileMap, nil
}

// parseYAMLFile reads and unmarshals a single YAML file into a given struct.
func parseYAMLFile(filename string, out interface{}) error {
	bytes, err := os.ReadFile(filename)
	if err != nil {
		return err
	}
	if err := yaml.Unmarshal(bytes, out); err != nil {
		log.Printf("Warning: Could not parse YAML file %s: %v", filename, err)
		return err
	}
	return nil
}
