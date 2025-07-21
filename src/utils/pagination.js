// Utility functions for handling pagination in Knex.js queries
const buildPagination = async ({
    baseQuery,    // A Knex query builder with all filters, joins, and conditions
    page = 1,
    pageSize = 10
}) => {
    page = Math.max(parseInt(page) || 1, 1);
    pageSize = Math.max(parseInt(pageSize) || 10, 1);
    const offset = (page - 1) * pageSize;

    // Count total rows
    const countQuery = baseQuery.clone()
        .clearSelect()
        .clearOrder()
        .count('* as total')
        .first();

    const { total } = await countQuery;
    const totalPages = Math.ceil(total / pageSize);

    return {
        pagination: {
            total: parseInt(total),
            page,
            pageSize,
            totalPages,
            offset,
            hasNextPage: page < totalPages,
            hasPrevPage: page > 1
        }
    };
};

// Fetch paginated data based on the base query, page number, and page size
const fetchPageData = async ({ baseQuery, page, pageSize }) => {
    page = Math.max(parseInt(page) || 1, 1);
    pageSize = Math.max(parseInt(pageSize) || 10, 1);
    const offset = (page - 1) * pageSize;

    return await baseQuery.clone()
        .limit(pageSize)
        .offset(offset);
};

module.exports = {
    buildPagination,
    fetchPageData
};