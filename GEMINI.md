# Gemini Context: Okta Group Tools

## Project Overview

This project, `okta-group-tools`, is a Node.js-based command-line interface (CLI) tool designed for advanced management of Okta resources. It aims to solve problems that are difficult or tedious to handle through the standard Okta GUI, such as bulk operations, managing immutable rules, and providing clear audit trails and rollback capabilities.

The primary application is the `okta_membership_wizard.js`, an interactive wizard for managing group rules and user memberships. The project also includes other scripts for bulk updates and diagnostics.

**Key Technologies:**
- **Language:** JavaScript (Node.js)
- **Module System:** CommonJS
- **API Communication:** `axios` is used for making direct calls to the Okta API.
- **CLI Framework:** `inquirer` for interactive prompts, `chalk` for colored output, and `ora` for spinners.
- **Configuration:** Environment variables managed via a `.env` file (using `dotenv`).
- **Logging:** `winston` is used for structured logging to `logs/okta-wizard.log`.

**Architecture:**
The project consists of several JavaScript files, with `okta_membership_wizard.js` serving as the main entry point for the interactive tool. It follows a self-contained architecture where the API logic (`axios` calls) is embedded within the main script. The tool is designed with safety in mind, featuring pre-flight checks, automatic backups of modified rules, and manifest generation for user access changes to allow for easy rollbacks.

## Building and Running

### 1. Initial Setup

To set up the project for the first time, run the setup script:

```bash
./setup.sh
```
This script will:
1.  Install the required `npm` dependencies.
2.  Create a `.env` file from the `.env.example` template.
3.  Run pre-flight checks to ensure the environment is configured correctly.

**Important:** After running the setup, you must manually edit the `.env` file to add your Okta domain and API token.

### 2. Verifying the Setup

At any time, you can run the pre-flight checks to validate your configuration and test the connection to the Okta API:

```bash
npm run preflight
```

### 3. Running the Tools

- **Interactive Wizard (Main Tool):**
  ```bash
  npm run wizard
  # or
  node okta_membership_wizard.js
  ```

- **Bulk Profile Updates:**
  ```bash
  npm run profile-update
  ```

- **List Users in a Group:**
  ```bash
  npm run list-users
  ```

## Development Conventions

- **Code Style:** The codebase uses a standard JavaScript style with semicolons and 2-space indentation. It is written using the CommonJS module system (`require`/`module.exports`).
- **Error Handling:** The application has robust error handling, catching API errors, network issues, and providing user-friendly messages. API calls include automatic retries on rate-limiting (429 errors).
- **Safety Mechanisms:**
    - **Pre-flight Checks (`preflight.js`):** Ensures the environment is correctly configured before running any tool.
    - **Backups:** Before modifying a group rule, a JSON backup is automatically created in the `backups/` directory.
    - **Manifests:** Any change to a user's group membership generates a timestamped JSON manifest in the `manifests/` directory. These manifests can be used with the "Reset User Access" workflow to revert changes.
- **Logging:** All major operations are logged to `logs/okta-wizard.log` using `winston`, providing a structured audit trail.
- **Configuration:** All configuration is handled via the `.env` file, which is loaded at runtime. There are no hardcoded secrets.
