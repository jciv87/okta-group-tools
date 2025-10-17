#!/usr/bin/env node

/**
 * Okta Membership Wizard
 * ======================
 * Part of the Okta Group Tools suite - CLI automation for access management.
 * 
 * This interactive tool supports:
 * 1. Dynamic group rule assignments (including re-creation of immutable rules)
 * 2. Direct user-to-group assignments for temporary access
 * 3. Manifest-based access revocation to safely reset user permissions
 *
 * Companion tools:
 * - bulk_update_user_profile.sh: Bulk profile attribute updates
 * - bulk_load.js: Bulk group operations
 *
 * Author: Created for Okta administrators
 * Version: 7.0.4
 * License: MIT
 */

// =====================================================================
// MODULE IMPORTS
// =====================================================================

require('dotenv').config();
const axios = require('axios');
const inquirer = require('inquirer');
const chalk = require('chalk');
const ora = require('ora');
const figlet = require('figlet');
const fs = require('fs');
const path = require('path');
const os = require('os');
const winston = require('winston');

// =====================================================================
// GLOBAL CONFIGURATION & STATE
// =====================================================================

const config = {
    dirs: {
        logs: path.join(process.cwd(), 'logs'),
        backups: path.join(process.cwd(), 'backups'),
        manifests: path.join(process.cwd(), 'manifests')
    },
    connection: { domain: null, token: null }
};

let spinner = null;
let logger = null;

// =====================================================================
// UI & FILE HELPERS
// =====================================================================

function showWelcomeBanner() {
    console.log(chalk.cyan(figlet.textSync('Okta Membership Wizard', { font: 'Standard' })));
    console.log(chalk.cyan('A tool for managing Group Rules and User Group Memberships.\n'));
    
    // Safety warning
    console.log(chalk.yellow.bold('⚠️  IMPORTANT: This tool modifies production access control'));
    console.log(chalk.gray('   • All changes are logged and backed up'));
    console.log(chalk.gray('   • Manifests enable rollback of user access changes'));
    console.log(chalk.gray('   • You will review changes before they are applied\n'));
}

function showSpinner(message) {
    if (spinner) spinner.stop();
    spinner = ora({ text: message, color: 'cyan' }).start();
}

function stopSpinner(message, isError = false) {
    if (spinner) {
        if (isError) spinner.fail(message);
        else if (message) spinner.succeed(message);
        else spinner.stop();
        spinner = null;
    } else if (message) {
        console.log(isError ? chalk.red(`✗ ${message}`) : chalk.green(`✓ ${message}`));
    }
}

function showSectionHeader(title, step = null) {
    const header = step ? `=== Step ${step}: ${title} ===` : `=== ${title} ===`;
    console.log(chalk.blue(`\n${header}`));
}

function formatRuleForDisplay(rule) {
    let displayText = [
        chalk.bold('Name: ') + rule.name,
        chalk.bold('Status: ') + (rule.status === 'ACTIVE' ? chalk.green(rule.status) : chalk.yellow(rule.status)),
        chalk.bold('Description: ') + (rule.description || 'No description'),
        chalk.bold('ID: ') + rule.id
    ];
    if (rule.actions?.assignUserToGroups?.groupIds) {
        displayText.push(chalk.bold('Assigned Groups: ') + rule.actions.assignUserToGroups.groupIds.length);
    }
    return displayText.join('\n');
}

function generateRevocationManifest(user, added, removed) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const manifestFile = `manifest-${user.profile.login}-${timestamp}.json`;
    const manifestPath = path.join(config.dirs.manifests, manifestFile);
    
    const manifest = {
        generatedAt: new Date().toISOString(),
        operator: os.userInfo().username,
        user: { id: user.id, login: user.profile.login },
        actions: { added, removed }
    };

    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    logger.info('Generated revocation manifest', { user: user.id, manifestFile });
    console.log(chalk.cyan(`\nAccess change manifest saved to: ${manifestPath}`));
}

