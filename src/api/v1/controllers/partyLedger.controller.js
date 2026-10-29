const { asyncHandler } = require('../services/asyncHandler');
const { ApiResponse } = require('../services/ApiResponse');
const { getPartyLedgerStatement } = require('../services/partyLedger.service');
const { getContext } = require('../helpers/requestContext');

/**
 * Controller to fetch Party Ledger Statement
 * GET /api/v1/parties/:partyId/ledger
 */
const getPartyLedger = asyncHandler(async (req, res) => {
    const { partyId } = req.params;
    const { startDate, endDate, branchId, firmId: queryFirmId } = req.query;
    const { firmId = 0 } = getContext();

    const rawFirmId = req.firmId || req.user?.firmId || firmId || queryFirmId || req.headers['x-firm-id'];
    const resolvedFirmId = (rawFirmId && rawFirmId !== 'all') ? Number(rawFirmId) : undefined;

    const ledgerStatement = await getPartyLedgerStatement({
        partyId: Number(partyId),
        firmId: resolvedFirmId,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        branchId: branchId ? Number(branchId) : undefined,
    });

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
