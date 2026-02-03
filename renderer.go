package main

import (
	"bytes"
	"fmt"
	"image/color"
	"log"
	"math"
	"os"
	"strconv"
	"strings"

	"gonum.org/v1/plot"
	"gonum.org/v1/plot/plotter"
	"gonum.org/v1/plot/vg"
	"gonum.org/v1/plot/vg/draw"
	"gonum.org/v1/plot/vg/vgimg"
)

const (
	lightgreyColor = "#eeeeee6e" // Light transparent red for source/readonly
	sourceColor    = "#FF000040" // Light transparent red for source/readonly
	targetColor    = "#0000FF40" // Light transparent blue for target/writable
)

// subgraphModel holds the context and logic for generating a single cluster subgraph.
type subgraphModel struct {
	folderName            string
	tables                []Table
	projectData           ProjectData
	tableToFolder         map[string]string
	analysisMetrics       map[string]map[string]AnalyzeColumn
	analysisTables        map[string]AnalyzeTable
	targetColumnsMap      map[string]map[string]Column
	targetAnalysisMetrics map[string]map[string]AnalyzeColumn
	targetAnalysisTables  map[string]AnalyzeTable
}

// generateCombinedDotGraph creates the complete DOT graph string from all schemas.
func generateCombinedDotGraph(projectData ProjectData, folderFilter ...string) string {
	var sb strings.Builder

	// Start the DOT graph definition with global settings.
	sb.WriteString(`digraph G {
	// Global graph settings
	label=<<TABLE BORDER="0" CELLBORDER="0" CELLSPACING="4" CELLPADDING="2">
		<TR><TD COLSPAN="3"><FONT POINT-SIZE="42" COLOR="darkolivegreen"><B>LINO-PIMO Transformation Plan</B></FONT></TD></TR>
	</TABLE>>;
	labelloc=t;
	rankdir=LR;
	tooltip="LINO-PIMO Transformation tooltip";
	graph [splines=curved, class="lino-graph"];
	node [shape=plain, fontname="Helvetica", class="lino-table"];
	edge [fontname="Helvetica", fontsize=10, class="lino-edge"];

`)

	// Build a reverse lookup map to find the folder for any given table name.
	// This is crucial for creating edges between tables that might be in different folders.
	tableToFolder := make(map[string]string)
	var folderToProcess string
	if len(folderFilter) > 0 {
		folderToProcess = folderFilter[0]
	}

	// Generate all the cluster subgraphs and their table nodes first.
	for folderName, folderData := range projectData {
		// The tableToFolder map is built here for clarity, though it could be built once.
		if folderToProcess != "" && folderName != folderToProcess {
			// If filtering, build the map for all tables but only generate the subgraph for the selected one.
			continue
		}
		for _, table := range folderData.Tables {
			tableToFolder[table.Name] = folderName
		}
		sg := newSubgraphModel(folderName, folderData.Tables, projectData, tableToFolder)
		sb.WriteString(sg.generate())
	}

	// If filtering by a folder, we still need to process relations for other folders
	// to correctly draw cross-cluster edges.
	if folderToProcess != "" {
		for folderName, folderData := range projectData {
			for _, table := range folderData.Tables {
				tableToFolder[table.Name] = folderName
			}
		}
	}

	sb.WriteString("}")
	return sb.String()
}

// newSubgraphModel initializes a generator for a specific folder's subgraph.
func newSubgraphModel(folderName string, tables []Table, projectData ProjectData, tableToFolder map[string]string) *subgraphModel {
	sg := &subgraphModel{
		folderName:    folderName,
		tables:        tables,
		projectData:   projectData,
		tableToFolder: tableToFolder,
	}
	sg.preprocessData()
	return sg
}