function backupGroupRule(rule, ruleId) {
    try {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupFilename = `rule_${ruleId}_${timestamp}.json`;
        const backupPath = path.join(config.dirs.backups, backupFilename);
        fs.writeFileSync(backupPath, JSON.stringify(rule, null, 2));
        logger.info(`Group rule backup created`, { action: 'backup', ruleId, backupPath });
        return backupPath;
    } catch (error) {
        stopSpinner('Backup failed.', true);
        throw error;
    }
}

// =====================================================================
// API HELPERS
// =====================================================================

async function makeApiCall(method, url, data = null) {
    const headers = {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': `SSWS ${config.connection.token}`
    };
    try {
        return await axios({ method, url, headers, data });
    } catch (error) {
        if (error.response) {
            const { status, data: responseData, headers: responseHeaders } = error.response;
            if (status === 401) throw new Error('Authentication failed. Check your API token.');
            if (status === 403) throw new Error('You don\'t have permission for this action.');
            if (status === 404) throw new Error('The requested resource was not found.');
            if (status === 429) {
                const retryAfter = parseInt(responseHeaders['retry-after'] || '10', 10);
                console.log(chalk.yellow(`\nRate limited. Retrying in ${retryAfter} seconds...`));
                await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
                return makeApiCall(method, url, data);
            }
            const summary = responseData?.errorSummary || JSON.stringify(responseData);
            const errorCode = responseData?.errorCode;
            const customError = new Error(`Okta API error: ${status} - ${summary}`);
            customError.oktaErrorCode = errorCode;
            throw customError;
        } else if (error.request) {
            throw new Error('No response from Okta. Check network connection and domain.');
        } else {
            throw error;
        }
    }
}

async function listAll(url) {
    let results = [];
    let nextUrl = url;
    while(nextUrl) {
        const response = await makeApiCall('get', nextUrl);
        results = results.concat(response.data);
        const linkHeader = response.headers.link;
        const nextLink = linkHeader?.split(',').find(link => link.includes('rel="next"'));
        nextUrl = nextLink ? nextLink.match(/<(.+)>/)[1] : null;
    }
    return results;
}

async function listGroups() {
    const url = `https://${config.connection.domain}/api/v1/groups?limit=200`;
    showSpinner('Fetching all groups from Okta...');
    try {
        const allGroups = await listAll(url);
        stopSpinner();
        logger.info('Retrieved groups', { action: 'list_groups', count: allGroups.length });
        return allGroups;
    } catch (error) {
        stopSpinner('Failed to retrieve groups.', true);
        throw error;
    }
}

async function getGroupNamesByIds(groupIds) {
    if (groupIds.length === 0) return {};
    const allGroups = await listGroups();
    const groupMap = new Map(allGroups.map(g => [g.id, g.profile.name]));
    const names = {};
    groupIds.forEach(id => { names[id] = groupMap.get(id) || id; });
    return names;
}

// =====================================================================
// WORKFLOW: USER MEMBERSHIPS
// =====================================================================

