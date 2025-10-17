const okta = require('@okta/okta-sdk-nodejs');

class OktaService {
  constructor() {
    // This constructor ensures that the necessary Okta environment variables are set before proceeding.
    if (!process.env.OKTA_ORG_URL || !process.env.OKTA_API_TOKEN) {
      throw new Error('Missing Okta environment variables (OKTA_ORG_URL, OKTA_API_TOKEN)');
    }
    this.client = new okta.Client({
      orgUrl: process.env.OKTA_ORG_URL,
      token: process.env.OKTA_API_TOKEN,
    });
  }

  /**
   * Finds an Okta group by its exact name using the correct SDK v7 method.
   * @param {string} name The name of the group to find.
   * @returns {Promise<okta.Group|null>} The group object if found, otherwise null.
   */
  async findExistingGroup(name) {
    // The diagnostic script confirmed we are using SDK v7+, which returns a Collection object.
    // The .each() method is the correct way to iterate this collection.
    let foundGroup = null;
    
    const groupsCollection = await this.client.groupApi.listGroups({ q: name });
    
    await groupsCollection.each(group => {
      // The `q` parameter can return partial matches, so this check ensures an exact name match.
      if (group.profile.name === name) {
        foundGroup = group;
      }
    });

    return foundGroup;
  }

  /**
   * Creates a new group in Okta.
   * @param {string} name The name for the new group.
   * @param {string} description The description for the new group.
   * @returns {Promise<okta.Group>} The newly created group object.
   */
  async createGroup(name, description) {
    return this.client.groupApi.createGroup({
      profile: { name, description },
    });
  }
}

module.exports = OktaService;
