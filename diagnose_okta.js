/*
================================================================================
File: diagnose_okta.js
Description: A tool to diagnose the Okta SDK environment. It initializes the
             client and prints its structure to help debug versioning and
             initialization issues.
================================================================================
*/

// Load environment variables from .env file
require('dotenv').config();

// Import the Okta SDK
const okta = require('@okta/okta-sdk-nodejs');

console.log('--- Starting Okta SDK Diagnostic Tool ---');
console.log('This tool will attempt to initialize the Okta client and inspect its properties.');
console.log('--------------------------------------------------\n');

try {
    // Step 1: Check for required environment variables
    console.log('Step 1: Checking for environment variables...');
    if (!process.env.OKTA_ORG_URL || !process.env.OKTA_API_TOKEN) {
        throw new Error('FAILED: Missing required environment variables. Please ensure OKTA_ORG_URL and OKTA_API_TOKEN are set in your .env file.');
    }
    console.log('  ✓ OKTA_ORG_URL found.');
    console.log('  ✓ OKTA_API_TOKEN found.\n');

    // Step 2: Attempt to initialize the Okta Client
    console.log('Step 2: Initializing Okta Client...');
    const oktaClient = new okta.Client({
        orgUrl: process.env.OKTA_ORG_URL,
        token: process.env.OKTA_API_TOKEN,
    });
    console.log('  ✓ Okta Client object created successfully.\n');

    // Step 3: Inspect the Client and Group API
    console.log('Step 3: Tearing apart the client object to inspect its methods...');

    // Check the client's user agent, which contains the version number.
    if (oktaClient.userAgent) {
        console.log(`  - SDK User Agent (Version): ${oktaClient.userAgent.value}`);
    } else {
        console.log('  - WARNING: Could not determine SDK version from user agent.');
    }

    // Check if the groupApi property exists on the client.
    if (oktaClient.groupApi) {
        console.log('  - SUCCESS: The `groupApi` property exists on the client.');
        
        // Get all the properties (including methods) of the groupApi object.
        const groupApiMethods = Object.getOwnPropertyNames(oktaClient.groupApi);
        console.log('  - Methods found on `groupApi`:');
        console.log(groupApiMethods);

    } else {
        console.error('\n  - CRITICAL FAILURE: The `groupApi` property DOES NOT exist on the Okta client.');
        console.error('    This is the root cause of the errors. It indicates a severe version mismatch or initialization failure.');
    }

} catch (error) {
    console.error('\n--- DIAGNOSTIC FAILED ---');
    console.error(`An error occurred: ${error.message}`);
    console.error('--------------------------');
    process.exit(1);
}

console.log('\n--- Diagnostic Finished ---');
console.log('Please share the complete output of this script.');