async function runUserWorkflow() {
    try {
        showSectionHeader("Select User", 2);
        const { userInput } = await inquirer.prompt([{
            type: 'input', name: 'userInput', message: "Enter the user's login or ID:",
            validate: i => i ? true : 'Input cannot be empty.'
        }]);
        
        showSpinner(`Searching for user "${userInput}"...`);
        let user;
        if (userInput.startsWith('00u')) {
            try {
                const userResponse = await makeApiCall('get', `https://${config.connection.domain}/api/v1/users/${userInput}`);
                user = userResponse.data;
            } catch (e) {
                if (!e.message.includes('404')) throw e;
            }
        }

        if (!user) {
            const userSearchUrl = `https://${config.connection.domain}/api/v1/users?search=profile.login eq "${encodeURIComponent(userInput)}"`;
            const userResponse = await makeApiCall('get', userSearchUrl);
            if (userResponse.data.length > 0) {
                user = userResponse.data[0];
            }
        }

        if (!user) {
            throw new Error(`User not found with the provided login or ID: "${userInput}"`);
        }
        
        stopSpinner('User found.');
        console.log(chalk.green(`Operating on user: ${user.profile.firstName} ${user.profile.lastName} (${user.id})`));

        showSectionHeader("Review Current Memberships", 3);
        showSpinner("Fetching user's current groups...");
        const groupsResponse = await makeApiCall('get', `https://${config.connection.domain}/api/v1/users/${user.id}/groups`);
        const currentGroups = groupsResponse.data;
        stopSpinner('Retrieved user groups.');
        
        console.log(chalk.green('\nCurrent Group Memberships:'));
        if (currentGroups.length === 0) {
            console.log('User is not a direct member of any groups.');
        } else {
            currentGroups.forEach((g, i) => console.log(`${i + 1}. ${g.profile.name} (${g.id})`));
        }

        const currentGroupIds = currentGroups.map(g => g.id);
        
        showSectionHeader("Modify Group Assignments", 4);
        const groupsToRemove = await selectGroupsToRemove(currentGroups);
        const groupsToAdd = await selectGroupsToAdd(currentGroupIds);

        if (groupsToAdd.length === 0 && groupsToRemove.length === 0) {
            console.log(chalk.yellow('\nNo changes selected. Exiting.'));
            return;
        }

        showSectionHeader("Review and Confirm Changes", 5);
        const groupNames = await getGroupNamesByIds([...groupsToAdd, ...groupsToRemove]);
        
        console.log(chalk.yellow.bold('\n⚠️  IMPACT SUMMARY'));
        console.log(chalk.gray(`User: ${user.profile.login} (${user.profile.firstName} ${user.profile.lastName})`));
        
        if (groupsToRemove.length > 0) {
            console.log(chalk.red.bold(`\nWill REMOVE user from ${groupsToRemove.length} groups:`));
            groupsToRemove.forEach(g => console.log(chalk.red(` - ${groupNames[g] || g}`)));
            console.log(chalk.gray('   → User will LOSE access granted by these groups'));
        }
        if (groupsToAdd.length > 0) {
            console.log(chalk.green.bold(`\nWill ADD user to ${groupsToAdd.length} groups:`));
            groupsToAdd.forEach(g => console.log(chalk.green(` - ${groupNames[g] || g}`)));
            console.log(chalk.gray('   → User will GAIN access granted by these groups'));
        }
        
        console.log(chalk.cyan.bold('\n📋 A manifest will be generated for rollback if needed'));
        
        const { confirm } = await inquirer.prompt([{ type: 'confirm', name: 'confirm', message: '\nDo you want to apply these changes?', default: true }]);
        if (!confirm) {
            console.log(chalk.yellow('Operation cancelled.'));
            return;
        }

        showSectionHeader("Executing Changes", 6);
        for (const groupId of groupsToRemove) {
            showSpinner(`Removing user from group ${groupNames[groupId] || groupId}...`);
            await makeApiCall('delete', `https://${config.connection.domain}/api/v1/groups/${groupId}/users/${user.id}`);
            stopSpinner(`Removed user from group ${groupNames[groupId] || groupId}.`);
        }
        for (const groupId of groupsToAdd) {
            showSpinner(`Adding user to group ${groupNames[groupId] || groupId}...`);
            await makeApiCall('put', `https://${config.connection.domain}/api/v1/groups/${groupId}/users/${user.id}`);
            stopSpinner(`Added user to group ${groupNames[groupId] || groupId}.`);
        }
        
        generateRevocationManifest(user, groupsToAdd, groupsToRemove);

        console.log(chalk.green.bold('\n✓ User group memberships updated successfully!'));

    } catch (error) {
        stopSpinner('User workflow failed.', true);
        console.log(chalk.red(error.message));
        logger.error('Error in User Workflow', { error: error.message, stack: error.stack });
    }
}

// =====================================================================
// WORKFLOW: RESET USER ACCESS
// =====================================================================