// preprocessData prepares all necessary data lookups for the subgraph generation.
func (sg *subgraphModel) preprocessData() {
	folderData := sg.projectData[sg.folderName]

	// Pre-process source analysis metrics.
	sg.analysisMetrics = make(map[string]map[string]AnalyzeColumn)
	sg.analysisTables = make(map[string]AnalyzeTable)
	if folderAnalysis := folderData.Analysis; folderAnalysis.Database != "" {
		for _, table := range folderAnalysis.Tables {
			colMap := make(map[string]AnalyzeColumn)
			for _, col := range table.Columns {
				colMap[col.Name] = col
			}
			sg.analysisMetrics[table.Name] = colMap
			sg.analysisTables[table.Name] = table
		}
	}

	// Pre-process target table definitions.
	targetTablesMap := make(map[string]Table)
	if targetTables := folderData.TargetTables; len(targetTables) > 0 {
		for _, table := range targetTables {
			targetTablesMap[table.Name] = table
		}
	}
	sg.targetColumnsMap = make(map[string]map[string]Column)
	for tableName, table := range targetTablesMap {
		cols := make(map[string]Column)
		for _, col := range table.Columns {
			cols[col.Name] = col
		}
		sg.targetColumnsMap[tableName] = cols
	}

	// Pre-process target analysis metrics.
	sg.targetAnalysisMetrics = make(map[string]map[string]AnalyzeColumn)
	sg.targetAnalysisTables = make(map[string]AnalyzeTable)
	if folderAnalysis := folderData.TargetAnalysis; folderAnalysis.Database != "" {
		for _, table := range folderAnalysis.Tables {
			colMap := make(map[string]AnalyzeColumn)
			for _, col := range table.Columns {
				colMap[col.Name] = col
			}
			sg.targetAnalysisMetrics[table.Name] = colMap
			sg.targetAnalysisTables[table.Name] = table
		}
	}
}

// generate creates the full DOT string for the subgraph.
func (sg *subgraphModel) generate() string {
	var sb strings.Builder
	clusterID := strings.ReplaceAll(sg.folderName, "-", "_")

	sb.WriteString(fmt.Sprintf("\n  subgraph cluster_%s {\n", clusterID))
	clusterLabel := generateClusterLabel(sg.folderName, sg.projectData[sg.folderName].DataConnectors)
	sb.WriteString(fmt.Sprintf("    label=<%s>;\n", clusterLabel))
	sb.WriteString(fmt.Sprintf("    href=\"javascript:openExecutionGraph('%s')\"\n", sg.folderName))

	sb.WriteString("    style=rounded;\n    color=olive;\n\n")

	// Generate nodes for all tables in this subgraph.
	for _, table := range sg.tables {
		sourceMetricsHeader := "Metrics"
		if sourceAnalyzedTable, ok := sg.analysisTables[table.Name]; ok && len(sourceAnalyzedTable.Columns) > 0 {
			sourceMetricsHeader = fmt.Sprintf(`<FONT POINT-SIZE="10">Count </FONT><B><FONT POINT-SIZE="12">%d</FONT></B>`, sourceAnalyzedTable.Columns[0].MainMetric.Count)
		}
		targetMetricsHeader := "Metrics"
		if targetAnalyzedTable, ok := sg.targetAnalysisTables[table.Name]; ok && len(targetAnalyzedTable.Columns) > 0 {
			targetMetricsHeader = fmt.Sprintf(`<FONT POINT-SIZE="10">Count </FONT><B><FONT POINT-SIZE="12">%d</FONT></B>`, targetAnalyzedTable.Columns[0].MainMetric.Count)
		}

		var descriptorPtr *IngressDescriptorSchema
		if folderDescriptors := sg.projectData[sg.folderName].Descriptors; folderDescriptors != nil {
			if descriptor, ok := folderDescriptors[table.Name]; ok {
				descriptorPtr = &descriptor
			}
		}

		uniqueNodeID := fmt.Sprintf("%s_%s", clusterID, table.Name)
		sb.WriteString(generateTableNode(
			uniqueNodeID,
			table,
			sg.folderName,
			descriptorPtr,
			sg.analysisMetrics[table.Name],
			sg.targetColumnsMap[table.Name],
			sourceMetricsHeader,
			targetMetricsHeader,
			sg.targetAnalysisMetrics[table.Name],
		))
	}

	// Draw edges that are defined in the current folder's relations.yaml
	if relSchema := sg.projectData[sg.folderName].Relations; len(relSchema.Relations) > 0 {
		for _, rel := range relSchema.Relations {
			parentFolder, parentFound := sg.tableToFolder[rel.Parent.Name]
			childFolder, childFound := sg.tableToFolder[rel.Child.Name]

			if !parentFound || !childFound {
				log.Printf("Warning: could not find one or both tables for relation '%s' (%s -> %s) defined in '%s'. Skipping edge.", rel.Name, rel.Parent.Name, rel.Child.Name, sg.folderName)
				continue
			}

			// Important: Use the clusterID of the *current* subgraph for nodes within it.
			// For cross-cluster relations, this logic would need to be expanded.
			parentClusterID := strings.ReplaceAll(parentFolder, "-", "_")
			childClusterID := strings.ReplaceAll(childFolder, "-", "_")

			uniqueParentID := fmt.Sprintf("%s_%s", parentClusterID, rel.Parent.Name)
			uniqueChildID := fmt.Sprintf("%s_%s", childClusterID, rel.Child.Name)

			sb.WriteString(fmt.Sprintf("    \"%s\" -> \"%s\" [label=\" %s \", color=\"#555555\"];\n", uniqueParentID, uniqueChildID, rel.Name))
		}
	}

	sb.WriteString("  }\n\n")
	return sb.String()
}

