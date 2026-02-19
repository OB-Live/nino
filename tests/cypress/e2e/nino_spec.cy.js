describe('NinoApp E2E Tests', () => {
    beforeEach(() => {
        // Visit the application before each test
        cy.visit('/');
        // Wait for the workspace to be ready
        cy.get('nino-workspace').shadow().find('#jstree-workspace').should('not.be.empty');
    });

    context('File handling', () => {
        it('should open petstore/dataconnector.yaml and assert the tab opens', () => {
            // Find the 'petstore' folder and then the 'dataconnector.yaml' file
            cy.get('nino-workspace').shadow()
                .contains('.jstree-anchor', 'petstore').parent()
                .find('.jstree-children')
                .contains('.jstree-anchor', 'dataconnector.yaml')
                .dblclick();
            cy.screenshot({overwrite: true})
            
            // Assert that the new tab is visible in the editor
            cy.get('nino-editor').shadow()
                .find('.tab-button[data-file-name="dataconnector.yaml"]')
                .should('be.visible')
                .and('have.class', 'active');
            cy.screenshot({overwrite: true})
        });

        it('should open petstore/owners-masking.yaml and assert the tab opens', () => {
            // Find the 'petstore' folder and then the 'owners-masking.yaml' file
            cy.get('nino-workspace').shadow()
                .contains('.jstree-anchor', 'petstore').parent()
                .find('.jstree-children')
                .contains('.jstree-anchor', 'owners-masking.yaml')
                .dblclick();

            // Assert that the new tab is visible in the editor
            cy.get('nino-editor').shadow()
                .find('.tab-button[data-file-name="owners-masking.yaml"]')
                .should('be.visible')
                .and('have.class', 'active');
        });
    });

    context('UI Interactions', () => {
        it('should resize panels using the resize handler', () => {
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

            // Assert that the editor panel width has changed
            cy.get(editorPanelSelector).invoke('width').should((newWidth) => {
                expect(newWidth).to.not.equal(initialEditorWidth);
                expect(newWidth).to.be.lessThan(initialEditorWidth);
            });
        });

        it('should click on execute plan and assert a graph is loaded and not empty', () => {
            // Click the 'Execution Plan' tab
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
        });
    });

    context('Examples Testing', () => {
        const testCategory = (categoryName) => {
            // Expand the category
            cy.get('nino-workspace').shadow()
                .contains('.accordion-trigger', categoryName)
                .click();

            // Get all example buttons within this category
            cy.get('nino-workspace').shadow()
                .contains('.accordion-trigger', categoryName)
                .next('.accordion-content')
                .find('.example-btn')
                .each(($btn) => {
                    const exampleName = $btn.find('.example-name').text();
 
                    // Click the example button
                    cy.wrap($btn).click();

                    cy.log(`Testing: ${categoryName} - ${exampleName}`);
                    cy.screenshot({overwrite: true})

                    // Assert the editor content has been updated
                    cy.get('nino-editor').shadow()
                        .find('#example-editor-container')
                        .invoke('val')
                        .screenshot()
                        .should('not.be.empty');

                    cy.screenshot({overwrite: true})

                    // Click the execute button
                    cy.get('nino-execution').shadow()
                        .find('#execute-btn')
                        .click();

                    // Wait for a potential response and assert the output editor is not empty
                    cy.get('nino-execution').shadow()
                        .find('#output-editor')
                        .shadow()
                        .find('.monaco-editor')
                        .should(($editor) => {
                            // A simple way to check for content is to see if there are any lines
                            const lineCount = $editor.find('.view-line').length;
                            expect(lineCount).to.be.greaterThan(0);
                        });
                });
        };

        it('should test the "Generation" examples one by one', () => {
            testCategory('Generation');
        });

        it('should test the "Anonymization" examples one by one', () => {
            testCategory('Anonymization');
        });

        it('should test the "Pseudonymization" examples one by one', () => {
            testCategory('Pseudonymization');
        });

        it('should test the "Other" examples one by one', () => {
            testCategory('Other');
        });
    });
});
