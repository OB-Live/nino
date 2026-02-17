# NINO
NINO (Narrow Input, Narrow Output) is a data transformation pipeline visualization tool. It includes a Lino-Pimo Transformation Plan viewer, an interactive web UI, and a backend service to analyze and display data schemas and execution plans.

![Presentation pic](example.png)

# Description 

NINO parses YAML configuration files from specified project directories and generates interactive visualizations. When run in daemon mode (`-d`), it starts a web server (http://localhost:2442 by default) that provides a comprehensive view of your data transformation pipelines.

The interactive web interface allows users to explore the data schema, view data distribution plots for specific table columns, and visualize the execution plan of associated Ansible playbooks. Furthermore, it exposes a set of API endpoints for programmatic access, enabling integration with external tools for file management and automation. This makes it a powerful utility for both documenting and managing complex data transformation processes.

# Routes

*   `GET /api/schema`: Returns the DOT graph for the entire project schema.
*   `GET /api/schema/{folder}`: Returns the DOT graph for a specific folder.
*   `GET /api/plot/{folder}/{tableName}`: Returns a PNG image plotting the data distribution for a table's columns.
*   `GET /api/playbook/{folder}`: Returns the DOT graph for an Ansible playbook execution plan.
*   `GET /api/new/mask/{folderName}/{tableName}`: Creates a new boilerplate masking masking file for a table.
*   `GET /api/files`: Returns a JSON object listing all files within the project directories.
*   `GET /api/file/{folder}/{filename}`: Retrieves the raw content of a specific file.
*   `GET /api/exec/lino/fetch/{folder}/{filename}`: Fetches a single row of data as an example for a masking file.
*   `POST /api/file/{folder}/{filename}`: Updates the content of a specific file with the request body.

# Daemon it (-d)
To start the interactive web server, run:
```sh 
go run . -d ./petstore
```

# Or CLI it 
```sh
go run . ./petstore
#✅ Fichier schema.dot généré avec succès.
```

# Features

- Bback end (server + graph rendering) en go 
- Front end (html, css, js) light weight Single Page App
- Web Browser execution 
  - pimo (examples, *.masking.yaml)
  - lino (tables, relation, analyse)
  - ansible playbooks 
- lino & pimo editor with autocompletion
  - dataconnectors.yaml
  - masking.yaml
  - ingress-descriptor.yaml 
  - tables.yaml 
  - relations.yaml 
- Transformation plan (graphviz)
  - database schema
  - colored diff schema 
  - colored diff masked value 
- Execution plan (graphviz)
  - playbook ansible 
  - cron tasks  
  - transformation sequence  
- Tables statistics plots to help analyzing use cases 
- Workspace files creation, access and save 
- local storage workspace and UI settings 

# Licence

GNU GPLv3
