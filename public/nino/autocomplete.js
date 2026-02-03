// --- Static Data ---
  async function getStaticExamples() {
    // In a real static app, this would be fetched or be part of the script.
    // For this example, it's hardcoded.
    return [
      {
        name: "Generation", examples: [

          {
            id: "gen-name",
            name: "Random Name",
            description: "Generate random French names",
            yaml: `version: "1"
seed: 42
masking:
  - selector:
      jsonpath: "name"
    mask:
      randomChoiceInUri: "pimo://nameFR"`,
            input: `{"name": "John Doe"}`
          },
          {
            id: "gen-date",
            name: "Random Date",
            description: "Generate random dates within a range",
            yaml: `version: "1"
seed: 42
masking:
  - selector:
      jsonpath: "birthdate"
    mask:
      randomDate:
        dateMin: "1970-01-01T00:00:00Z"
        dateMax: "2000-12-31T00:00:00Z"`,
            input: `{"birthdate": "1985-03-15T00:00:00Z"}`
          },
          {
            id: "gen-int",
            name: "Random Integer",
            description: "Generate random integers in range",
            yaml: `version: "1"
seed: 42
masking:
  - selector:
      jsonpath: "age"
    mask:
      randomInt:
        min: 18
        max: 65`,
            input: `{"age": 30}`
          },
          {
            id: "gen-regex",
            name: "Regex Pattern",
            description: "Generate strings matching regex",
            yaml: `version: "1"
seed: 42
masking:
  - selector:
      jsonpath: "phone"
    mask:
      regex: "[0-9]{2} [0-9]{2} [0-9]{2} [0-9]{2} [0-9]{2}"`,
            input: `{"phone": "01 23 45 67 89"}`
          },
          {
            id: "gen-uuid",
            name: "UUID Generation",
            description: "Generate unique identifiers",
            yaml: `version: "1"
masking:
  - selector:
      jsonpath: "id"
    mask:
      randomUUID: {}`,
            input: `{"id": "old-id-123"}`
          },
          {
            id: "gen-email",
            name: "Email Generation",
            description: "Generate realistic email addresses",
            yaml: `version: "1"
seed: 42
masking:
  - selector:
      jsonpath: "email"
    mask:
      template: "{{.name | lower | NoAccent}}@example.com"
    preserve: "domain"`,
            input: `{"name": "Jean Dupont", "email": "jean.dupont@company.com"}`
          }
        ]
      },
      {
        name: "Anonymization", examples: [
          {
            id: "anon-constant",
            name: "Constant Value",
            description: "Replace with fixed value",
            yaml: `version: "1"
masking:
  - selector:
      jsonpath: "password"
    mask:
      constant: "********"`,
            input: `{"username": "admin", "password": "secret123"}`
          },
          {
            id: "anon-hash",
            name: "Hash Masking",
            description: "One-way hash transformation",
            yaml: `version: "1"
masking:
  - selector:
      jsonpath: "ssn"
    mask:
      hash: {}`,
            input: `{"ssn": "123-45-6789"}`
          },
          {
            id: "anon-remove",
            name: "Remove Field",
            description: "Delete sensitive fields entirely",
            yaml: `version: "1"
masking:
  - selector:
      jsonpath: "credit_card"
    mask:
      remove: true`,
            input: `{"name": "John", "credit_card": "4111-1111-1111-1111"}`
          }
        ]
      },
      {
        name: "Pseudonymization", examples: [
          {
            id: "pseudo-consistent",
            name: "Consistent Masking",
            description: "Same input always produces same output",
            yaml: `version: "1"
seed: 42
masking:
  - selector:
      jsonpath: "customer_id"
    mask:
      hash:
        domain: "customer"
      cache: "customer_id"`,
            input: `[{"customer_id": "CUST001"}, {"customer_id": "CUST001"}, {"customer_id": "CUST002"}]`
          },
          {
            id: "pseudo-ff1",
            name: "Format Preserving",
            description: "Encrypt while keeping format",
            yaml: `version: "1"
masking:
  - selector:
      jsonpath: "account"
    mask:
      ff1:
        radix: 10
        keyFromEnv: "FF1_KEY"`,
            input: `{"account": "1234567890"}`
          },
          {
            id: "pseudo-weighted",
            name: "Weighted Choice",
            description: "Random selection with weights",
            yaml: `version: "1"
seed: 42
masking:
  - selector:
      jsonpath: "status"
    mask:
      weightedChoice:
        - choice: "active"
          weight: 7
        - choice: "inactive"
          weight: 2
        - choice: "pending"
          weight: 1`,
            input: `{"status": "unknown"}`
          },
          {
            id: "pseudo-fromjson",
            name: "From JSON Cache",
            description: "Replace from a reference dataset",
            yaml: `version: "1"
seed: 42
masking:
  - selector:
      jsonpath: "city"
    mask:
      randomChoiceInUri: "pimo://cityFR"`,
            input: `{"city": "Unknown City"}`
          }
        ]
      },
      {
        name: "Other", examples: [
          {
            id: "other-template",
            name: "Template Mask",
            description: "Use Go templates for complex transformations",
            yaml: `version: "1"
masking:
  - selector:
      jsonpath: "fullname"
    mask:
      template: "{{.firstname}} {{.lastname}}"`,
            input: `{"firstname": "Jean", "lastname": "Dupont", "fullname": ""}`
          },
          {
            id: "other-pipe",
            name: "Pipe Masks",
            description: "Chain multiple masks together",
            yaml: `version: "1"
seed: 42
masking:
  - selector:
      jsonpath: "name"
    masks:
      - add: ""
      - randomChoiceInUri: "pimo://nameFR"
      - template: "{{. | upper}}"`,
            input: `{"name": "Original Name"}`
          },
          {
            id: "other-conditional",
            name: "Conditional Masking",
            description: "Apply masks based on conditions",
            yaml: `version: "1"
seed: 42
masking:
  - selector:
      jsonpath: "salary"
    mask:
      randomInt:
        min: 30000
        max: 80000
    when: '{{if gt .age 18}}true{{end}}'`,
            input: `{"age": 25, "salary": 50000}`
          },
          {
            id: "other-nested",
            name: "Nested Objects",
            description: "Mask fields in nested structures",
            yaml: `version: "1"
seed: 42
masking:
  - selector:
      jsonpath: "user.contact.email"
    mask:
      template: "masked@example.com"
  - selector:
      jsonpath: "user.contact.phone"
    mask:
      regex: "XX-XXX-XXXX"`,
            input: `{"user": {"name": "John", "contact": {"email": "john@real.com", "phone": "12-345-6789"}}}`
          }
        ]
      },
      { name: "Workspace", examples: [] },
    ].map(c => ({ ...c, examples: c.examples.length > 0 ? c.examples : [{ id: 'placeholder', name: 'Loading...', description: '' }] }));
  }