// generateTableNode creates the DOT representation for a single table, including masking info.
func generateTableNode(
	uniqueNodeID string,
	table Table,
	folderName string,
	descriptor *IngressDescriptorSchema,
	analysis map[string]AnalyzeColumn,
	targetColumns map[string]Column,
	sourceMetricsHeader string,
	targetMetricsHeader string,
	targetAnalysis map[string]AnalyzeColumn) string {
	maskingRules := make(map[string]maskInfo)
	hasDescriptor := descriptor != nil
	hasAnalysis := len(analysis) > 0

	header := generateNodeHeader(table.Name, hasDescriptor, hasAnalysis, sourceMetricsHeader, targetMetricsHeader)
	populateMaskingRules(descriptor, maskingRules)

	var rows strings.Builder
	keyMap := make(map[string]bool)
	for _, key := range table.Keys {
		keyMap[key] = true
	}

	for _, col := range table.Columns {
		keySymbol := ""
		if keyMap[col.Name] {
			keySymbol = "&#128273; " // Key emoji
		}

		exportCell := ""
		targetCol, hasTarget := targetColumns[col.Name]
		// Create a split cell if the 'export' type differs between source and target.
		if hasTarget && targetCol.Export != col.Export {
			exportCell = fmt.Sprintf(`
			<TD>
				<TABLE BORDER="0" CELLBORDER="0" CELLSPACING="0">
					<TR><TD BGCOLOR="%s" ALIGN="LEFT"><FONT POINT-SIZE="9">%s</FONT></TD></TR>
					<TR><TD BGCOLOR="%s" ALIGN="LEFT"><FONT POINT-SIZE="9">%s</FONT></TD></TR>
				</TABLE>
			</TD>`, sourceColor, col.Export, targetColor, targetCol.Export)
		} else {
			exportCell = fmt.Sprintf(`<TD ALIGN="LEFT"><FONT POINT-SIZE="9">%s</FONT></TD>`, col.Export)
		}
		row := fmt.Sprintf(`
		<TR><TD ALIGN="LEFT"><B>%s%s</B></TD>%s`, keySymbol, col.Name, exportCell)

		if hasDescriptor {
			if mask, ok := maskingRules[col.Name]; ok {
				maskDisplay := mask.maskType
				if strings.Contains(mask.maskType, "random") {
					maskDisplay = "&#127922; " // Dice emoji
				} else if strings.Contains(mask.maskType, "incremental") {
					maskDisplay = "&#10133;  " // Use plus symbols as fallback
				} else if strings.Contains(mask.maskType, "regex") {
					maskDisplay = "&#128291; " // Language emoji
				}
				row += fmt.Sprintf(
					`<TD ALIGN="CENTER"><FONT POINT-SIZE="10">%s</FONT></TD><TD ALIGN="LEFT"><FONT POINT-SIZE="10">%s</FONT></TD>`, maskDisplay, mask.maskValue)
			} else {
				row += "<TD></TD><TD></TD>"
			}
		}
		if hasAnalysis && hasDescriptor {
			if metric, ok := analysis[col.Name]; ok {
				sourceBG, targetBG := "", ""
				targetMetric, targetExists := targetAnalysis[col.Name]

				if targetExists && metric.MainMetric.Min != targetMetric.MainMetric.Min {
					sourceBG = fmt.Sprintf(` BGCOLOR="%s"`, sourceColor)
					targetBG = fmt.Sprintf(` BGCOLOR="%s"`, targetColor)
				}

				sourceMinCell := fmt.Sprintf(
					`<TD%s ALIGN="LEFT"><FONT POINT-SIZE="9">%v</FONT></TD>`, sourceBG, metric.MainMetric.Min)
				targetMinCell := "<TD></TD>"
				if targetExists {
					targetMinCell = fmt.Sprintf(
						`<TD%s ALIGN="LEFT"><FONT POINT-SIZE="9">%v</FONT></TD>`, targetBG, targetMetric.MainMetric.Min)
				}
				row += sourceMinCell + targetMinCell
			} else {
				row += "<TD></TD><TD></TD>" // Add two empty cells if no metric
			}
		} else if hasAnalysis {
			if metric, ok := analysis[col.Name]; ok {
				row += fmt.Sprintf(`<TD ALIGN="LEFT"><FONT POINT-SIZE="9">%v</FONT></TD>`, metric.MainMetric.Min)
			}
		}
		rows.WriteString(row + "</TR>")
	}

	return fmt.Sprintf(`
  "%s" [
    href="javascript:openTableStat('%s', '%s')"
    class="table-dialog-trigger"
    tooltip="table's details"
    label=<
      <TABLE BORDER="1" COLOR="olive" CELLBORDER="1" CELLSPACING="0" CELLPADDING="2">
        %s
        %s
      </TABLE>
    >
  ];
`, uniqueNodeID, table.Name, folderName, header, rows.String())
}

