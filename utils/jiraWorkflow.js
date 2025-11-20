const inquirer = require('inquirer');
const chalk = require('chalk');
const JiraServiceEnhanced = require('../services/jiraServiceEnhanced');
const os = require('os');

/**
 * Interactive Jira integration workflow
 * Walks user through posting to Jira with full context
 */

async function promptForJiraAction(operation) {
  try {
    // Check if Jira is configured
    if (!process.env.JIRA_HOST || !process.env.JIRA_USER || !process.env.JIRA_API_TOKEN) {
      console.log(chalk.yellow('\n📋 Jira integration is not configured.'));
      console.log(chalk.gray('   To enable, set JIRA_HOST, JIRA_USER, and JIRA_API_TOKEN in your .env file.\n'));
      return null;
    }

    console.log(chalk.cyan('\n' + '='.repeat(60)));
    console.log(chalk.cyan('  Jira Integration'));
    console.log(chalk.cyan('='.repeat(60) + '\n'));

    const { wantJira } = await inquirer.prompt([{
      type: 'confirm',
      name: 'wantJira',
      message: 'Would you like to create/update a Jira ticket for this operation?',
      default: true
    }]);

    if (!wantJira) {
      console.log(chalk.gray('Skipping Jira integration.\n'));
      return null;
    }

    const jiraService = new JiraServiceEnhanced();

    // Step 1: Create new ticket or update existing?
    const { actionType } = await inquirer.prompt([{
      type: 'list',
      name: 'actionType',
      message: 'What would you like to do?',
      choices: [
        { name: 'Update an existing ticket', value: 'update' },
        { name: 'Create a new ticket', value: 'create' },
        { name: 'Cancel Jira integration', value: 'cancel' }
      ]
    }]);

    if (actionType === 'cancel') {
      console.log(chalk.gray('Jira integration cancelled.\n'));
      return null;
    }

    let ticketKey = null;
    let projectKey = null;

    if (actionType === 'update') {
      // Update existing ticket
      const { ticket } = await inquirer.prompt([{
        type: 'input',
        name: 'ticket',
        message: 'Enter the Jira ticket key (e.g., PROJ-123):',
        validate: input => {
          if (!input) return 'Ticket key cannot be empty';
          if (!/^[A-Z]+-\d+$/.test(input)) return 'Invalid format. Use: PROJ-123';
          return true;
        }
      }]);
      ticketKey = ticket.toUpperCase();

    } else if (actionType === 'create') {
      // Create new ticket - need project
      console.log(chalk.gray('\nFetching your Jira projects...'));

      const projects = await jiraService.listProjects();

      if (projects.length === 0) {
        console.log(chalk.red('No projects found. Check your Jira permissions.'));
        return null;
      }

      const { selectedProject } = await inquirer.prompt([{
        type: 'list',
        name: 'selectedProject',
        message: 'Select a project for the new ticket:',
        choices: projects.map(p => ({
          name: `${p.key} - ${p.name}`,
          value: p.key
        })),
        pageSize: 10
      }]);

      projectKey = selectedProject;
    }

    // Step 2: Attach manifest file?
    let attachManifest = false;
    if (operation.manifestPath) {
      const { attach } = await inquirer.prompt([{
        type: 'confirm',
        name: 'attach',
        message: `Attach rollback manifest (${require('path').basename(operation.manifestPath)})?`,
        default: true
      }]);
      attachManifest = attach;
    }

    // Step 3: Transition ticket after posting?
    let transitionTo = null;
    if (ticketKey) {
      const { wantTransition } = await inquirer.prompt([{
        type: 'confirm',
        name: 'wantTransition',
        message: 'Transition the ticket after posting?',
        default: false
      }]);

      if (wantTransition) {
        console.log(chalk.gray('Fetching available transitions...'));
        const transitions = await jiraService.getTransitions(ticketKey);

        if (transitions.length > 0) {
          const { selectedTransition } = await inquirer.prompt([{
            type: 'list',
            name: 'selectedTransition',
            message: 'Select transition:',
            choices: [
              ...transitions.map(t => ({
                name: `${t.name} → ${t.to}`,
                value: t.name
              })),
              { name: 'Skip transition', value: null }
            ]
          }]);
          transitionTo = selectedTransition;
        }
      }
    }

    // Step 4: Preview what will be posted
    console.log(chalk.cyan('\n' + '─'.repeat(60)));
    console.log(chalk.cyan('  Preview'));
    console.log(chalk.cyan('─'.repeat(60)));

    const comment = jiraService.formatOperationComment(operation);
    console.log(chalk.gray(comment));

    console.log(chalk.cyan('─'.repeat(60) + '\n'));

    const { confirmPost } = await inquirer.prompt([{
      type: 'confirm',
      name: 'confirmPost',
      message: 'Post this to Jira?',
      default: true
    }]);

    if (!confirmPost) {
      console.log(chalk.yellow('Jira post cancelled.\n'));
      return null;
    }

    // Step 5: Execute the Jira workflow
    console.log(chalk.cyan('\nPosting to Jira...'));

    const finalTicketKey = await jiraService.completeWorkflow(operation, {
      ticketKey,
      projectKey,
      createNewTicket: actionType === 'create',
      transitionTo,
      attachManifest
    });

    console.log(chalk.green(`\n✓ Successfully posted to Jira: ${finalTicketKey}`));

    if (attachManifest) {
      console.log(chalk.green(`✓ Attached manifest file`));
    }

    if (transitionTo) {
      console.log(chalk.green(`✓ Transitioned to: ${transitionTo}`));
    }

    console.log(chalk.cyan(`\n🔗 View ticket: https://${process.env.JIRA_HOST}/browse/${finalTicketKey}\n`));

    return finalTicketKey;

  } catch (error) {
    console.error(chalk.red('\n✗ Jira integration failed:'), error.message);
    console.error(chalk.gray('Operation completed in Okta, but Jira update failed.'));
    return null;
  }
}

/**
 * Build operation object for Jira posting
 */
function buildUserAccessOperation(user, groupsAdded, groupsRemoved, manifestPath = null) {
  return {
    type: 'user_access',
    user: {
      login: user.profile?.login || user.login,
      firstName: user.profile?.firstName || 'Unknown',
      lastName: user.profile?.lastName || 'Unknown',
      id: user.id
    },
    groups: {
      added: groupsAdded.map(g => ({ name: g.name || g, id: g.id || g })),
      removed: groupsRemoved.map(g => ({ name: g.name || g, id: g.id || g }))
    },
    operator: os.userInfo().username,
    timestamp: new Date().toISOString(),
    manifestPath,
    rollbackInstructions: manifestPath ? `Use manifest: ${require('path').basename(manifestPath)}` : null
  };
}

function buildRuleUpdateOperation(rule, groupsAdded, groupsRemoved) {
  return {
    type: 'rule_update',
    rule: {
      name: rule.name,
      id: rule.id,
      status: rule.status,
      condition: rule.conditions?.expression?.value || 'N/A'
    },
    groups: {
      added: groupsAdded,
      removed: groupsRemoved
    },
    operator: os.userInfo().username,
    timestamp: new Date().toISOString()
  };
}

function buildBulkCreateOperation(stats) {
  return {
    type: 'bulk_create',
    stats: {
      total: stats.created + stats.skipped + stats.failed,
      created: stats.created,
      skipped: stats.skipped,
      failed: stats.failed
    },
    operator: os.userInfo().username,
    timestamp: new Date().toISOString()
  };
}

module.exports = {
  promptForJiraAction,
  buildUserAccessOperation,
  buildRuleUpdateOperation,
  buildBulkCreateOperation
};
