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
      console.log(`[JIRA] Successfully posted comment to ${ticketKey}.`);
    } catch (error) {
      console.error(`[JIRA] FAILED to post comment to ${ticketKey}: ${error.message}`);
    }
  }
  
  async transitionTicket(ticketKey, transitionName) {
      if (!transitionName) return;
      try {
          const transitions = await this.client.listTransitions(ticketKey);
          const targetTransition = transitions.transitions.find(t => t.name === transitionName);
          
          if (!targetTransition) {
              console.error(`[JIRA] Transition "${transitionName}" not found for ticket ${ticketKey}.`);
              return;
          }

          await this.client.transitionIssue(ticketKey, { transition: { id: targetTransition.id } });
          console.log(`[JIRA] Successfully transitioned ${ticketKey} to "${transitionName}".`);
      } catch (error) {
          console.error(`[JIRA] FAILED to transition ${ticketKey}: ${error.message}`);
      }
  }
}

module.exports = JiraService;
