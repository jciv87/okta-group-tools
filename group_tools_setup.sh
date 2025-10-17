#!/bin/bash
# ==============================================================================
# File: setup.sh
# Description: A setup script to create the correct modular project structure
#              for the Okta tools.
# ==============================================================================

# --- Style Functions ---
TEXT_BLUE="\033[0;34m"
TEXT_GREEN="\033[0;32m"
TEXT_BOLD="\033[1m"
TEXT_RESET="\033[0m"

echo_info() {
  echo -e "${TEXT_BLUE}${TEXT_BOLD}INFO:${TEXT_RESET} $1"
}

echo_success() {
  echo -e "${TEXT_GREEN}${TEXT_BOLD}SUCCESS:${TEXT_RESET} $1"
}

# --- Main Script ---
echo_info "Setting up Okta Tools project structure..."
echo "--------------------------------------------------"

# Step 1: Create directories
echo_info "Creating 'services' and 'utils' directories..."
mkdir -p services utils
echo_success "Directories created."
echo "--------------------------------------------------"

# Step 2: Create package.json
echo_info "Creating package.json..."
cat > package.json << EOM
{
  "name": "okta-group-provisioner",
  "version": "5.3.0",
  "description": "A modular and hardened CLI tool to bulk-create Okta groups.",
  "main": "bulk_load.js",
  "private": true,
  "dependencies": {
    "@okta/okta-sdk-nodejs": "^7.0.0",
    "dotenv": "^16.0.0",
    "jira-client": "^8.2.2",
    "yargs": "^17.7.2"
  }
}
EOM
echo_success "package.json created."
echo "--------------------------------------------------"

# Step 3: Create utils/cli.js
echo_info "Creating utils/cli.js..."
cat > utils/cli.js << EOM
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');

function parseArguments() {
  return yargs(hideBin(process.argv))
    .usage('Usage: \$0 --file [path] --jira [ID-KEY] [options]')
    .option('file', {
      alias: 'f',
      describe: 'Path to the input text file containing group names',
      type: 'string',
      demandOption: true,
    })
    .option('jira', {
      describe: 'A pre-existing Jira ticket key to post updates to',
      type: 'string',
      demandOption: true,
    })
    .option('output-file', {
      alias: 'o',
      describe: 'Path to write the successfully created group IDs and names to a JSON file',
      type: 'string',
    })
    .option('description', {
      alias: 'd',
      describe: 'A default description to apply to all created groups',
      type: 'string',
      default: 'Bulk created via script',
    })
    .option('confirm', {
      describe: 'Require interactive confirmation before creating groups',
      type: 'boolean',
      default: true,
    })
    .option('jira-transition', {
        describe: 'Name of the Jira workflow transition to apply on success (e.g., "Done")',
        type: 'string'
    })
    .argv;
}

module.exports = { parseArguments };
EOM
echo_success "utils/cli.js created."
echo "--------------------------------------------------"

# Step 4: Create services/jiraService.js
echo_info "Creating services/jiraService.js..."
cat > services/jiraService.js << EOM
const JiraClient = require('jira-client');

class JiraService {
  constructor() {
    if (!process.env.JIRA_HOST || !process.env.JIRA_USER || !process.env.JIRA_API_TOKEN) {
      throw new Error('Missing Jira environment variables (JIRA_HOST, JIRA_USER, JIRA_API_TOKEN)');
    }
    this.client = new JiraClient({
      protocol: 'https',
      host: process.env.JIRA_HOST,
      username: process.env.JIRA_USER,
      password: process.env.JIRA_API_TOKEN,
      apiVersion: '2',
      strictSSL: true,
    });
  }

