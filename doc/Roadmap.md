# Fix

- masking execution json 
- execution plan buttons and paragraph
- fix graph 
- check all execution 
- analyse/analyze.yaml behaviour 

# Add features 

- improve yaml autocompletion an validation for 
    - dataconnector
    - masking (!important)
    - descriptor
    - tables 
    - relations 
    - analyze

# Quality  
- stabilize static examples 
- better css
- cypress scenario petstore

# Deployement
- conteneurisation
- product release
- product demo 

# commandes utiles 
```sh
go build . &&  docker build -t 0blive/nino . && docker run -it -p 2442:2442 0blive/nino
```