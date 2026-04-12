const ManagableDomain = require('./ManagableDomain');
const mongoose = require('mongoose');

const dummySchema = new mongoose.Schema({
    userId: { type: String, required: true, unique: true },
    firstName: String,
    lastName: String,
}, { strict: false }); // allow dynamic fields

const DummyModel = mongoose.models.DummyIdentity || mongoose.model('DummyIdentity', dummySchema);

class DummyDomain extends ManagableDomain {
    constructor() {
        super('dummy');
    }

    async readIdentities() {
        const docs = await DummyModel.find({}).lean();
        return docs.map(doc => {
            const { _id, __v, ...rest } = doc;
            return rest;
        });
    }

    async addIdentity(identity) {
        await DummyModel.create(identity);
        this.invalidate();
    }

    async changeIdentity(identity) {
        const { userId, ...updateData } = identity;
        await DummyModel.updateOne({ userId }, { $set: updateData });
        this.invalidate();
    }

    async removeIdentity(identity) {
        await DummyModel.deleteOne({ userId: identity.userId });
        this.invalidate();
    }
}

module.exports = DummyDomain;
