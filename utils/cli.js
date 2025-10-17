const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');

function parseArguments() {
  return yargs(hideBin(process.argv))
    .usage('Usage: $0 --file [path] --jira [ID-KEY] [options]')
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
