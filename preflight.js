#!/usr/bin/env node

/**
 * Preflight Check
 * Validates environment setup before running Okta Group Tools
 */

const fs = require('fs');
const path = require('path');
const axios = require('axios');
const chalk = require('chalk');

const checks = {
    passed: 0,
    failed: 0,
    warnings: 0
};

function pass(message) {
    console.log(chalk.green('✓'), message);
    checks.passed++;
}

function fail(message, hint) {
    console.log(chalk.red('✗'), message);
    if (hint) console.log(chalk.gray(`  → ${hint}`));
    checks.failed++;
}

function warn(message, hint) {
    console.log(chalk.yellow('⚠'), message);
    if (hint) console.log(chalk.gray(`  → ${hint}`));
    checks.warnings++;
}

async function runPreflightChecks() {
    console.log(chalk.cyan.bold('\n=== Okta Group Tools - Preflight Check ===\n'));

    // Check 1: Node version
    console.log(chalk.blue('Checking Node.js version...'));
    const nodeVersion = process.version.match(/^v(\d+)/)[1];
    if (parseInt(nodeVersion) >= 18) {
        pass(`Node.js ${process.version} (>= 18 required)`);
    } else {
        fail(`Node.js ${process.version} is too old`, 'Upgrade to Node.js 18 or higher');
    }

    // Check 2: Dependencies installed
    console.log(chalk.blue('\nChecking dependencies...'));
    const requiredDeps = ['axios', 'chalk', 'dotenv', 'inquirer', 'ora', 'winston'];
    const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'));
    const installedDeps = Object.keys(packageJson.dependencies || {});
    
    let missingDeps = [];
    for (const dep of requiredDeps) {
        if (installedDeps.includes(dep)) {
            pass(`${dep} installed`);
        } else {
            fail(`${dep} missing`, 'Run: npm install');
            missingDeps.push(dep);
        }
    }

    // Check 3: .env file exists
    console.log(chalk.blue('\nChecking configuration...'));
    const envPath = path.join(__dirname, '.env');
    if (fs.existsSync(envPath)) {
        pass('.env file exists');
        
        // Check 4: Load and validate .env contents
        require('dotenv').config();
        
        if (process.env.OKTA_DOMAIN) {
            pass('OKTA_DOMAIN is set');
            
            // Validate domain format
            if (process.env.OKTA_DOMAIN.includes('okta.com')) {
                pass('OKTA_DOMAIN format looks valid');
            } else {
                warn('OKTA_DOMAIN format unusual', 'Expected format: your-domain.okta.com');
            }
        } else {
            fail('OKTA_DOMAIN not set in .env', 'Add: OKTA_DOMAIN=your-domain.okta.com');
        }
        
        if (process.env.OKTA_API_TOKEN) {
            pass('OKTA_API_TOKEN is set');
            
            // Check token format
            if (process.env.OKTA_API_TOKEN.length > 20) {
                pass('OKTA_API_TOKEN length looks valid');
            } else {
                warn('OKTA_API_TOKEN seems too short', 'Verify your API token is correct');
            }
        } else {
            fail('OKTA_API_TOKEN not set in .env', 'Add: OKTA_API_TOKEN=your-api-token');
        }
        
    } else {
        fail('.env file not found', 'Run: cp .env.example .env');
        fail('OKTA_DOMAIN not configured');
        fail('OKTA_API_TOKEN not configured');
    }

    // Check 5: Required directories
    console.log(chalk.blue('\nChecking directories...'));
    const dirs = ['logs', 'backups', 'manifests'];
    for (const dir of dirs) {
        const dirPath = path.join(__dirname, dir);
        if (fs.existsSync(dirPath)) {
            pass(`${dir}/ directory exists`);
        } else {
            warn(`${dir}/ directory missing`, 'Will be created automatically on first run');
        }
    }

    // Check 6: Test Okta connection (if credentials exist)
    if (process.env.OKTA_DOMAIN && process.env.OKTA_API_TOKEN) {
        console.log(chalk.blue('\nTesting Okta connection...'));
        try {
            const response = await axios.get(
                `https://${process.env.OKTA_DOMAIN}/api/v1/users/me`,
                {
                    headers: {
                        'Authorization': `SSWS ${process.env.OKTA_API_TOKEN}`,
                        'Accept': 'application/json'
                    },
                    timeout: 5000
                }
            );
            pass('Successfully connected to Okta API');
            pass(`Authenticated as: ${response.data.profile.login}`);
        } catch (error) {
            if (error.response) {
                if (error.response.status === 401) {
                    fail('Authentication failed', 'Check your OKTA_API_TOKEN');
                } else if (error.response.status === 403) {
                    fail('Permission denied', 'API token needs appropriate permissions');
                } else {
                    fail(`Okta API error: ${error.response.status}`, error.response.data?.errorSummary);
                }
            } else if (error.code === 'ENOTFOUND') {
                fail('Cannot reach Okta domain', 'Check your OKTA_DOMAIN setting');
            } else if (error.code === 'ETIMEDOUT') {
                warn('Connection timeout', 'Network may be slow or firewall blocking');
            } else {
                fail('Connection test failed', error.message);
            }
        }
    }

    // Summary
    console.log(chalk.cyan.bold('\n=== Summary ==='));
    console.log(chalk.green(`Passed: ${checks.passed}`));
    if (checks.warnings > 0) console.log(chalk.yellow(`Warnings: ${checks.warnings}`));
    if (checks.failed > 0) console.log(chalk.red(`Failed: ${checks.failed}`));
    
    console.log();
    if (checks.failed === 0) {
        console.log(chalk.green.bold('✓ All critical checks passed! You\'re ready to use Okta Group Tools.'));
        console.log(chalk.gray('\nRun: npm run wizard'));
        process.exit(0);
    } else {
        console.log(chalk.red.bold('✗ Some checks failed. Please fix the issues above before proceeding.'));
        process.exit(1);
    }
}

runPreflightChecks().catch(error => {
    console.error(chalk.red('\nPreflight check crashed:'), error.message);
    process.exit(1);
});