async function runResetWorkflow() {
    try {
        showSectionHeader("Reset User Access from Manifest", 2);
        
        const { manifestPath } = await inquirer.prompt([{
            type: 'input', name: 'manifestPath', message: 'Enter the path to the access manifest file:',
            validate: p => {
                if (!p) return 'Path cannot be empty.';
                const resolvedPath = p.startsWith('~') ? path.join(os.homedir(), p.slice(1)) : p;
                return fs.existsSync(resolvedPath) ? true : 'File not found. Please check the path.';
            }
        }]);

        const resolvedPath = manifestPath.startsWith('~') ? path.join(os.homedir(), manifestPath.slice(1)) : manifestPath;
        const manifest = JSON.parse(fs.readFileSync(resolvedPath, 'utf8'));
        const { user, actions, generatedAt } = manifest;
        const { added, removed } = actions;

        showSectionHeader("Review Access Reset Plan", 3);
        console.log(chalk.yellow.bold('⚠️  ACCESS RESET OPERATION'));
        console.log(chalk.yellow(`This will restore user ${chalk.bold(user.login)} to the state before ${new Date(generatedAt).toLocaleString()}`));
        console.log(chalk.gray('This reverses the changes made in that operation.\n'));
        
        const groupNames = await getGroupNamesByIds([...added, ...removed]);

        if (added.length > 0) {
            console.log(chalk.red.bold(`Will REMOVE user from ${added.length} groups:`));
            added.forEach(g => console.log(chalk.red(` - ${groupNames[g] || g}`)));
        }
        if (removed.length > 0) {
            console.log(chalk.green.bold(`\nWill ADD user back to ${removed.length} groups:`));
            removed.forEach(g => console.log(chalk.green(` - ${groupNames[g] || g}`)));
        }

        const { confirmReset } = await inquirer.prompt([{
            type: 'confirm', name: 'confirmReset',
            message: '\nDo you want to execute this access reset plan?',
            default: true
        }]);

        if (!confirmReset) {
            console.log(chalk.yellow('Access reset cancelled.'));
            return;
        }

        showSectionHeader("Executing Access Reset", 4);
        
        for (const groupId of added) {
            showSpinner(`Removing user from group ${groupNames[groupId] || groupId}...`);
            await makeApiCall('delete', `https://${config.connection.domain}/api/v1/groups/${groupId}/users/${user.id}`);
            stopSpinner(`Removed user from group ${groupNames[groupId] || groupId}.`);
        }
        for (const groupId of removed) {
            showSpinner(`Adding user back to group ${groupNames[groupId] || groupId}...`);
            await makeApiCall('put', `https://${config.connection.domain}/api/v1/groups/${groupId}/users/${user.id}`);
            stopSpinner(`Added user back to group ${groupNames[groupId] || groupId}.`);
        }

        logger.info('[ACCESS RESET] User access restored from manifest', {
            user: user.id,
            manifestFile: path.basename(manifestPath),
            operator: os.userInfo().username
        });
        
        console.log(chalk.green.bold('\n✓ User access has been successfully reset to its previous state!'));

    } catch (error) {
        stopSpinner('Reset workflow failed.', true);
        console.log(chalk.red(error.message));
        logger.error('Error in Reset Workflow', { error: error.message, stack: error.stack });
    }
}

// =====================================================================
// WORKFLOW: GROUP RULES
// =====================================================================

