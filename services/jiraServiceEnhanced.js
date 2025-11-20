const JiraClient = require('jira-client');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');

class JiraServiceEnhanced {
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

  /**
   * List all accessible projects
   */
  async listProjects() {
    try {
      const projects = await this.client.listProjects();
      return projects.map(p => ({
        key: p.key,
        name: p.name,
        id: p.id
      }));
    } catch (error) {
      console.error(`[JIRA] Failed to list projects: ${error.message}`);
      return [];
    }
  }

  /**
   * List boards for a project
   */
  async listBoards(projectKeyOrId) {
    try {
      const boards = await this.client.getAllBoards(0, 50, null, projectKeyOrId);
      return boards.values.map(b => ({
        id: b.id,
        name: b.name,
        type: b.type
      }));
    } catch (error) {
      console.error(`[JIRA] Failed to list boards: ${error.message}`);
      return [];
    }
  }

  /**
   * Get available transitions for a ticket
   */
  async getTransitions(ticketKey) {
    try {
      const transitions = await this.client.listTransitions(ticketKey);
      return transitions.transitions.map(t => ({
        id: t.id,
        name: t.name,
        to: t.to?.name
      }));
    } catch (error) {
      console.error(`[JIRA] Failed to get transitions for ${ticketKey}: ${error.message}`);
      return [];
    }
  }

  /**
   * Create a new issue
   */
  async createIssue(projectKey, summary, description, issueType = 'Task') {
    try {
      const issue = {
        fields: {
          project: { key: projectKey },
          summary: summary,
          description: description,
          issuetype: { name: issueType }
        }
      };

      const result = await this.client.addNewIssue(issue);
      console.log(`[JIRA] Created issue ${result.key}`);
      return result;
    } catch (error) {
      console.error(`[JIRA] Failed to create issue: ${error.message}`);
      throw error;
    }
  }

