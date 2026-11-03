const { asyncHandler } = require('../services/asyncHandler');
const { ApiResponse } = require('../services/ApiResponse');
const { getPartyLedgerStatement } = require('../services/partyLedger.service');
const { getContext } = require('../helpers/requestContext');
const { verifyRecordOwnership } = require('../middlewares/authorize.middleware');

/**
 * Controller to fetch Party Ledger Statement
 * GET /api/v1/parties/:partyId/ledger
 */
const getPartyLedger = asyncHandler(async (req, res) => {
    const { partyId } = req.params;
    const { startDate, endDate, branchId } = req.query;
    const { firmId } = getContext();

    const ledgerStatement = await getPartyLedgerStatement({
        partyId: Number(partyId),
        firmId: firmId ? Number(firmId) : undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        branchId: branchId ? Number(branchId) : undefined,
    });

    if (ledgerStatement?.party) {
        verifyRecordOwnership(req.user, ledgerStatement.party, 'Party');
    }

    return res.status(200).json(
        new ApiResponse({
            statusCode: 200,
            data: ledgerStatement,
            message: 'Party ledger statement retrieved successfully.'
        })
    );
});

module.exports = {
    getPartyLedger,
};