async function runRuleWorkflow() {
    let oldRuleId;
    try {
        showSectionHeader('Select Group Rule', 2);
        const rulesUrl = `https://${config.connection.domain}/api/v1/groups/rules`;
        showSpinner('Fetching group rules from Okta...');
        const rulesResponse = await makeApiCall('get', rulesUrl);
        const rules = rulesResponse.data;
        stopSpinner('Successfully retrieved group rules');
        if (rules.length === 0) throw new Error("No group rules found in your Okta organization.");

        const { ruleId } = await inquirer.prompt([{
            type: 'list', name: 'ruleId', message: 'Select a group rule to modify:',
            choices: rules.map(rule => ({ name: `${rule.name} (${rule.status})`, value: rule.id })),
            pageSize: 15
        }]);
        oldRuleId = ruleId;

        showSectionHeader('Review Current Configuration', 3);
        showSpinner('Fetching group rule details...');
        const originalRuleResponse = await makeApiCall('get', `https://${config.connection.domain}/api/v1/groups/rules/${oldRuleId}`);
        const originalRule = originalRuleResponse.data;
        stopSpinner('Successfully retrieved group rule details');

        console.log(chalk.green('\nCurrent Rule Configuration:'));
        console.log(formatRuleForDisplay(originalRule));
        
        if (!originalRule.actions?.assignUserToGroups) {
            throw new Error("This rule does not have group assignment actions and cannot be processed.");
        }

        const backupPath = backupGroupRule(originalRule, oldRuleId);
        console.log(chalk.green(`Backup created at: ${backupPath}`));

        const currentGroupIds = originalRule.actions.assignUserToGroups.groupIds || [];
        
        showSectionHeader('Modify Group Assignments', 4);
        const allGroups = await listGroups();
        const groupMap = new Map(allGroups.map(g => [g.id, g.profile]));
        const currentGroups = currentGroupIds.map(id => ({ id, profile: groupMap.get(id) || { name: `Group ${id}` } }));

        const groupsToRemove = await selectGroupsToRemove(currentGroups);
        const groupsToAdd = await selectGroupsToAdd(currentGroupIds);

        if (groupsToAdd.length === 0 && groupsToRemove.length === 0) {
            console.log(chalk.yellow('\nNo changes selected. Exiting.'));
            return;
        }

        const finalGroupIdSet = new Set(currentGroupIds);
        groupsToRemove.forEach(id => finalGroupIdSet.delete(id));
        groupsToAdd.forEach(id => finalGroupIdSet.add(id));
        const finalGroupIds = Array.from(finalGroupIdSet);
        
        // Impact summary
        console.log(chalk.yellow.bold('\n⚠️  RULE MODIFICATION IMPACT'));
        console.log(chalk.gray(`Rule: ${originalRule.name}`));
        console.log(chalk.gray(`This rule dynamically assigns groups based on: ${originalRule.conditions.expression.value}`));
        console.log(chalk.gray(`Current assignments: ${currentGroupIds.length} groups`));
        console.log(chalk.gray(`After change: ${finalGroupIds.length} groups`));
        if (groupsToRemove.length > 0) {
            console.log(chalk.red(`   → ${groupsToRemove.length} groups will be REMOVED from this rule`));
        }
        if (groupsToAdd.length > 0) {
            console.log(chalk.green(`   → ${groupsToAdd.length} groups will be ADDED to this rule`));
        }
        console.log(chalk.yellow.bold('\n⚠️  Users matching this rule will have their group memberships updated automatically\n'));
        
        const updatedRulePayload = { ...originalRule, actions: { assignUserToGroups: { groupIds: finalGroupIds } } };
        delete updatedRulePayload.id;
        delete updatedRulePayload.created;
        delete updatedRulePayload.lastUpdated;
        delete updatedRulePayload.allGroupsValid;

        showSectionHeader('Executing Changes', 5);
        
        try {
            showSpinner('Attempting direct update...');
            await makeApiCall('put', `https://${config.connection.domain}/api/v1/groups/rules/${oldRuleId}`, updatedRulePayload);
            stopSpinner('Direct update successful!');
            
            if (originalRule.status === 'INACTIVE') {
                showSpinner('Activating rule...');
                await makeApiCall('post', `https://${config.connection.domain}/api/v1/groups/rules/${oldRuleId}/lifecycle/activate`);
                stopSpinner('Rule activated.');
            }
        } catch (error) {
            if (error.oktaErrorCode === 'E0000001') {
                stopSpinner('Direct update failed. Rule appears to be immutable.', true);
                logger.warn('Rule is immutable, pivoting to re-create workflow.', { ruleId: oldRuleId });
                
                const { confirmRecreate } = await inquirer.prompt([{
                    type: 'confirm', name: 'confirmRecreate',
                    message: 'This rule is locked. Would you like to automatically re-create it with your changes?',
                    default: true
                }]);

                if (!confirmRecreate) {
                    console.log(chalk.yellow('Re-creation cancelled. No changes were made.'));
                    return;
                }

                await runRecreateWorkflow(originalRule, finalGroupIds);
            } else {
                throw error;
            }
        }
    } catch (error) {
        stopSpinner('Rule workflow failed.', true);
        console.log(chalk.red(error.message));
        logger.error('Error in Rule Workflow', { error: error.message, stack: error.stack });
    }
}