// populateMaskingRules extracts masking rule information from a descriptor.
func populateMaskingRules(descriptor *IngressDescriptorSchema, maskingRules map[string]maskInfo) {
	if descriptor == nil {
		return
	}
	for _, rule := range descriptor.Masking {
		var mType, mValue string
		if rule.Mask.Regex != "" {
			mType, mValue = "regex", rule.Mask.Regex
		} else if rule.Mask.RandomChoiceInUri != "" {
			mType, mValue = "randomChoiceInUri", rule.Mask.RandomChoiceInUri
		} else if rule.Mask.Incremental.Increment != 0 {
			mType, mValue = "incremental", fmt.Sprintf("start=%d, step=%d", rule.Mask.Incremental.Start, rule.Mask.Incremental.Increment)
		} else if len(rule.Masks) > 0 {
			mType, mValue = "multiple", "see descriptor"
		}
		// Only add the rule if a mask type was actually found.
		if mType != "" {
			maskingRules[rule.Selector.Jsonpath] = maskInfo{maskType: mType, maskValue: mValue}
		}
	}
}

// generateNodeHeader creates the HTML-like string for a table node's header row.
func generateNodeHeader(tableName string, hasDescriptor, hasAnalysis bool, sourceMetrics, targetMetrics string) string {
	var sb strings.Builder
	sb.WriteString(fmt.Sprintf(`
		<TR>
			<TD BGCOLOR="olive" COLSPAN="2" CELLPADDING="4" ><FONT COLOR="white" POINT-SIZE="20"><B>%s</B></FONT></TD>`, tableName))

	if hasDescriptor {
		sb.WriteString(`
			<TD BGCOLOR="#E0E0E0" COLSPAN="2"><FONT POINT-SIZE="12">Mask</FONT></TD>`)
	}
	if hasAnalysis && hasDescriptor {
		if sourceMetrics == targetMetrics {
			sb.WriteString(fmt.Sprintf(`
			<TD BGCOLOR="%s">%s</TD>
			<TD BGCOLOR="%s">%s</TD>`, lightgreyColor, sourceMetrics, lightgreyColor, targetMetrics))

		} else {
			sb.WriteString(fmt.Sprintf(`
			<TD BGCOLOR="%s">%s</TD>
			<TD BGCOLOR="%s">%s</TD>`, sourceColor, sourceMetrics, targetColor, targetMetrics))

		}

	} else if hasAnalysis {
		sb.WriteString(fmt.Sprintf(`
			<TD BGCOLOR="#E0E0E0">%s</TD>`, sourceMetrics))
	}
	sb.WriteString(`
		</TR>`)
	return sb.String()
}

