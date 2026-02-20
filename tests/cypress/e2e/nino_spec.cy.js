describe('NinoApp E2E Tests', () => {
    beforeEach(() => {
        // Visit the application before each test
        cy.visit('/');
        // Wait for the workspace to be ready
        cy.get('nino-workspace').shadow().find('#jstree-workspace').should('not.be.empty');
    });

    context('File handling', () => {
        it('Open dataconnector', () => {
            // Find the 'petstore' folder and then the 'dataconnector.yaml' file
            cy.label('click on a dataconnector.yaml');
            cy.get('nino-workspace').shadow()
                .contains('.jstree-anchor', 'petstore').parent()
                .find('.jstree-children')
                .contains('.jstree-anchor', 'dataconnector.yaml')
                .dblclick();
            
            cy.label('it opens a new tab');
             
            
            // Assert that the new tab is visible in the editor
            cy.get('nino-editor').shadow()
                .find('.tab-button[data-file-name="dataconnector.yaml"]')
                .should('be.visible')
                .and('have.class', 'active');
            cy.label('and renders in the editor'); 


            cy.label('click a masking file');

            // Find the 'petstore' folder and then the 'owners-masking.yaml' file
            cy.get('nino-workspace').shadow()
                .contains('.jstree-anchor', 'petstore').parent()
                .find('.jstree-children')
                .contains('.jstree-anchor', 'owners-masking.yaml')
                .dblclick(); 
            cy.label('masking tab opens');

            // Assert that the new tab is visible in the editor
            cy.get('nino-editor').shadow()
                .find('.tab-button[data-file-name="owners-masking.yaml"]')
                .should('be.visible')
                .and('have.class', 'active');
            
            cy.label('and renders');
        });
    });

    context('UI Interactions', () => {
        it('resize handler', () => {

            cy.label('Resize handler');

            const editorPanelSelector = 'nino-editor';
            const executionPanelSelector = 'nino-execution';
            const resizeHandle = '#resize-handle-h';

            let initialEditorWidth;

            cy.get(editorPanelSelector).invoke('width').then((width) => {
                initialEditorWidth = width;
            });
 
            // Simulate dragging the resize handle
            cy.get(resizeHandle)
                .trigger('mousedown', { which: 1, pageX: 600 })
                .trigger('mousemove', { which: 1, pageX: 500 }) // Move 100px to the left
                .trigger('mouseup');
            cy.label('drag the resize handle');

            // Assert that the editor panel width has changed
            cy.get(editorPanelSelector).invoke('width').should((newWidth) => {
                expect(newWidth).to.not.equal(initialEditorWidth);
                expect(newWidth).to.be.lessThan(initialEditorWidth);
            });
            cy.label('the panels renders');
        });

        it('Execution Plan', () => { 
            cy.label('click tab');
            cy.get('nino-editor').shadow()
                .find('.tab-button[data-tab="execution"]')
                .click(); 

            // Assert the graphviz component for the execution plan is visible
            cy.get('nino-editor').shadow()
                .find('#execution-view-container')
                .should('be.visible')
                .and((container) => {
                    // Assert that an SVG is rendered and it's not empty
                    const svg = container[0].shadowRoot.querySelector('svg');
                    expect(svg).to.exist;
                    expect(svg.children.length).to.be.greaterThan(0);
                });
            cy.label('it renders');
        });
    });
});
