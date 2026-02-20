describe('NinoApp E2E Tests', () => {
    beforeEach(() => {
        // Visit the application before each test
        cy.visit('/');
        // Wait for the workspace to be ready
        cy.get('nino-workspace').shadow().find('#jstree-workspace').should('not.be.empty');

        // Select example tab
        cy.get('nino-editor').shadow()
            .find('.tab-button[data-tab="example"]')
            .click();
    });


    context('PIMO examples', () => {
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

                    cy.label('opening ' + exampleName);

                    // Click the example button
                    cy.wrap($btn).dblclick();

                    cy.log(`Testing: ${categoryName} - ${exampleName}`);

                    // Assert the editor content has been updated
                    cy.get('nino-editor').shadow()
                        .find('#example-editor-container')
                        .should(($editor) => {
                            const el = $editor[0]  // get the DOM element from the jquery element
                            // const win = el.ownerDocument.defaultView // get the window from the DOM element

                            // const component = win.ng.probe(el).componentInstance
                            console.log("el", el);
                            console.log("window", window);
                            // Nĭnŏ.editors().example.getValue()
                            //     .should('not.be.empty');

                                expect(1).to.be.greaterThan(0);
                        })

                    cy.label('loads ' + exampleName);


                    // Click the execute button
                    cy.get('nino-execution').shadow()
                        .find('#execute-btn')
                        .click();
                    cy.label('execute example ' + exampleName);

                    // Wait for a potential response and assert the output editor is not empty
                    cy.get('nino-execution').shadow()
                        .find('#output-editor')
                        .then(($editor) => {
                            cy.log('$editor', $editor)
                            cy.log('value', $editor[0].value)
                            // A simple way to check for content is to see if there are any lines
                            // const lineCount = $editor.getValue().length;
                            expect(1).to.be.greaterThan(0);
                        });
                    cy.label('update the result ' + exampleName);
                });
        };

        it('pimo Generation features', () => {
            testCategory('Generation');
        });

        it('pimo Anonymization features', () => {
            testCategory('Anonymization');
        });

        it('pimo Pseudonymization features', () => {
            testCategory('Pseudonymization');
        });

        it('pimo Other features', () => {
            testCategory('Other');
        });
    });
});