// generateClusterLabel creates the HTML-like string for a cluster's label, including data connectors.
func generateClusterLabel(folderName string, dcSchema DataConnectorSchema) string {
	var rows strings.Builder
	for _, dc := range dcSchema.DataConnectors {
		var nameBgColor string
		readonlyIcon := " &#9999; " // Pencil emoji
		if dc.Readonly {
			readonlyIcon = " &#128065; " // Eye emoji
			nameBgColor = sourceColor
		} else {
			nameBgColor = targetColor
		}
		rows.WriteString(fmt.Sprintf(`
		<TR>
			<TD BGCOLOR="%s" ALIGN="LEFT" CELLBORDER="1" ><FONT POINT-SIZE="16">%s</FONT></TD>
			<TD ALIGN="LEFT" CELLBORDER="1" ><FONT POINT-SIZE="10">%s</FONT></TD>
			<TD ALIGN="CENTER" CELLBORDER="1"><FONT POINT-SIZE="16">%s</FONT></TD>
		</TR>`, nameBgColor, dc.Name, dc.URL, readonlyIcon))
	}

	return fmt.Sprintf(`
	<TABLE BORDER="1" COLOR="olive" CELLBORDER="1" CELLSPACING="1" CELLPADDING="2" BGCOLOR="#f0f0f0ff">
		<TR><TD PORT="tab" ALIGN="CENTER" COLSPAN="3"><FONT COLOR="darkolivegreen" POINT-SIZE="32"><B> %s </B></FONT></TD></TR>
		%s
	</TABLE>`, folderName, rows.String())
}

// generateSinglePlotForColumn finds a specific column and generates a single plot image for it.
func generateSinglePlotForColumn(projectData ProjectData, tableName, columnName string, folderName ...string) (err error) {
	tableFolder, _, err := findTableLocation(projectData, tableName, folderName...)
	if err != nil {
		return err
	}
	if folderData, ok := projectData[tableFolder]; ok {
		for _, table := range folderData.Analysis.Tables {
			if table.Name == tableName {
				for _, column := range table.Columns {
					if column.Name == columnName {
						p, err := createSingleColumnPlot(tableName, column)
						if err != nil {
							return err
						}
						filename := fmt.Sprintf("plot-%s-%s.png", tableName, columnName)
						if err = p.Save(4*vg.Inch, 3*vg.Inch, filename); err == nil {
							fmt.Printf("✅ Fichier %s généré avec succès.\n", filename)
						}
						return err
					}
				}
			}
		}
	}
	return fmt.Errorf("no analysis data found for table '%s', column '%s'", tableName, columnName)
}

// generatePlotForTable finds all plottable columns for a table and generates a composite grid image.
func generatePlotForTable(projectData ProjectData, tableName string, folderName ...string) (err error) {
	tableFolder, _, err := findTableLocation(projectData, tableName, folderName...)
	if err != nil {
		return err
	}
	if folderData, ok := projectData[tableFolder]; ok {
		for _, table := range folderData.Analysis.Tables {
			if table.Name == tableName {
				var plottableColumns []AnalyzeColumn
				for _, column := range table.Columns {
					// Only consider columns with string length distribution for plotting
					if len(column.StringMetric.Lengths) > 0 {
						plottableColumns = append(plottableColumns, column)
					}
				}

				if len(plottableColumns) > 0 {
					err := generateTablePlot(tableName, plottableColumns)
					if err == nil {
						fmt.Printf("✅ Fichier plot-%s.png généré avec succès.\n", tableName)
					}
					return err
				}
				return fmt.Errorf("no plottable columns found for table '%s'", tableName)
			}
		}
	}

	return fmt.Errorf("no analysis data found for table '%s'", tableName)
}

