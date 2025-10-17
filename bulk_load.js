require('dotenv').config();
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { parseArguments } = require('./utils/cli');
const OktaService = require('./services/oktaService');
const JiraService = require('./services/jiraService');

// Helper function to read group names from a file.
function getGroupNamesFromFile(filePath) {
  try {
    const rawContent = fs.readFileSync(path.resolve(filePath), 'utf8');
    return rawContent.split(/\r?\n/).map(name => name.trim()).filter(Boolean);
  } catch (error) {
    console.error(`\nError reading file at: ${filePath}`);
    process.exit(1);
  }
}

// Helper function for user confirmation prompts.
function askForConfirmation(question) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    return new Promise(resolve => {
        rl.question(question, answer => {
            rl.close();
            resolve(answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y');
        });
    });
}

// Helper function to write results to a JSON file.
function writeOutputFile(filePath, createdGroups) {
    if (!filePath) return;
    try {
        fs.writeFileSync(path.resolve(filePath), JSON.stringify(createdGroups, null, 2));
        console.log(`[INFO] Successfully wrote ${createdGroups.length} groups to ${path.resolve(filePath)}`);
    } catch (error) {
        console.error(`[ERROR] Failed to write output file.`);
    }
}

async function main() {
  console.log('--- Starting Bulk Group Provisioner (v5.3) ---');
  
  try {
    const argv = parseArguments();
    const oktaService = new OktaService();
    const jiraService = new JiraService();

    const groupNames = getGroupNamesFromFile(argv.file);
    const stats = { created: 0, skipped: 0, failed: 0, toCreate: [], createdDetails: [] };

    console.log(`Step 1: Checking for ${groupNames.length} groups from input file...`);
    for (const name of groupNames) {
      try {
        const existingGroup = await oktaService.findExistingGroup(name);
        if (existingGroup) {
          // NEW: Added verbose logging for skipped groups.
          console.log(`  [SKIPPED] Group "${name}" already exists (ID: ${existingGroup.id}).`);
          stats.skipped++;
        } else {
          // NEW: Added verbose logging for groups that will be created.
          console.log(`  [NEW] Group "${name}" will be created.`);
          stats.toCreate.push(name);
        }
      } catch (err) {
        console.error(`  [ERROR] Error checking group "${name}": ${err.message}`);
        stats.failed++;
      }
    }

    // NEW: Added a summary of the check before the confirmation step.
    console.log(`\nCheck complete. Found ${stats.skipped} existing groups. Ready to create ${stats.toCreate.length}.`);
    console.log('--------------------------------------------------');


    console.log(`Step 2: Confirmation. Found ${stats.toCreate.length} new groups to create.`);
    if (stats.toCreate.length === 0) {
        console.log("No new groups to create. Exiting.");
    } else if (!argv.confirm || await askForConfirmation('Proceed? (yes/no): ')) {
      console.log('\nStep 3: Executing group creation...');
      for (const name of stats.toCreate) {
        try {
          const createdGroup = await oktaService.createGroup(name, argv.description);
          console.log(`  [SUCCESS] Created group "${createdGroup.profile.name}" (ID: ${createdGroup.id})`);
          stats.created++;
          stats.createdDetails.push({ id: createdGroup.id, name: createdGroup.profile.name });
        } catch (error) {
          console.error(`  [ERROR] Failed to create group "${name}": ${error.message}`);
          stats.failed++;
        }
      }

      console.log('\nStep 4: Reporting results...');
      if (argv['output-file'] && stats.createdDetails.length > 0) {
        writeOutputFile(argv['output-file'], stats.createdDetails);
      }

      const summary = `h2. Bulk Provisioner Summary\n*Created:* ${stats.created}\n*Skipped (Existing):* ${stats.skipped}\n*Failed:* ${stats.failed}`;
      await jiraService.postComment(argv.jira, summary);
      
      if (stats.failed === 0 && argv['jira-transition']) {
          await jiraService.transitionTicket(argv.jira, argv['jira-transition']);
      }

    } else {
      console.log('Operation cancelled by user.');
    }

  } catch (error) {
    console.error(`\nFATAL ERROR: ${error.message}`);
    process.exit(1);
  }
  
  console.log('\n--- Bulk Provisioner Finished ---');
}

main();
