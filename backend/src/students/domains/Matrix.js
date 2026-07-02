const MatrixDomain = require('../../domains/MatrixDomain');

class Matrix extends MatrixDomain {
    constructor() {
        super('matrix', 'students');
    }
}

module.exports = new Matrix();