// generatePlotForTableToMemory generates a plot for a table and returns it as a byte slice.
func generatePlotForTableToMemory(projectData ProjectData, tableName string, folderName ...string) ([]byte, error) {
	tableFolder, _, err := findTableLocation(projectData, tableName, folderName...)
	if err != nil {
		return nil, err
	}

	if folderData, ok := projectData[tableFolder]; ok {
		for _, table := range folderData.Analysis.Tables {
			if table.Name == tableName {
				var plottableColumns []AnalyzeColumn
				for _, column := range table.Columns {
					if len(column.StringMetric.Lengths) > 0 {
						plottableColumns = append(plottableColumns, column)
					}
				}

				if len(plottableColumns) > 0 {
					imgBytes, err := generateTablePlotToMemory(tableName, plottableColumns)
					if err != nil {
						return nil, fmt.Errorf("failed to generate plot image to memory: %w", err)
					}
					return imgBytes, nil
				}
				return nil, fmt.Errorf("no plottable columns found for table '%s'", tableName)
			}
		}
	}

	return nil, fmt.Errorf("no analysis data found for table '%s'", tableName)
}

// createSingleColumnPlot creates a single bar chart for a column's string length distribution.
func createSingleColumnPlot(tableName string, column AnalyzeColumn) (*plot.Plot, error) {
	if len(column.StringMetric.Lengths) == 0 {
		return nil, fmt.Errorf("no string length distribution data to plot for column %s", column.Name)
	}

	p := plot.New()

	p.Title.Text = fmt.Sprintf("Distribution for %s.%s", tableName, column.Name)
	p.X.Label.Text = "Length"
	p.Y.Label.Text = "Frequency"

	values := make(plotter.Values, len(column.StringMetric.Lengths))
	labels := make([]string, len(column.StringMetric.Lengths))
	i := 0
	for _, lengthMetric := range column.StringMetric.Lengths {
		values[i] = lengthMetric.Freq
		labels[i] = strconv.Itoa(lengthMetric.Length)
		i++
	}

	bars, err := plotter.NewBarChart(values, vg.Points(20))
	if err != nil {
		return nil, fmt.Errorf("could not create bar chart: %w", err)
	}
	bars.LineStyle.Width = vg.Length(0)
	bars.Color = color.RGBA{B: 255, A: 255} // Blue bars

	p.Add(bars)
	p.NominalX(labels...)
	p.X.Tick.Label.Font.Size = vg.Points(8)
	p.Y.Tick.Label.Font.Size = vg.Points(8)
	p.Title.TextStyle.Font.Size = vg.Points(10)
	p.X.Label.TextStyle.Font.Size = vg.Points(9)
	p.Y.Label.TextStyle.Font.Size = vg.Points(9)
	p.Y.Min = 0

	return p, nil
}

// generateTablePlot creates a single image file with a grid of plots for the given columns.
func generateTablePlot(tableName string, columns []AnalyzeColumn) error {
	n := float64(len(columns))
	if n == 0 {
		return fmt.Errorf("no columns to plot for table %s", tableName)
	}

	// Calculate optimal grid dimensions (l=rows, w=cols) where 'l' is as small as possible
	// and l is roughly w+1, ensuring enough cells for all n plots.
	l := math.Ceil((1 + math.Sqrt(1+4*n)) / 2)
	w := math.Ceil(n / l)

	rows, cols := int(l), int(w)

	log.Printf("Calculated grid size for table '%s': %d rows x %d columns", tableName, rows, cols)

	// Create a new canvas for the entire image grid.
	img := vgimg.New(vg.Inch*4*vg.Length(cols), vg.Inch*3*vg.Length(rows))
	dc := draw.New(img)

	for i, col := range columns {
		p, err := createSingleColumnPlot(tableName, col)
		if err != nil {
			log.Printf("Skipping plot for column %s: %v", col.Name, err)
			continue
		}
		// Define the drawing area for each plot in the grid.
		row := i / cols
		col := i % cols
		// The coordinate system's origin is in the bottom-left, so we must invert the row index.
		y := rows - 1 - row
		rect := vg.Rectangle{
			Min: vg.Point{X: vg.Length(col) * 4 * vg.Inch, Y: vg.Length(y) * 3 * vg.Inch},
			Max: vg.Point{X: vg.Length(col+1) * 4 * vg.Inch, Y: vg.Length(y+1) * 3 * vg.Inch},
		}
		p.Draw(draw.Canvas{Canvas: dc.Canvas, Rectangle: rect})
	}

	// Save the plot to a PNG file.
	filename := fmt.Sprintf("plot-%s.png", tableName)
	f, err := os.Create(filename)
	if err != nil {
		return fmt.Errorf("could not create file: %w", err)
	}
	defer f.Close()
	png := vgimg.PngCanvas{Canvas: img}
	if _, err := png.WriteTo(f); err != nil {
		return fmt.Errorf("could not write to file: %w", err)
	}
	return nil
}