function setupYamlValidationAndCompletion(monaco, jsyaml, editorInstances) {
    const topLevelKeywords = ["version", "seed", "masking", "functions", "vars"];
    const maskKeywords = [
        // Existing and new keywords with descriptions
        { keyword: "add", description: "Adds a new field with a specified value." },
        { keyword: "addTransient", description: "Adds a transient field that can be used by other masks but is removed from the final output." },
        { keyword: "apply", description: "Applies a masking configuration from an external file." },
        { keyword: "clear", description: "Clears the value of a field, setting it to null or an empty value." },
        { keyword: "command", description: "Executes a shell command and uses its output as the masked value." },
        { keyword: "constant", description: "Replaces the field's value with a fixed, constant value." },
        { keyword: "dateParser", description: "Parses a date from one format and outputs it in another." },
        { keyword: "duration", description: "Adds or subtracts a duration from a date/time value." },
        { keyword: "ff1", description: "Format-Preserving Encryption using the FF1 algorithm. Requires a key and radix." },
        { keyword: "fpe", description: "Alias for ff1. Format-Preserving Encryption." },
        { keyword: "hash", description: "Computes a hash (SHA-256 by default) of the input value. Can be configured with a domain for consistent pseudonymization." },
        { keyword: "keep", description: "Explicitly keeps the original value of the field." },
        { keyword: "luhn", description: "Calculates and appends a Luhn checksum, often used for ID numbers." },
        { keyword: "markov", description: "Generates pseudo-random text using a Markov chain model from a sample text." },
        { keyword: "randomChoice", description: "Selects a random value from a provided list of choices." },
        { keyword: "randomChoiceInUri", description: "Selects a random value from a list specified in an external file (e.g., pimo://nameFR)." },
        { keyword: "randomDate", description: "Generates a random date within a specified minimum and maximum range." },
        { keyword: "randomDecimal", description: "Generates a random decimal number within a specified range and precision." },
        { keyword: "randomInt", description: "Generates a random integer within a specified minimum and maximum range." },
        { keyword: "randomString", description: "Generates a random string of a specified length." },
        { keyword: "randomUUID", description: "Generates a standard UUID." },
        { keyword: "regex", description: "Generates a random string that matches a given regular expression." },
        { keyword: "remove", description: "Removes the field entirely from the output." },
        { keyword: "replace", description: "Performs a regex-based search and replace on the field's value." },
        { keyword: "sha3", description: "Computes a SHAKE/SHA3 hash of the input." },
        { keyword: "template", description: "Uses Go template syntax to construct a new value from existing fields." },
        { keyword: "truncate", description: "Truncates a string to a maximum length." },
        { keyword: "weightedChoice", description: "Selects a random value from a list of choices, where each choice has a specific weight." },
        { keyword: "xml", description: "Masks attributes or tags within an XML string." }
    ];

    // --- Autocompletion ---
    monaco.languages.registerCompletionItemProvider("yaml", {
      provideCompletionItems: (model, position) => {
        const textUntilPosition = model.getValueInRange({
          startLineNumber: 1,
          startColumn: 1,
          endLineNumber: position.lineNumber,
          endColumn: position.column,
        });

        const suggestions = [];

        // Suggest top-level keywords
        if (position.lineNumber <= 3) { // Simple check: suggest top-level keywords only near the top
           topLevelKeywords.forEach(keyword => {
            suggestions.push({
              label: keyword,
              kind: monaco.languages.CompletionItemKind.Keyword,
              insertText: `${keyword}: `,
              range: new monaco.Range(position.lineNumber, position.column, position.lineNumber, position.column)
            });
          });
        }

        // Suggest mask types
        if (textUntilPosition.match(/mask:\s*$/)) {
           maskKeywords.forEach(mask => {
            suggestions.push({
              label: mask.keyword,
              kind: monaco.languages.CompletionItemKind.Function,
              insertText: `${mask.keyword}: `,
              documentation: mask.description,
              range: new monaco.Range(position.lineNumber, position.column, position.lineNumber, position.column)
            });
          });
        }

        return { suggestions: suggestions };
      },
    });

    function validateMaskingFile(doc, markers, model) {
        // Check for unknown top-level keys in masking files
        Object.keys(doc).forEach(key => {
            if (!topLevelKeywords.includes(key) && key !== "preserve" && key !== "when") {
                markers.push({
                    ...createMarker(model, `Unknown top-level key for a masking file: "${key}"`, key, monaco.MarkerSeverity.Warning)
                });

            }
        });

        // Check masking rules
        if (doc.masking && Array.isArray(doc.masking)) {
            doc.masking.forEach((rule, index) => {
                if (!rule.selector || !rule.selector.jsonpath) {
                     markers.push({
                        ...createMarker(model, `Masking rule #${index + 1} is missing a 'selector' with 'jsonpath'.`, 'masking', monaco.MarkerSeverity.Error)
                    });
                }
                 if (!rule.mask && !rule.masks) {
                     markers.push({
                        ...createMarker(model, `Masking rule #${index + 1} is missing a 'mask' or 'masks' definition.`, 'masking', monaco.MarkerSeverity.Error)
                    });
                }
            });
        }
    }

    function validateDataConnector(doc, markers, model) {
        const dcTopLevel = ["version", "dataconnectors"];
        Object.keys(doc).forEach(key => {
            if (!dcTopLevel.includes(key)) {
                markers.push({ ...createMarker(model, `Unknown top-level key for a dataconnector file: "${key}"`, key, monaco.MarkerSeverity.Warning) });
            }
        });

        if (doc.dataconnectors && Array.isArray(doc.dataconnectors)) {
            const connectorKeys = ["name", "url", "readonly", "password"];
            const passwordKeys = ["valueFromEnv"];
            doc.dataconnectors.forEach((connector, index) => {
                if (!connector.name) markers.push({ ...createMarker(model, `Data connector #${index + 1} is missing the required 'name' field.`, 'dataconnectors', monaco.MarkerSeverity.Error) });
                if (!connector.url) markers.push({ ...createMarker(model, `Data connector #${index + 1} ('${connector.name || ''}') is missing the required 'url' field.`, connector.name || 'dataconnectors', monaco.MarkerSeverity.Error) });
                if (connector.readonly === undefined) {
                    markers.push({ ...createMarker(model, `Data connector '${connector.name || ''}' is missing the required 'readonly' field.`, connector.name || 'dataconnectors', monaco.MarkerSeverity.Error) });
                } else if (typeof connector.readonly !== 'boolean') {
                    markers.push({ ...createMarker(model, `The 'readonly' field in data connector '${connector.name || ''}' must be a boolean (true or false).`, 'readonly', monaco.MarkerSeverity.Error, connector.name) });
                }

                // Check for unknown keys within the connector
                Object.keys(connector).forEach(key => {
                    if (!connectorKeys.includes(key)) {
                        markers.push({ ...createMarker(model, `Unknown key "${key}" in data connector '${connector.name || ''}'`, key, monaco.MarkerSeverity.Warning, connector.name) });
                    }
                });
            });
        }
    }

    function validateTablesFile(doc, markers, model) {
        const topLevelKeys = ["version", "tables"];
        Object.keys(doc).forEach(key => {
            if (!topLevelKeys.includes(key)) {
                markers.push({ ...createMarker(model, `Unknown top-level key for a tables.yaml file: "${key}"`, key, monaco.MarkerSeverity.Warning) });
            }
        });

        if (doc.tables && Array.isArray(doc.tables)) {
            const tableKeys = ["name", "keys", "columns"];
            doc.tables.forEach((table, index) => {
                if (!table.name) markers.push({ ...createMarker(model, `Table #${index + 1} is missing the required 'name' field.`, 'tables', monaco.MarkerSeverity.Error) });
                Object.keys(table).forEach(key => {
                    if (!tableKeys.includes(key)) {
                        markers.push({ ...createMarker(model, `Unknown key "${key}" in table '${table.name || ''}'`, key, monaco.MarkerSeverity.Warning, table.name) });
                    }
                });

                if (!table.columns || !Array.isArray(table.columns)) {
                    markers.push({ ...createMarker(model, `Table '${table.name || ''}' is missing the required 'columns' array.`, table.name, monaco.MarkerSeverity.Error) });
                } else {
                    const columnKeys = ["name", "export", "type"];
                    table.columns.forEach((col, colIndex) => {
                        if (!col.name) markers.push({ ...createMarker(model, `Column #${colIndex + 1} in table '${table.name || ''}' is missing the 'name' field.`, 'columns', monaco.MarkerSeverity.Error, table.name) });
                        Object.keys(col).forEach(key => {
                            if (!columnKeys.includes(key)) {
                                markers.push({ ...createMarker(model, `Unknown key "${key}" in column '${col.name || ''}' of table '${table.name || ''}'`, key, monaco.MarkerSeverity.Warning, col.name) });
                            }
                        });
                    });
                }
            });
        }
    }

    function validateRelationsFile(doc, markers, model) {
        const topLevelKeys = ["version", "relations"];
        Object.keys(doc).forEach(key => {
            if (!topLevelKeys.includes(key)) {
                markers.push({ ...createMarker(model, `Unknown top-level key for a relations.yaml file: "${key}"`, key, monaco.MarkerSeverity.Warning) });
            }
        });

        if (doc.relations && Array.isArray(doc.relations)) {
            const relationKeys = ["name", "parent", "child"];
            const endpointKeys = ["name", "keys"];
            doc.relations.forEach((relation, index) => {
                if (!relation.name) markers.push({ ...createMarker(model, `Relation #${index + 1} is missing the 'name' field.`, 'relations', monaco.MarkerSeverity.Error) });
                Object.keys(relation).forEach(key => {
                    if (!relationKeys.includes(key)) markers.push({ ...createMarker(model, `Unknown key "${key}" in relation '${relation.name || ''}'`, key, monaco.MarkerSeverity.Warning, relation.name) });
                });

                if (!relation.parent || !relation.parent.name) markers.push({ ...createMarker(model, `Relation '${relation.name || ''}' is missing a 'parent' with a 'name'.`, relation.name, monaco.MarkerSeverity.Error) });
                else Object.keys(relation.parent).forEach(key => { if (!endpointKeys.includes(key)) markers.push({ ...createMarker(model, `Unknown key "${key}" in parent of relation '${relation.name || ''}'`, key, monaco.MarkerSeverity.Warning, 'parent') }); });

                if (!relation.child || !relation.child.name) markers.push({ ...createMarker(model, `Relation '${relation.name || ''}' is missing a 'child' with a 'name'.`, relation.name, monaco.MarkerSeverity.Error) });
                else Object.keys(relation.child).forEach(key => { if (!endpointKeys.includes(key)) markers.push({ ...createMarker(model, `Unknown key "${key}" in child of relation '${relation.name || ''}'`, key, monaco.MarkerSeverity.Warning, 'child') }); });
            });
        }
    }

    function validateAnalyzeFile(doc, markers, model) {
        const topLevelKeys = ["database", "tables"];
        Object.keys(doc).forEach(key => {
            if (!topLevelKeys.includes(key)) {
                markers.push({ ...createMarker(model, `Unknown top-level key for an analyze.yaml file: "${key}"`, key, monaco.MarkerSeverity.Warning) });
            }
        });

        if (doc.tables && Array.isArray(doc.tables)) {
            const tableKeys = ["name", "columns", "mainMetric"];
            doc.tables.forEach((table, index) => {
                Object.keys(table).forEach(key => {
                    if (!tableKeys.includes(key)) {
                        markers.push({ ...createMarker(model, `Unknown key "${key}" in table '${table.name || ''}'`, key, monaco.MarkerSeverity.Warning, table.name) });
                    }
                });

                if (table.columns && Array.isArray(table.columns)) {
                    const columnKeys = ["name", "mainMetric", "stringMetric", "numericMetric"];
                     table.columns.forEach((col, colIndex) => {
                        Object.keys(col).forEach(key => {
                            if (!columnKeys.includes(key)) {
                                markers.push({ ...createMarker(model, `Unknown key "${key}" in column '${col.name || ''}' of table '${table.name || ''}'`, key, monaco.MarkerSeverity.Warning, col.name) });
                            }
                        });
                    });
                }
            });
        }
    }

    // --- Marker Helper ---
    function createMarker(model, message, key, severity, parentKey) {
        let startLineNumber = 1;
        let startColumn = 1;
        let endLineNumber = 1;
        let endColumn = 1;

        const searchKey = parentKey ? `${parentKey}:` : `${key}:`;
        const modelText = model.getValue();
        const lines = modelText.split('\n');
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const col = line.indexOf(searchKey);
            if (col !== -1) {
                startLineNumber = endLineNumber = i + 1;
                startColumn = col + 1;
                endColumn = col + searchKey.length + 1;
                break; // Found the first occurrence
            }
        }
        return { message, severity, startLineNumber, startColumn, endLineNumber, endColumn };
    }

    // --- Validation ---
    const createValidator = (editor, editorKey) => () => {
      const model = editor.getModel();
      const content = model.getValue();
      const markers = [];

      try {
        const doc = jsyaml.load(content);

        if (typeof doc !== 'object' || doc === null) {
            markers.push({
                message: "YAML content should be an object.",
                severity: monaco.MarkerSeverity.Error,
                startLineNumber: 1, endLineNumber: 1, startColumn: 1, endColumn: 1
            });
        } else {
            let fileType = editorKey;
            // For the main editor, we stored the file type on the instance itself
            if (editorKey === 'yaml' && editor._currentFileType) {
                fileType = editor._currentFileType;
            }

            // Determine file type from editor key to apply specific validation
            if (fileType && fileType.includes('dataconnector.yaml')) {
                validateDataConnector(doc, markers, model);
            } else if (fileType && fileType.includes('tables.yaml')) {
                validateTablesFile(doc, markers, model);
            } else if (fileType && fileType.includes('relations.yaml')) {
                validateRelationsFile(doc, markers, model);
            } else if (fileType && fileType.includes('analyze.yaml')) {
                validateAnalyzeFile(doc, markers, model);
            } else if (fileType && (fileType.includes('-descriptor.yaml') || fileType === 'masking')) {
                // Default to masking file validation for descriptors or the main editor's default
                validateMaskingFile(doc, markers, model);
            } else {
                // For any other file type like playbook.yaml, do nothing.
            }
        }
      } catch (e) {
        // YAML parsing error
        markers.push({
          message: e.message,
          severity: monaco.MarkerSeverity.Error,
          startLineNumber: e.mark.line + 1,
          startColumn: e.mark.column + 1,
          endLineNumber: e.mark.line + 1,
          endColumn: e.mark.column + 2,
        });
      }

      monaco.editor.setModelMarkers(model, "yaml-validation", markers);
    };



    // Validate all YAML editors on content change
    Object.keys(editorInstances).forEach(key => {
        const editor = editorInstances[key];
        // Ensure we only attach to YAML editors
        if (editor && editor.getModel() && editor.getModel().getLanguageId() === 'yaml') {
            const validator = createValidator(editor, key);
            editor.onDidChangeModelContent(validator);
            validator(); // Initial validation
        }
    });
  }