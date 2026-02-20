module.exports = {
  allowCypressEnv: false,
  viewportWidth: 1280,
  viewportHeight: 720,

  e2e: {
    baseUrl: 'http://localhost:2442/nino',
    specPattern: 'tests/cypress/e2e/**/*.cy.js',
    supportFile: 'tests/cypress/support/e2e.js',
    experimentalRunAllSpecs: true,

    video: true,
    videoUploadOnPasses: true,
    videosFolder: 'tests/cypress/videos',
    videoCompression:10,
    screenshotsFolder: 'tests/cypress/screenshots',  
    downloadsFolder: 'tests/cypress/downloads',

    
    chromeWebSecurity: false,
    defaultBrowser: 'chromium',

    setupNodeEvents(on, config) {
      // implement node event listeners here
    },
  },
};
