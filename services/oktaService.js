const axios = require('axios');

async function makeApiCall(method, url, token, data = null) {
    const headers = {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': `SSWS ${token}`
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
                // In a service, we shouldn't log directly to console.
                // For now, we'll keep it for visibility during refactor.
                console.log(`\nRate limited. Retrying in ${retryAfter} seconds...`);
                await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
                return makeApiCall(method, url, token, data);
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

async function listAll(url, token) {
    let results = [];
    let nextUrl = url;
    while(nextUrl) {
        const response = await makeApiCall('get', nextUrl, token);
        results = results.concat(response.data);
        const linkHeader = response.headers.link;
        const nextLink = linkHeader?.split(',').find(link => link.includes('rel="next"'));
        nextUrl = nextLink ? nextLink.match(/<(.+)>/)[1] : null;
    }
    return results;
}

async function listGroups(domain, token, showSpinner, stopSpinner, logger) {
    const url = `https://${domain}/api/v1/groups?limit=200`;
    showSpinner('Fetching all groups from Okta...');
    try {
        const allGroups = await listAll(url, token);
        stopSpinner();
        if(logger) logger.info('Retrieved groups', { action: 'list_groups', count: allGroups.length });
        return allGroups;
    } catch (error) {
        stopSpinner('Failed to retrieve groups.', true);
        throw error;
    }
}

async function getGroupNamesByIds(groupIds, domain, token, showSpinner, stopSpinner, logger) {
    if (groupIds.length === 0) return {};
    const allGroups = await listGroups(domain, token, showSpinner, stopSpinner, logger);
    const groupMap = new Map(allGroups.map(g => [g.id, g.profile.name]));
    const names = {};
    groupIds.forEach(id => { names[id] = groupMap.get(id) || id; });
    return names;
}

module.exports = {
    makeApiCall,
    listAll,
    listGroups,
    getGroupNamesByIds
};