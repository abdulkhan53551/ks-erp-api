/**
 * modules.registry.js
 * Single Source of Truth for all ERP Modules and their standard actions.
 * Adding a new module in the future only requires adding an entry here.
 */

const MODULES_REGISTRY = [
    // 📊 SALES MANAGEMENT
    {
        slug: 'invoices',
        name: 'Sales Invoices',
        category: 'Sales Management',
        icon: 'receipt',
        description: 'Manage tax invoices, GST breakdowns, and print templates',
        actions: ['read', 'create', 'update', 'delete', 'approve', 'print']
    },
    {
        slug: 'challans',
        name: 'Delivery Challans',
        category: 'Sales Management',
        icon: 'truck',
        description: 'Dispatch delivery notes, material transport & tracking',
        actions: ['read', 'create', 'update', 'delete', 'print']
    },
    {
        slug: 'eway-bills',
        name: 'E-Way Bills',
        category: 'Sales Management',
        icon: 'file-text',
        description: 'Electronic waybills for inter-state & intra-state transit',
        actions: ['read', 'create', 'update', 'delete', 'print']
    },

    // 🛒 PURCHASES & PROCUREMENT
    {
        slug: 'purchase-orders',
        name: 'Purchase Orders',
        category: 'Purchasing & Procurement',
        icon: 'shopping-cart',
        description: 'Inward purchase orders, raw materials & vendor procurement',
        actions: ['read', 'create', 'update', 'delete', 'approve', 'print']
    },
    {
        slug: 'vendor-bills',
        name: 'Vendor Bills',
        category: 'Purchasing & Procurement',
        icon: 'dollar-sign',
        description: 'Accounts payable, purchase invoices & vendor liability',
        actions: ['read', 'create', 'update', 'delete', 'approve']
    },

    // 💳 FINANCE & PAYMENTS
    {
        slug: 'payments',
        name: 'Payments & Receipts',
        category: 'Finance & Banking',
        icon: 'credit-card',
        description: 'Customer inward receipts, vendor payouts & allocations',
        actions: ['read', 'create', 'update', 'delete', 'print']
    },

    // 📦 INVENTORY & MASTERS
    {
        slug: 'products',
        name: 'Products & Inventory',
        category: 'Inventory & Masters',
        icon: 'box',
        description: 'Raw materials, finished goods, HSN codes & pricing',
        actions: ['read', 'create', 'update', 'delete']
    },
    {
        slug: 'parties',
        name: 'Parties (Customers & Vendors)',
        category: 'Inventory & Masters',
        icon: 'users',
        description: 'Clients, suppliers, branch offices & GSTIN details',
        actions: ['read', 'create', 'update', 'delete']
    },
    // 🏢 ORGANIZATION
    {
        slug: 'firms',
        name: 'Firms (Company Profiles)',
        category: 'Organization',
        icon: 'briefcase',
        description: 'Company entities, bank accounts & letterhead settings',
        actions: ['read', 'create', 'update', 'delete']
    },

    // 🛠️ GENERAL MASTERS
    {
        slug: 'masters',
        name: 'General Masters',
        category: 'General Masters',
        icon: 'sliders',
        description: 'GST slabs, measurement units, payment modes & roles',
        actions: ['read', 'create', 'update', 'delete']
    },

    // ⚙️ SYSTEM & ADMINISTRATION
    {
        slug: 'users',
        name: 'Users & Permissions',
        category: 'System & Administration',
        icon: 'shield',
        description: 'User directory, registrations, password resets & role permissions',
        actions: ['read', 'create', 'update', 'delete', 'approve']
    }
];

module.exports = { MODULES_REGISTRY };
