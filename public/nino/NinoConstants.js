export const staticExamples = [
  {
    name: "Generation", examples: [
      {
        id: "gen-name", name: "Random Name", description: "Generate random French names",
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
        id: "gen-date", name: "Random Date", description: "Generate random dates within a range",
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
];

export const MASK_KEYWORDS = [
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


export const HELPER_LOAD_METADATA = (folderName) => `cd ${folderName}/source 
lino table extract source
lino relation extract source
# lino analyse source > analyze.yaml

cd ../target
lino table extract target
lino relation extract target
# lino analyse target > analyze.yaml
`;


export const api = {
  files: 'files',
  schema: ''
};

export const fileTypes = [
  { name: "yaml", regex: "*.yml" },
  { name: "connector", regex: "*dataconnector.yml" },
  { name: "descriptor", regex: "*descriptor.yml" },
  { name: "masking", regex: "*masking.yml" },
  { name: "playbook", regex: "*playbook.yml" },
  { name: "table", regex: "*table.yml" },
  { name: "relation", regex: "*relation.yml" },
  { name: "analyse", regex: "*analyse.yml" },
];
