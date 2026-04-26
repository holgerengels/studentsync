const MockDomain = require('./MockDomain');
const { asvData, untisData, schulkonsoleData, nextcloudData, webuntisData } = require('./data');
const { encode, next } = require('../../utils/userIds');

// ASV needs custom methods
const asvMock = new MockDomain('asv', asvData, ['userId', 'firstName', 'lastName', 'birthday', 'clazz']);

asvMock.generateIds = async function() {
    const generated = [];
    for (let user of this.data) {
        if (!user.userId && !user.account) {
            const len = 18;
            let like = encode(user.lastName);
            if (like.length > len - 6) like = like.substring(0, len - 6);
            
            const similar = this.data.filter(u => u.userId && u.userId.startsWith(like)).map(u => u.userId);
            
            const userid = next(len, similar, user.firstName, user.lastName);
            user.userId = userid;
            user.account = userid;
            
            generated.push({ id: user.id, account: userid, firstName: user.firstName, lastName: user.lastName });
        }
    }
    if (generated.length > 0) this.invalidate();
    return generated;
};

asvMock.readExitDates = async function(usernames) {
    return {};
};

asvMock.readGuardians = async function() {
    return [];
};

const untisMock = new MockDomain('untis', untisData, ['userId', 'firstName', 'lastName', 'clazz']);
const schulkonsoleMock = new MockDomain('schulkonsole', schulkonsoleData, ['userId', 'firstName', 'lastName', 'clazz']);
const webuntisMock = new MockDomain('webuntis', webuntisData, ['userId', 'firstName', 'lastName']);
const nextcloudMock = new MockDomain('nextcloud', nextcloudData, ['userId', 'firstName', 'lastName', 'email']);

const dummyMock = new MockDomain('dummy');
const relutionMock = new MockDomain('relution');

module.exports = {
    asv: asvMock,
    untis: untisMock,
    schulkonsole: schulkonsoleMock,
    webuntis: webuntisMock,
    nextcloud: nextcloudMock,
    dummy: dummyMock,
    relution: relutionMock
};
