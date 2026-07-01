const Nextcloud = require('../../src/students/domains/Nextcloud');

jest.mock('node-ssh', () => {
    return {
        NodeSSH: jest.fn().mockImplementation(() => {
            return {
                connect: jest.fn().mockResolvedValue(true),
                execCommand: jest.fn().mockResolvedValue({ stdout: '{}', stderr: '' }),
                dispose: jest.fn()
            };
        })
    };
});

describe('Nextcloud Domain Key / Password Handling', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        Nextcloud.config = {
            host: 'localhost',
            user: 'test-user',
            password: 'test-password'
        };
    });

    it('should connect using password when key path is configured but file is missing', async () => {
        Nextcloud.config.key = '/path/to/nonexistent/id_rsa';
        
        // This should not throw 'Unsupported key format' and should succeed using mock NodeSSH
        const identities = await Nextcloud.readIdentities();
        expect(identities).toEqual([]);
    });

    it('should throw if no host, user, or auth configured', async () => {
        Nextcloud.config = {};
        await expect(Nextcloud.readIdentities()).rejects.toThrow('Nextcloud configuration is incomplete.');
    });
});
