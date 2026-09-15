const { db } = require('../database');
const { MODULES_REGISTRY } = require('../config/modules.registry');
const { getEnforcer, reloadPolicy } = require('./casbin');

/**
 * Synchronizes the MODULES_REGISTRY with the database permissions and Casbin policies.
 * Runs on server boot to guarantee zero manual SQL setup.
 */
async function bootstrapPermissions() {
    try {
        console.log('🔄 Checking & synchronizing ERP permissions and Casbin policies...');

        // 1. Ensure all registry permissions exist in 'permissions' table
        const existingPermissions = await db('permissions').select('id', 'object', 'action');
        const permMap = new Set(existingPermissions.map(p => `${p.object}:${p.action}`));

        const missingPermissions = [];
        for (const mod of MODULES_REGISTRY) {
            for (const act of mod.actions) {
                const key = `${mod.slug}:${act}`;
                if (!permMap.has(key)) {
                    missingPermissions.push({
                        object: mod.slug,
                        action: act,
                        resource: mod.category,
                        is_active: true
                    });
                }
            }
        }

        if (missingPermissions.length > 0) {
            console.log(`📦 Registering ${missingPermissions.length} new atomic permissions in DB...`);
            await db('permissions').insert(missingPermissions);
        }

        // 2. Fetch all active permissions and roles from DB
        const allDbPermissions = await db('permissions').where('is_active', true).select('id', 'object', 'action');
        const allRoles = await db('roles').where('is_active', true).select('id', 'slug', 'name');

        const roleBySlug = {};
        allRoles.forEach(r => { roleBySlug[r.slug] = r; });

        // 3. Seed default role_permissions if table is empty
        const rolePermCount = await db('role_permissions').count('id as count').first();
        if (parseInt(rolePermCount?.count || 0) === 0) {
            console.log('🌱 Seeding baseline role-permission matrix for 7 default roles...');
            const defaultAssignments = [];

            const getPermId = (obj, act) => {
                const found = allDbPermissions.find(p => p.object === obj && p.action === act);
                return found ? found.id : null;
            };

            for (const mod of MODULES_REGISTRY) {
                for (const act of mod.actions) {
                    const permId = getPermId(mod.slug, act);
                    if (!permId) continue;

                    // Administrator: Gets all actions on all modules
                    if (roleBySlug['administrator']) {
                        defaultAssignments.push({ role_id: roleBySlug['administrator'].id, permission_id: permId });
                    }

                    // Manager
                    if (roleBySlug['manager'] && mod.slug !== 'users') {
                        defaultAssignments.push({ role_id: roleBySlug['manager'].id, permission_id: permId });
                    }

                    // Supervisor
                    if (roleBySlug['supervisor']) {
                        if (['invoices', 'challans', 'eway-bills', 'purchase-orders'].includes(mod.slug)) {
                            if (['read', 'create', 'update', 'print'].includes(act)) {
                                defaultAssignments.push({ role_id: roleBySlug['supervisor'].id, permission_id: permId });
                            }
                        } else if (['vendor-bills', 'payments', 'products', 'parties', 'firms', 'masters'].includes(mod.slug)) {
                            if (act === 'read') {
                                defaultAssignments.push({ role_id: roleBySlug['supervisor'].id, permission_id: permId });
                            }
                        }
                    }

                    // Employee
                    if (roleBySlug['employee']) {
                        if (['invoices', 'challans', 'eway-bills'].includes(mod.slug)) {
                            if (['read', 'create', 'print'].includes(act)) {
                                defaultAssignments.push({ role_id: roleBySlug['employee'].id, permission_id: permId });
                            }
                        } else if (['products', 'parties'].includes(mod.slug) && act === 'read') {
                            defaultAssignments.push({ role_id: roleBySlug['employee'].id, permission_id: permId });
                        }
                    }

                    // Auditor & Viewer: Read and Print only across all operational modules
                    if (['read', 'print'].includes(act) && mod.slug !== 'users') {
                        if (roleBySlug['auditor']) {
                            defaultAssignments.push({ role_id: roleBySlug['auditor'].id, permission_id: permId });
                        }
                        if (roleBySlug['viewer']) {
                            defaultAssignments.push({ role_id: roleBySlug['viewer'].id, permission_id: permId });
                        }
                    }
                }
            }

            if (defaultAssignments.length > 0) {
                await db('role_permissions').insert(defaultAssignments);
                console.log(`✅ Seeded ${defaultAssignments.length} default role-permission links.`);
            }
        }

        // 4. Synchronize Casbin 'policies' table with active role_permissions
        await syncPoliciesTable();

        console.log('✅ Permissions and Casbin policies successfully synchronized.');
    } catch (error) {
        console.error('❌ Error in bootstrapPermissions:', error);
    }
}

/**
 * Re-indexes all active role permissions from the relational tables into Casbin's 'policies' table
 */
async function syncPoliciesTable() {
    // 1. Ensure 'policies' table exists (handled by knex adapter)
    const enforcer = await getEnforcer();

    // 2. Fetch all active role_permissions joined with roles and permissions
    const activeRules = await db('role_permissions as rp')
        .join('roles as r', 'rp.role_id', 'r.id')
        .join('permissions as p', 'rp.permission_id', 'p.id')
        .where('rp.is_active', true)
        .where('r.is_active', true)
        .where('p.is_active', true)
        .select('r.id as role_id', 'r.slug as role_slug', 'p.object', 'p.action');

    // 3. Clear and re-populate 'policies' table atomically
    await db('policies').truncate();

    const casbinRows = [
        // Universal rules for Super Admin (by slug and by role ID 1)
        { ptype: 'p', v0: 'role:super-admin', v1: '*', v2: '*' },
        { ptype: 'p', v0: 'role:1', v1: '*', v2: '*' }
    ];

    const ruleSet = new Set(['role:super-admin:*:*', 'role:1:*:*']);

    for (const rule of activeRules) {
        // ID-based subject: role:<role_id> (e.g. role:35, role:36)
        const key = `role:${rule.role_id}:${rule.object}:${rule.action}`;
        if (!ruleSet.has(key)) {
            ruleSet.add(key);
            casbinRows.push({
                ptype: 'p',
                v0: `role:${rule.role_id}`,
                v1: rule.object,
                v2: rule.action
            });
        }
    }

    if (casbinRows.length > 0) {
        // Insert in chunks of 100 for safety
        await db.batchInsert('policies', casbinRows, 100);
    }

    // 4. Reload into Casbin RAM
    await reloadPolicy();
}

module.exports = { bootstrapPermissions, syncPoliciesTable };