// generateTablePlotToMemory creates a grid of plots and writes it to a byte buffer.
func generateTablePlotToMemory(tableName string, columns []AnalyzeColumn) ([]byte, error) {
	n := float64(len(columns))
	if n == 0 {
		return nil, fmt.Errorf("no columns to plot for table %s", tableName)
	}

	l := math.Ceil((1 + math.Sqrt(1+4*n)) / 2)
	w := math.Ceil(n / l)
	rows, cols := int(l), int(w)

	img := vgimg.New(vg.Inch*4*vg.Length(cols), vg.Inch*3*vg.Length(rows))
	dc := draw.New(img)

	for i, col := range columns {
		p, err := createSingleColumnPlot(tableName, col)
		if err != nil {
			log.Printf("Skipping plot for column %s: %v", col.Name, err)
			continue
		}
		row := i / cols
		col := i % cols
		y := rows - 1 - row
		rect := vg.Rectangle{
			Min: vg.Point{X: vg.Length(col) * 4 * vg.Inch, Y: vg.Length(y) * 3 * vg.Inch},
			Max: vg.Point{X: vg.Length(col+1) * 4 * vg.Inch, Y: vg.Length(y+1) * 3 * vg.Inch},
		}
		p.Draw(draw.Canvas{Canvas: dc.Canvas, Rectangle: rect})
	}

	var buf bytes.Buffer
	pngCanvas := vgimg.PngCanvas{Canvas: img}
	if _, err := pngCanvas.WriteTo(&buf); err != nil {
		return nil, fmt.Errorf("could not write png to buffer: %w", err)
	}
	return buf.Bytes(), nil
}

// findTableLocation searches through project data to find which folder a table belongs to.
func findTableLocation(projectData ProjectData, tableName string, folderName ...string) (string, *Table, error) {
	folderToSearch := ""
	if len(folderName) > 0 && folderName[0] != "" {
		folderToSearch = folderName[0]
	}

	if folderToSearch != "" {
		if folderData, ok := projectData[folderToSearch]; ok {
			for i, table := range folderData.Tables {
				if table.Name == tableName {
					return folderToSearch, &folderData.Tables[i], nil
				}
			}
		}
		return "", nil, fmt.Errorf("table '%s' not found in folder '%s'", tableName, folderToSearch)
	}

	// Fallback to searching all folders if no specific folder is provided
	for folder, folderData := range projectData {
		for i, table := range folderData.Tables {
			if table.Name == tableName {
				return folder, &folderData.Tables[i], nil
			}
		}
	}
	return "", nil, fmt.Errorf("table '%s' not found in any folder", tableName)
}

