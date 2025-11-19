const axios = require('axios');
const { makeApiCall, listAll, listGroups } = require('../services/oktaService');

jest.mock('axios');

describe('oktaService', () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('makeApiCall', () => {
        it('should make a successful GET request', async () => {
            const data = { message: 'success' };
            axios.mockResolvedValue({ data });

            const result = await makeApiCall('get', 'https://test.okta.com/api/v1/users', 'test-token');

            expect(result.data).toEqual(data);
            expect(axios).toHaveBeenCalledWith({
                method: 'get',
                url: 'https://test.okta.com/api/v1/users',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                    'Authorization': 'SSWS test-token'
                },
                data: null
            });
        });

        it('should throw an error for a 401 response', async () => {
            const error = {
                response: {
                    status: 401,
                    data: { errorSummary: 'Authentication failed' }
                }
            };
            axios.mockRejectedValue(error);

            await expect(makeApiCall('get', 'https://test.okta.com/api/v1/users', 'test-token')).rejects.toThrow('Authentication failed. Check your API token.');
        });

        it('should retry on a 429 response', async () => {
            const rateLimitError = {
                response: {
                    status: 429,
                    headers: { 'retry-after': '1' },
                    data: { errorSummary: 'Rate limit exceeded' }
                }
            };
            const successResponse = { data: { message: 'success' } };

            axios
                .mockRejectedValueOnce(rateLimitError)
                .mockResolvedValueOnce(successResponse);
            
            // Mock setTimeout to avoid waiting in tests
            jest.spyOn(global, 'setTimeout').mockImplementation(cb => cb());

            const result = await makeApiCall('get', 'https://test.okta.com/api/v1/users', 'test-token');

            expect(result.data).toEqual(successResponse.data);
            expect(axios).toHaveBeenCalledTimes(2);
            expect(setTimeout).toHaveBeenCalledWith(expect.any(Function), 1000);
        });
    });
});