async function runRecreateWorkflow(oldRule, newGroupIds) {
    const oldRuleId = oldRule.id;
    let newRule = null;

    showSectionHeader('Re-create: Staging New Rule', '6a');

    const baseName = oldRule.name.split(' (Updated')[0];
    const currentDate = new Date().toISOString().split('T')[0];
    const finalName = `${baseName} (Updated ${currentDate})`;
    const tempName = `[STAGING] ${finalName}`;

    const newRulePayload = {
        name: tempName,
        type: 'group_rule',
        conditions: oldRule.conditions,
        actions: { assignUserToGroups: { groupIds: newGroupIds } }
    };

    showSpinner(`Creating new rule: "${tempName}"...`);
    const createResponse = await makeApiCall('post', `https://${config.connection.domain}/api/v1/groups/rules`, newRulePayload);
    newRule = createResponse.data;
    stopSpinner('Successfully created new rule (currently INACTIVE).');
    console.log(formatRuleForDisplay(newRule));

    console.log(chalk.yellow(`\nThis rule will be renamed to "${finalName}" after cleanup.`));
    const { confirmCutover } = await inquirer.prompt([{
        type: 'confirm', name: 'confirmCutover',
        message: 'Review the staged rule above. Proceed with cutover?',
        default: true
    }]);

    if (!confirmCutover) {
        showSpinner('Cancelling... Deleting temporary rule...');
        await makeApiCall('delete', `https://${config.connection.domain}/api/v1/groups/rules/${newRule.id}`);
        stopSpinner('Temporary rule deleted. No changes were made.');
        return;
    }

    showSectionHeader('Re-create: Performing Cutover', '6b');
    try {
        showSpinner('Deactivating old rule...');
        await makeApiCall('post', `https://${config.connection.domain}/api/v1/groups/rules/${oldRuleId}/lifecycle/deactivate`);
        stopSpinner(`Old rule (${oldRuleId}) deactivated.`);

        showSpinner('Activating new rule...');
        await makeApiCall('post', `https://${config.connection.domain}/api/v1/groups/rules/${newRule.id}/lifecycle/activate`);
        stopSpinner(`New rule (${newRule.id}) is now ACTIVE.`);
    } catch (error) {
        logger.error('Cutover failed! Attempting rollback.', { oldRuleId, newRuleId: newRule.id, error: error.message });
        stopSpinner('Cutover failed!', true);
        
        console.log(chalk.red.bold('\n!!! ATTEMPTING AUTOMATIC ROLLBACK !!!'));
        showSpinner(`Re-activating original rule (${oldRuleId})...`);
        try {
            await makeApiCall('post', `https://${config.connection.domain}/api/v1/groups/rules/${oldRuleId}/lifecycle/activate`);
            stopSpinner('Rollback successful. Original rule is active.');
        } catch (rollbackError) {
            stopSpinner('ROLLBACK FAILED.', true);
            logger.error('AUTOMATIC ROLLBACK FAILED!', { oldRuleId, error: rollbackError.message });
            console.log(chalk.red.inverse(`CRITICAL: The original rule (${oldRuleId}) could not be re-activated. Manual intervention is required.`));
        }
        throw error;
    }

    showSectionHeader('Re-create: Cleaning Up', '6c');
    const { confirmCleanup } = await inquirer.prompt([{
        type: 'confirm', name: 'confirmCleanup',
        message: 'Cutover successful. Proceed with cleanup (delete old rule, rename new one)?',
        default: true
    }]);

    if (confirmCleanup) {
        try {
            showSpinner(`Deleting old rule (${oldRuleId})...`);
            await makeApiCall('delete', `https://${config.connection.domain}/api/v1/groups/rules/${oldRuleId}`);
            stopSpinner('Old rule deleted.');
        } catch(e) {
            logger.warn("Failed to delete old rule during cleanup.", { oldRuleId, error: e.message });
            stopSpinner('Could not delete old rule. Please remove it manually.', true);
        }
        try {
            showSpinner(`Renaming new rule to "${finalName}"...`);
            const getNewRuleResponse = await makeApiCall('get', `https://${config.connection.domain}/api/v1/groups/rules/${newRule.id}`);
            const newRuleState = getNewRuleResponse.data;
            const finalPayload = { ...newRuleState, name: finalName };
            delete finalPayload.id;
            delete finalPayload.created;
            delete finalPayload.lastUpdated;

            await makeApiCall('put', `https://${config.connection.domain}/api/v1/groups/rules/${newRule.id}`, finalPayload);
            stopSpinner('New rule has been renamed.');
            logger.info('Rule rename successful', { newRuleId: newRule.id, oldName: tempName, newName: finalName });
        } catch(e) {
            logger.warn("Failed to rename new rule during cleanup.", { newRuleId: newRule.id, error: e.message });
            stopSpinner(`Could not rename new rule. Please rename it manually.`, true);
        }
    } else {
        console.log(chalk.yellow('Cleanup skipped. Please manually delete the old rule and rename the new one.'));
    }

    console.log(chalk.green.bold('\n✓ Re-creation process completed successfully!'));
}