// generateAnsiblePlaybookGraph creates the DOT graph string for an Ansible playbook.
func generateAnsiblePlaybookGraph(playbook AnsiblePlaybook) string {
	if len(playbook) == 0 {
		return `digraph G {}`
	}

	var sb strings.Builder
	play := playbook[0] // Assuming one play per file for now

	sb.WriteString(`digraph G {
	rankdir=TB;
	graph [splines=ortho, fontname="Helvetica", label="`)
	sb.WriteString(play.Name)
	sb.WriteString(`", fontsize=20];
	node [shape=rect, style=rounded, fontname="Helvetica"];
	edge [fontname="Helvetica", fontsize=10];

`)
	var prevNode string

	// Pre-tasks nodes first
	if len(play.PreTasks) > 0 {
		sb.WriteString("\n  subgraph cluster_pretasks {\n")
		sb.WriteString(`    label="🛠️ Pre-Tasks";` + "\n")
		sb.WriteString(`    style=rounded;` + "\n")
		sb.WriteString(`    color=grey;` + "\n")

		for i, task := range play.PreTasks {
			nodeID := fmt.Sprintf("pretask_%d", i)
			taskNameLower := strings.ToLower(task.Name)
			var labelPrefix string
			if strings.Contains(taskNameLower, "docker") {
				labelPrefix = "🐳 "
			} else if strings.Contains(taskNameLower, "cron") {
				labelPrefix = "⏰ "
			}

			sb.WriteString(fmt.Sprintf(`    "%s" [label="%s%s", shape=rect];`+"\n", nodeID, labelPrefix, task.Name))
			if prevNode != "" {
				sb.WriteString(fmt.Sprintf(`    "%s" -> "%s";`+"\n", prevNode, nodeID))
			}
			prevNode = nodeID
		}
		sb.WriteString("  }\n\n")
	}

	// Define source and target DB nodes
	sourceDB := play.Vars["source_db"]
	targetDB := play.Vars["target_db"]

	sb.WriteString(fmt.Sprintf(`  "source_db" [label="source", tooltip="%s", shape=cylinder, style="filled", fillcolor="%s"];`+"\n", sourceDB, sourceColor))
	sb.WriteString(fmt.Sprintf(`  "target_db" [label="target", tooltip="%s", shape=cylinder, style="filled", fillcolor="%s"];`+"\n\n", targetDB, targetColor))

	// Connect last pre-task to source_db
	if prevNode != "" {
		sb.WriteString(fmt.Sprintf(`  "%s" -> "source_db";`+"\n", prevNode))
	}
	prevNode = "source_db"

	// Roles and Entities nodes
	for i, role := range play.Roles {
		if role.Name == "OB-Live.nino" {
			clusterID := fmt.Sprintf("cluster_role_%d", i)
			sb.WriteString(fmt.Sprintf("\n  subgraph %s {\n", clusterID))
			sb.WriteString(fmt.Sprintf(`    label="⚙️ %s";`+"\n", role.Name))
			sb.WriteString(`    style=rounded;` + "\n")
			sb.WriteString(`    color=blue;` + "\n")

			var lastEntityNode string
			for j, entity := range role.Vars.Entities {
				entityNodeID := fmt.Sprintf("entity_%d_%d", i, j)
				sb.WriteString(fmt.Sprintf(`  "%s" [label="%s", shape=invhouse];`+"\n", entityNodeID, entity.Name))
				if lastEntityNode != "" {
					sb.WriteString(fmt.Sprintf(`    "%s" -> "%s";`+"\n", lastEntityNode, entityNodeID))
				}
				lastEntityNode = entityNodeID
			}
			sb.WriteString("  }\n\n")

			// Connect previous node to the first entity and last entity to the target
			firstEntityID := fmt.Sprintf("entity_%d_%d", i, 0)
			sb.WriteString(fmt.Sprintf(`  "%s" -> "%s";`+"\n", prevNode, firstEntityID))
			sb.WriteString(fmt.Sprintf(`  "%s" -> "target_db";`+"\n", lastEntityNode))
			prevNode = "target_db" // The flow is now complete through the subgraph
		} else {
			roleNodeID := fmt.Sprintf("role_%d", i)
			sb.WriteString(fmt.Sprintf(`  "%s" [label="%s", shape=cds];`+"\n", roleNodeID, role.Name))
			sb.WriteString(fmt.Sprintf(`  "%s" -> "%s";`+"\n", prevNode, roleNodeID))
			prevNode = roleNodeID
		}
	}

	// If the main flow hasn't reached the target DB yet, connect the last node.
	if prevNode != "target_db" {
		sb.WriteString(fmt.Sprintf(`  "%s" -> "target_db";`+"\n", prevNode))
	}

	sb.WriteString("}")
	return sb.String()
}
