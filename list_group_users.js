#!/usr/bin/env node

/**
 * List Group Users
 * ======================
 * Part of the Okta Group Tools suite - CLI automation for access management.
 * 
 * This tool lists all users in a selected Okta group.
 *
 * Author: Created for Okta administrators
 * Version: 1.0.0
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
const path = require('path');
const winston = require('winston');

// =====================================================================
// GLOBAL CONFIGURATION & STATE
// =====================================================================

const config = {
    dirs: {
        logs: path.join(process.cwd(), 'logs'),
    },
    connection: { domain: null, token: null }
};

let spinner = null;
let logger = null;

// =====================================================================
// UI & FILE HELPERS
// =====================================================================

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

async function listUsersInGroup(groupId) {
    const url = `https://${config.connection.domain}/api/v1/groups/${groupId}/users?limit=200`;
    showSpinner('Fetching users in group from Okta...');
    try {
        const allUsers = await listAll(url);
        stopSpinner();
        logger.info('Retrieved users in group', { action: 'list_users_in_group', count: allUsers.length });
        return allUsers;
    } catch (error) {
        stopSpinner('Failed to retrieve users in group.', true);
        throw error;
    }
}

// =====================================================================
// SCRIPT EXECUTION
// =====================================================================
async function main() {
    try {
        // 1. Initialization
        logger = winston.createLogger({
            level: 'info',
            format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
            transports: [ new winston.transports.File({ filename: path.join(config.dirs.logs, 'okta-wizard.log') }) ]
        });
        
        console.log(chalk.cyan.bold('\n=== Okta Group Tools - List Group Users ===\n'));
        logger.info('Application initialized', { action: 'init', version: '1.0.0' });

        // 2. Get Configuration
        const envConfig = require('dotenv').config().parsed || {};
        config.connection.domain = envConfig.OKTA_DOMAIN;
        config.connection.token = envConfig.OKTA_API_TOKEN;

        if (!config.connection.domain) {
            throw new Error('OKTA_DOMAIN is not defined. Please add it to your .env file.');
        }
        if (!config.connection.token) {
            throw new Error('OKTA_API_TOKEN is not defined. Please add it to your .env file.');
        }
        
        // 3. Select Group
        showSectionHeader('Select Group', 1);
        const allGroups = await listGroups();
        const groupChoices = allGroups.map(g => ({ name: `${g.profile.name} (${g.id})`, value: g.id }));
        const { groupId } = await inquirer.prompt([{
            type: 'list', name: 'groupId',
            message: 'Select a group to list users from:', choices: groupChoices, pageSize: 10
        }]);

        // 4. List Users
        showSectionHeader('Users in Group', 2);
        const users = await listUsersInGroup(groupId);
        if (users.length === 0) {
            console.log(chalk.yellow('No users found in this group.'));
        } else {
            users.forEach((user, i) => {
                console.log(`${i + 1}. ${user.profile.firstName} ${user.profile.lastName} (${user.profile.login})`);
            });
        }

    } catch (error) {
        stopSpinner('A fatal error occurred.', true);
        console.error(chalk.red.bold('\nFATAL ERROR:'), error.message);
        if(logger) logger.error('Fatal error in main execution', { error: error.message, stack: error.stack });
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

module.exports = { main };