  async postComment(ticketKey, commentBody) {
    try {
      await this.client.addComment(ticketKey, commentBody);
      console.log(\`[JIRA] Successfully posted comment to \${ticketKey}.\`);
    } catch (error) {
      console.error(\`[JIRA] FAILED to post comment to \${ticketKey}: \${error.message}\`);
    }
  }
  
  async transitionTicket(ticketKey, transitionName) {
      if (!transitionName) return;
      try {
          const transitions = await this.client.listTransitions(ticketKey);
          const targetTransition = transitions.transitions.find(t => t.name === transitionName);
          
          if (!targetTransition) {
              console.error(\`[JIRA] Transition "\${transitionName}" not found for ticket \${ticketKey}.\`);
              return;
          }

          await this.client.transitionIssue(ticketKey, { transition: { id: targetTransition.id } });
          console.log(\`[JIRA] Successfully transitioned \${ticketKey} to "\${transitionName}".\`);
      } catch (error) {
          console.error(\`[JIRA] FAILED to transition \${ticketKey}: \${error.message}\`);
      }
  }
}

module.exports = JiraService;
EOM
echo_success "services/jiraService.js created."
echo "--------------------------------------------------"

# Step 5: Create services/oktaService.js
echo_info "Creating services/oktaService.js with the final corrected code..."
cat > services/oktaService.js << EOM
const okta = require('@okta/okta-sdk-nodejs');

class OktaService {
  constructor() {
    if (!process.env.OKTA_ORG_URL || !process.env.OKTA_API_TOKEN) {
      throw new Error('Missing Okta environment variables (OKTA_ORG_URL, OKTA_API_TOKEN)');
    }
    this.client = new okta.Client({
      orgUrl: process.env.OKTA_ORG_URL,
      token: process.env.OKTA_API_TOKEN,
    });
  }

  async findExistingGroup(name) {
    let existingGroup = null;
    // The .each() method is the correct way to iterate the collection.
    await this.client.groupApi.listGroups({ q: name }).each(group => {
      existingGroup = group;
    });
    return existingGroup;
  }

  async createGroup(name, description) {
    return this.client.groupApi.createGroup({
      profile: { name, description },
    });
  }
}

module.exports = OktaService;
EOM
echo_success "services/oktaService.js created."
echo "--------------------------------------------------"

# Step 6: Create bulk_load.js
echo_info "Creating the main bulk_load.js script..."
cat > bulk_load.js << EOM
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { parseArguments } = require('./utils/cli');
const OktaService = require('./services/oktaService');
const JiraService = require('./services/jiraService');

function getGroupNamesFromFile(filePath) {
  try {
    const rawContent = fs.readFileSync(path.resolve(filePath), 'utf8');
    return rawContent.split(/\\r?\\n/).map(name => name.trim()).filter(Boolean);
  } catch (error) {
    console.error(\`\\nError reading file at: \${filePath}\`);
    process.exit(1);
  }
}
function askForConfirmation(question) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    return new Promise(resolve => {
        rl.question(question, answer => {
            rl.close();
            resolve(answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y');
        });
    });
}
function writeOutputFile(filePath, createdGroups) {
    if (!filePath) return;
    try {
        fs.writeFileSync(path.resolve(filePath), JSON.stringify(createdGroups, null, 2));
        console.log(\`[INFO] Successfully wrote \${createdGroups.length} groups to \${path.resolve(filePath)}\`);
    } catch (error) {
        console.error(\`[ERROR] Failed to write output file.\`);
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

    console.log('Step 1: Checking for existing groups...');
    for (const name of groupNames) {
      try {
        const existingGroup = await oktaService.findExistingGroup(name);
        if (existingGroup) {
          stats.skipped++;
        } else {
          stats.toCreate.push(name);
        }
      } catch (err) {
        console.error(\`Error checking group "\${name}": \${err.message}\`);
        stats.failed++;
      }
    }

    console.log(\`Step 2: Confirmation. Found \${stats.toCreate.length} new groups to create.\`);
    if (!argv.confirm || await askForConfirmation('Proceed? (yes/no): ')) {
      console.log('Step 3: Executing group creation...');
      for (const name of stats.toCreate) {
        try {
          const createdGroup = await oktaService.createGroup(name, argv.description);
          stats.created++;
          stats.createdDetails.push({ id: createdGroup.id, name: createdGroup.profile.name });
        } catch (error) {
          console.error(\`Error creating group "\${name}": \${error.message}\`);
          stats.failed++;
        }
      }

      console.log('Step 4: Reporting results...');
      if (argv['output-file'] && stats.createdDetails.length > 0) {
        writeOutputFile(argv['output-file'], stats.createdDetails);
      }

      const summary = \`h2. Bulk Provisioner Summary\\n*Created:* \${stats.created}\\n*Skipped (Existing):* \${stats.skipped}\\n*Failed:* \${stats.failed}\`;
      await jiraService.postComment(argv.jira, summary);
      
      if (stats.failed === 0 && argv['jira-transition']) {
          await jiraService.transitionTicket(argv.jira, argv['jira-transition']);
      }

    } else {
      console.log('Operation cancelled by user.');
    }

  } catch (error) {
    console.error(\`\\nFATAL ERROR: \${error.message}\`);
    process.exit(1);
  }
  
  console.log('--- Bulk Provisioner Finished ---');
}

main();
EOM
echo_success "bulk_load.js created."
echo "--------------------------------------------------"

echo_success "Project setup complete!"
echo_info "Next, run 'npm install' to install dependencies."
