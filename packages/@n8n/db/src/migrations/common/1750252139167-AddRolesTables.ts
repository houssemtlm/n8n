import type { MigrationContext, ReversibleMigration } from '../migration-types';

/*
 * We introduce roles tables, these will hold all roles that we know about
 *
 * There are roles that can't be edited by users, these are marked as system-only and will
 * be managed by the system itself. On every startup, the system will ensure
 * that these roles are synchronized.
 *
 * ColumnName  | Type | Description
 * =================================
 * slug        | Text | Unique identifier of the role for example: 'global:owner'
 * displayName | Text | Name used to display in the UI
 * description | Text | Text describing the scope in more detail of users
 * roleType    | Text | Text type of role, such as 'global', 'project', etc.
 * system-role | Bool | Indicates if the role is managed by the system and cannot be edited by users
 *
 * Each role table will have a unique slug for each role.
 *
 * For each role table there is a junction table that will hold the
 * relationships between the roles and the scopes that are associated with them.
 */

export class AddRolesTables1750252139167 implements ReversibleMigration {
	async up({ schemaBuilder: { createTable, column } }: MigrationContext) {
		await createTable('role').withColumns(
			column('slug').text.primary.notNull,
			column('displayName').text.default(null),
			column('description').text.default(null),
			column('roleType').text.default(null),
			column('systemRole').bool.default(false).notNull,
		);

		await createTable('role_scope')
			.withColumns(
				column('id').int.primary.autoGenerate2,
				column('role_slug').text.notNull,
				column('scope_slug').text.notNull,
			)
			.withForeignKey('role_slug', {
				tableName: 'role',
				columnName: 'slug',
				onDelete: 'CASCADE',
				onUpdate: 'CASCADE',
			})
			.withForeignKey('scope_slug', {
				tableName: 'scope',
				columnName: 'slug',
				onDelete: 'CASCADE',
				onUpdate: 'CASCADE',
			})
			.withIndexOn('role_slug') // For fast lookup of all scopes for a role
			.withIndexOn('scope_slug') // For fast lookup of which roles have access to a scope
			.withIndexOn(['role_slug', 'scope_slug'], true);
	}

	async down({ schemaBuilder: { dropTable } }: MigrationContext) {
		await dropTable('role_scope');
		await dropTable('role');
	}
}
