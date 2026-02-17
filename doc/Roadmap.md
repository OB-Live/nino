# Fix

- execute button 


- Have an object Nĭnŏ, globaly accessible through window.Nĭnŏ. created in NinoApp.js. The object will be containing {createMasking, createPlaybook, createBash, createDataconnector, createFolder}, methods calling the backend API :
    - createMasking using api URL: NĭnŏAPI.createMasking then log the result in the console 
    - createDataconnector using api URL: NĭnŏAPI.createDataConnector then log the result in the console 
    - createBash using api URL: NĭnŏAPI.createBash then log the result in the console 
    - create playbook calling api URL: NĭnŏAPI.createPlaybook then log the result in the console 
    - createFolder calling api URL: NĭnŏAPI.postFolder then log the result in the console 

- execution plan buttons and paragraph
- Uncaught TypeError: Cannot read properties of undefined (reading 'yaml') 
    this.editorInstances.yaml ? this.editorInstances


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