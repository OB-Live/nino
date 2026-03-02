# Fix

- in 

- execution plan buttons and paragraph

- 


# Add features 

- improve yaml autocompletion an validation for 
    - dataconnector
    - masking (!important)
    - descriptor
    - tables 
    - relations 
    - analyze
- in NinoWorspace.js : 
    - add icons for each file type 
        - dataconnector.yaml
        - masking.yaml
        - ingress-descriptor.yaml 
        - tables.yaml 
        - relations.yaml 
        - analyze.yaml

# Quality  
- stabilize static examples 
- better css
- test 

# Deployement
- conteneurisation
- product release
- product demo 

# commandes utiles 
```sh
go build . &&  docker build -t 0blive/nino . && docker run -it -p 2442:2442 0blive/nino
```