// =====================================================================
// WORKFLOW HELPERS
// =====================================================================

async function selectGroupsToRemove(currentGroups) {
    if (currentGroups.length === 0) return [];
    console.log(chalk.yellow(`\nYou can now select groups to remove from the user.`));
    const groupChoices = currentGroups.map(g => ({ name: `${g.profile.name} (${g.id})`, value: g.id }));
    const { groupIdsToRemove } = await inquirer.prompt([{
        type: 'checkbox', name: 'groupIdsToRemove',
        message: 'Select groups to REMOVE:', choices: groupChoices, pageSize: 10
    }]);
    return groupIdsToRemove;
};

async function selectGroupsToAdd(excludeIds = []) {
    const { addMethod } = await inquirer.prompt([{
        type: 'list', name: 'addMethod', message: 'How would you like to select groups to ADD?',
        choices: [{ name: 'Interactive checklist', value: 'interactive' }, { name: 'From a text file', value: 'file' }]
    }]);
    
    if (addMethod === 'interactive') {
        const allGroups = await listGroups();
        const filteredGroups = allGroups.filter(group => !excludeIds.includes(group.id));
        if (filteredGroups.length === 0) {
            console.log(chalk.yellow(`\nAll available groups are already assigned to this entity.`));
            return [];
        }
        const groupChoices = filteredGroups.map(g => ({ name: `${g.profile.name} (${g.profile.description || 'No desc'})`, value: g.id }));
        
        const { groupIds } = await inquirer.prompt([{
            type: 'checkbox', name: 'groupIds',
            message: 'Select groups to ADD:', choices: groupChoices, pageSize: 10
        }]);
        return groupIds;
    } else {
        const result = await selectGroupsFromFile(excludeIds);
        return result.groupIds;
    }
};

async function selectGroupsFromFile(excludeIds = []) {
    let filePath = '';
    while (true) {
        const { answer } = await inquirer.prompt([{
            type: 'input',
            name: 'answer',
            message: "Enter the path to your text file (or type 'back' to return):",
        }]);
        
        filePath = answer.trim();
        if (filePath.toLowerCase() === 'back') return { groupIds: [], back: true };

        if (filePath.startsWith('~')) filePath = path.join(os.homedir(), filePath.slice(1));
        
        if (fs.existsSync(filePath)) break;
        else console.log(chalk.red(">> File not found. Please check the path and try again."));
    }

    const namesFromFile = fs.readFileSync(filePath, 'utf8').split(/\r?\n/).map(name => name.trim()).filter(Boolean);
    const allGroups = await listGroups();
    const groupNameToId = new Map(allGroups.map(g => [g.profile.name, g.id]));
    
    const foundIds = [], notFoundNames = [], alreadyAssigned = [];
    for (const name of namesFromFile) {
        const foundId = groupNameToId.get(name);
        if (foundId) {
            if (excludeIds.includes(foundId)) alreadyAssigned.push(name);
            else foundIds.push(foundId);
        } else {
            notFoundNames.push(name);
        }
    }

    console.log(chalk.green(`\n✓ Found ${foundIds.length} of ${namesFromFile.length} groups from the file.`));
    if (alreadyAssigned.length > 0) console.log(chalk.yellow(`The following groups are already assigned and will be skipped: ${alreadyAssigned.join(', ')}`));
    if (notFoundNames.length > 0) console.log(chalk.red(`✗ The following names could not be found: ${notFoundNames.join(', ')}`));
    
    if (foundIds.length === 0) {
        console.log(chalk.yellow('\nNo new, valid groups to add from the file.'));
        return { groupIds: [], back: false };
    }

    const { proceed } = await inquirer.prompt([{
        type: 'confirm', name: 'proceed',
        message: `Do you want to proceed with adding the ${foundIds.length} found groups?`,
        default: true
    }]);
    return { groupIds: proceed ? foundIds : [], back: false };
};

