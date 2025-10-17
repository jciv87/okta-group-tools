require('dotenv').config();
const okta = require('@okta/okta-sdk-nodejs');

/**
 * This script is designed to diagnose the Okta Node.js SDK's listGroups method.
 * It will connect to Okta, call the function, and then print detailed information
 * about the object that is returned, helping to identify its type and available methods.
 */
async function diagnose() {
  console.log('--- Starting Okta SDK Diagnostic Tool ---');

  try {
    // Step 1: Initialize the client (same as in the main script)
    const client = new okta.Client({
      orgUrl: process.env.OKTA_ORG_URL,
      token: process.env.OKTA_API_TOKEN,
    });
    console.log('[INFO] Okta Client initialized.');

    // Step 2: Call the problematic function
    console.log('[INFO] Calling client.groupApi.listGroups({ q: "Everyone" })...');
    const result = await client.groupApi.listGroups({ q: 'Everyone' }); // Using a common group name for the test
    console.log('[SUCCESS] Call completed without errors.');
    
    console.log('\n--- DIAGNOSTIC RESULTS ---');

    // Step 3: Analyze the returned object
    console.log(`1. Type of result: ${typeof result}`);
    console.log(`2. Is it an array? ${Array.isArray(result)}`);
    
    // Step 4: Log the object itself to see its structure
    console.log('3. Full object structure:');
    console.dir(result, { depth: 5 }); // console.dir provides better object inspection

    console.log('\n--- ANALYSIS ---');
    if (Array.isArray(result)) {
        console.log('The result is a standard array. The .find() method should work.');
    } else if (typeof result.each === 'function') {
        console.log('The result is a Collection object with an .each() method. This is likely SDK v7+.');
    } else if (typeof result.toArray === 'function') {
        console.log('The result is a Collection object with a .toArray() method. This is likely an older SDK version.');
    } else {
        console.log('The result is not a standard array and does not have the expected iterator methods. Inspect the structure above to determine how to access the group data.');
    }

  } catch (error) {
    console.error('\n--- DIAGNOSTIC FAILED ---');
    console.error(`An error occurred: ${error.message}`);
    console.error(error.stack);
  }

  console.log('\n--- Diagnostic Finished ---');
}

diagnose();