  /**
   * Post a comment to an existing ticket
   */
  async postComment(ticketKey, commentBody) {
    try {
      await this.client.addComment(ticketKey, commentBody);
      console.log(`[JIRA] Successfully posted comment to ${ticketKey}`);
    } catch (error) {
      console.error(`[JIRA] FAILED to post comment to ${ticketKey}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Transition a ticket to a new status
   */
  async transitionTicket(ticketKey, transitionName) {
    if (!transitionName) return;
    try {
      const transitions = await this.client.listTransitions(ticketKey);
      const targetTransition = transitions.transitions.find(t =>
        t.name.toLowerCase() === transitionName.toLowerCase() ||
        t.to?.name.toLowerCase() === transitionName.toLowerCase()
      );

      if (!targetTransition) {
        console.error(`[JIRA] Transition "${transitionName}" not found for ticket ${ticketKey}`);
        console.error(`Available transitions:`, transitions.transitions.map(t => t.name));
        return;
      }

      await this.client.transitionIssue(ticketKey, { transition: { id: targetTransition.id } });
      console.log(`[JIRA] Successfully transitioned ${ticketKey} to "${transitionName}"`);
    } catch (error) {
      console.error(`[JIRA] FAILED to transition ${ticketKey}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Attach a file to a ticket
   */
  async attachFile(ticketKey, filePath) {
    try {
      const fileName = path.basename(filePath);
      const fileContent = fs.readFileSync(filePath);

      await this.client.addAttachmentOnIssue(ticketKey, fileContent);
      console.log(`[JIRA] Successfully attached ${fileName} to ${ticketKey}`);
    } catch (error) {
      console.error(`[JIRA] FAILED to attach file to ${ticketKey}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Format a rich comment with operation details
   */
  formatOperationComment(operation) {
    const {
      type, // 'user_access', 'rule_update', 'bulk_create'
      user,
      groups,
      rule,
      stats,
      operator,
      timestamp,
      manifestPath,
      rollbackInstructions
    } = operation;

    let comment = `h2. Okta Operation: ${type}\n\n`;
    comment += `*Performed by:* ${operator}\n`;
    comment += `*Timestamp:* ${timestamp}\n`;
    comment += `*Status:* {color:green}✓ Completed Successfully{color}\n\n`;

    switch (type) {
      case 'user_access':
        comment += `h3. User Access Change\n`;
        comment += `*User:* ${user.login} (${user.firstName} ${user.lastName})\n`;
        comment += `*User ID:* ${user.id}\n\n`;

        if (groups.added && groups.added.length > 0) {
          comment += `h4. Groups Added (${groups.added.length})\n`;
          groups.added.forEach(g => {
            comment += `* {color:green}+{color} ${g.name}\n`;
          });
          comment += `\n`;
        }

        if (groups.removed && groups.removed.length > 0) {
          comment += `h4. Groups Removed (${groups.removed.length})\n`;
          groups.removed.forEach(g => {
            comment += `* {color:red}-{color} ${g.name}\n`;
          });
          comment += `\n`;
        }

        if (manifestPath) {
          comment += `h4. Rollback Information\n`;
          comment += `*Manifest File:* {{${path.basename(manifestPath)}}}\n`;
          comment += `*Rollback Command:*\n{code}npm run wizard → Reset User Access → Select manifest{code}\n\n`;
        }
        break;

      case 'rule_update':
        comment += `h3. Group Rule Update\n`;
        comment += `*Rule Name:* ${rule.name}\n`;
        comment += `*Rule ID:* ${rule.id}\n`;
        comment += `*Rule Status:* ${rule.status}\n\n`;

        if (groups.added && groups.added.length > 0) {
          comment += `h4. Groups Added to Rule (${groups.added.length})\n`;
          groups.added.forEach(g => {
            comment += `* {color:green}+{color} ${g}\n`;
          });
          comment += `\n`;
        }

        if (groups.removed && groups.removed.length > 0) {
          comment += `h4. Groups Removed from Rule (${groups.removed.length})\n`;
          groups.removed.forEach(g => {
            comment += `* {color:red}-{color} ${g}\n`;
          });
          comment += `\n`;
        }

        comment += `h4. Impact\n`;
        comment += `This rule affects all users matching: {{${rule.condition}}}\n\n`;
        break;

      case 'bulk_create':
        comment += `h3. Bulk Group Creation\n`;
        comment += `*Total Groups Processed:* ${stats.total}\n`;
        comment += `*Created:* {color:green}${stats.created}{color}\n`;
        comment += `*Skipped (Existing):* {color:gray}${stats.skipped}{color}\n`;
        comment += `*Failed:* {color:red}${stats.failed}{color}\n\n`;
        break;
    }

    comment += `\n---\n`;
    comment += `_Automated via [Okta Group Tools|https://github.com/your-org/okta-group-tools]_`;

    return comment;
  }

  /**
   * Complete Jira workflow: create or update ticket, attach manifest, transition
   */
  async completeWorkflow(operation, options = {}) {
    const {
      ticketKey,
      projectKey,
      createNewTicket,
      transitionTo,
      attachManifest
    } = options;

    try {
      let finalTicketKey = ticketKey;

      // Create new ticket if requested
      if (createNewTicket && projectKey) {
        const summary = `Okta ${operation.type}: ${operation.user?.login || operation.rule?.name || 'Bulk Operation'}`;
        const description = this.formatOperationComment(operation);
        const result = await this.createIssue(projectKey, summary, description);
        finalTicketKey = result.key;
      }

      // Post comment to existing ticket
      if (!createNewTicket && finalTicketKey) {
        const comment = this.formatOperationComment(operation);
        await this.postComment(finalTicketKey, comment);
      }

      // Attach manifest file if it exists
      if (attachManifest && operation.manifestPath && finalTicketKey) {
        if (fs.existsSync(operation.manifestPath)) {
          await this.attachFile(finalTicketKey, operation.manifestPath);
        }
      }

      // Transition ticket
      if (transitionTo && finalTicketKey) {
        await this.transitionTicket(finalTicketKey, transitionTo);
      }

      return finalTicketKey;

    } catch (error) {
      console.error(`[JIRA] Workflow failed: ${error.message}`);
      throw error;
    }
  }
}

module.exports = JiraServiceEnhanced;