// =====================================================================
// SCRIPT EXECUTION
// =====================================================================
async function main() {
    try {
        // 1. Initialization
        const { dirs } = config;
        if (!fs.existsSync(dirs.logs)) fs.mkdirSync(dirs.logs, { recursive: true });
        if (!fs.existsSync(dirs.backups)) fs.mkdirSync(dirs.backups, { recursive: true });
        if (!fs.existsSync(dirs.manifests)) fs.mkdirSync(dirs.manifests, { recursive: true });
        
        logger = winston.createLogger({
            level: 'info',
            format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
            transports: [ new winston.transports.File({ filename: path.join(dirs.logs, 'okta-wizard.log') }) ]
        });
        
        showWelcomeBanner();
        logger.info('Application initialized', { action: 'init', version: '7.0.2' });

        // 2. Get Configuration
        showSectionHeader('Configure Okta Connection', 1);
        const envPath = path.join(process.cwd(), '.env');
        if (fs.existsSync(envPath)) {
          console.log(chalk.blue('Found .env configuration file.'));
          const envConfig = require('dotenv').config().parsed || {};
          config.connection.domain = envConfig.OKTA_DOMAIN;
          config.connection.token = envConfig.OKTA_API_TOKEN;
        } else {
            console.log(chalk.yellow('No .env file found. Prompting for connection details.'));
            const answers = await inquirer.prompt([
                { type: 'input', name: 'OKTA_DOMAIN', message: 'What is your Okta domain?', validate: i => i || 'Domain cannot be empty.' },
                { type: 'password', name: 'OKTA_API_TOKEN', message: 'Enter your Okta API token:', validate: i => i || 'Token cannot be empty.' }
            ]);
            config.connection.domain = answers.OKTA_DOMAIN;
            config.connection.token = answers.OKTA_API_TOKEN;
        }

        if (!config.connection.domain) {
            throw new Error('OKTA_DOMAIN is not defined. Please add it to your .env file or enter it when prompted.');
        }
        if (!config.connection.token) {
            throw new Error('OKTA_API_TOKEN is not defined. Please add it to your .env file or enter it when prompted.');
        }
        
        // 3. Select Workflow
        showSectionHeader('Select Workflow', 2);
        const { workflow } = await inquirer.prompt([{
            type: 'list',
            name: 'workflow',
            message: 'What would you like to manage?',
            choices: [
                { name: 'Group Rule Assignments', value: 'rule' },
                { name: 'Direct User Group Assignments (Grant Access)', value: 'user' },
                { name: 'Reset User Access from a Manifest (Revoke Access)', value: 'reset' }
            ]
        }]);

        // 4. Execute selected workflow
        if (workflow === 'rule') {
            await runRuleWorkflow();
        } else if (workflow === 'user') {
            await runUserWorkflow();
        } else if (workflow === 'reset') {
            await runResetWorkflow();
        }

    } catch (error) {
        stopSpinner('A fatal error occurred.', true);
        console.error(chalk.red.bold('\nFATAL ERROR:'), error.message);
        if(logger) logger.error('Fatal error in main execution', { error: error.message, stack: error.stack });
        process.exit(1);
    }
}

main();
